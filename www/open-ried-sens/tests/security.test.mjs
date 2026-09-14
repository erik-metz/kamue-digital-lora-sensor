import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Execute the real modules, replacing only Next.js/environment boundaries.
function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const context = { exports: {}, Buffer, console, Date, process: { env: {} }, ...globals,
    require(name) {
      if (name === "crypto") return crypto;
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

for (const mode of ["development", "production", "test"]) {
  test(`login requires correct password in ${mode}`, async () => {
    const issued = [];
    const actions = load("app/admin/actions.ts", {
      "@/env": { env: { ADMIN_PASSWORD: "correct-test-password" } },
      "@/lib/adminAuth": { ADMIN_COOKIE_CONFIG: {}, createSessionToken: () => "signed", isAuthenticated: async () => false },
      "@/lib/backend": {},
      "@/lib/loginRateLimit": { loginAllowed: () => true, clearFailedLogins() {}, recordFailedLogin() {} },
      "next/cache": {},
      "next/headers": { headers: async () => new Headers(), cookies: async () => ({ set: value => issued.push(value) }) },
    }, { process: { env: { NODE_ENV: mode } } });
    for (const wrong of ["wrong", "incorrect-test-passwd", "", null]) {
      assert.equal((await actions.loginAction(wrong)).ok, false);
    }
    assert.equal(issued.length, 0);
    assert.equal((await actions.loginAction("correct-test-password")).ok, true);
    assert.equal(issued.length, 1);
    assert.equal((await actions.listSensorsAction()).ok, false);
  });
}

test("sessions require independent signing key, expiry and valid timestamps", () => {
  const env = { ADMIN_PASSWORD: "test-password", ADMIN_SESSION_SECRET: "ab".repeat(32) };
  const auth = load("lib/adminAuth.ts", { "@/env": { env }, "next/headers": {} });
  const token = auth.createSessionToken();
  assert.equal(auth.verifySessionToken(token), true);
  const sign = (time, key) => `${time}.${crypto.createHmac("sha256", key).update(`admin-session:${time}`).digest("hex")}`;
  const timestamp = token.split(".")[0];
  assert.equal(auth.verifySessionToken(sign(timestamp, env.ADMIN_PASSWORD)), false);
  const key = Buffer.from(env.ADMIN_SESSION_SECRET, "hex");
  assert.equal(auth.verifySessionToken(sign(Date.now() + 60_000, key)), false);
  assert.equal(auth.verifySessionToken(sign(Date.now() - 8 * 86400000, key)), false);
  assert.equal(auth.verifySessionToken(sign(`${timestamp}junk`, key)), false);
  assert.equal(auth.verifySessionToken(token + "junk"), false);
  env.ADMIN_PASSWORD = "new-test-password";
  assert.equal(auth.verifySessionToken(token), true);
  env.ADMIN_SESSION_SECRET = "cd".repeat(32);
  assert.equal(auth.verifySessionToken(token), false);
});

test("markers render icons and safe value text, never sensor IDs as HTML", () => {
  function element(tag) {
    return { tag, style: { setProperty() {} }, children: [], attrs: {},
      setAttribute(key, value) { this.attrs[key] = value; }, append(...nodes) { this.children.push(...nodes); },
      set innerHTML(_) { throw new Error("HTML parsing is forbidden for markers"); },
    };
  }
  const document = { createElement: element, createElementNS: (_, tag) => element(tag) };
  const model = load("lib/mapData.ts", {});
  const { createMarkerContent } = load("lib/mapMarker.ts", { "./mapData": model }, { document });
  const payload = "<img src=x onerror=alert(1)>";
  const marker = createMarkerContent("weather", "#f59e0b", false, payload);
  assert.equal(marker.children[0].tag, "svg");
  assert.equal(marker.children[1].textContent, payload);
  assert.equal(marker.children[1].children.length, 0);
  assert.equal(createMarkerContent("weather", "#f59e0b", false).children.length, 1);
});
