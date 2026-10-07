import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("SiteFooter keeps the bottom navigation", () => {
  const footerSource = fs.readFileSync(
    new URL("../app/components/SiteFooter.tsx", import.meta.url),
    "utf8"
  );
  for (const href of ["/", "/regionalatlas", "/daten", "/quellen"]) {
    assert.ok(footerSource.includes(`href="${href}"`));
  }
});

test("All 8 public & admin pages render the unified SiteFooter", () => {
  const pages = [
    "../app/page.tsx",
    "../app/daten/page.tsx",
    "../app/regionalatlas/page.tsx",
    "../app/demografie/page.tsx",
    "../app/wirtschaft/page.tsx",
    "../app/haushalt/page.tsx",
    "../app/statistik/page.tsx",
    "../app/bauen-wohnen/page.tsx",
    "../app/admin/AdminClientGate.tsx",
    "../app/quellen/page.tsx",
  ];

  for (const pageRel of pages) {
    const pageSource = fs.readFileSync(new URL(pageRel, import.meta.url), "utf8");
    assert.ok(
      pageSource.includes("<SiteFooter") || pageSource.includes("<SiteFooter />"),
      `Page ${pageRel} must render <SiteFooter />`
    );
  }
});

test("Quellen page renders collected status without invented totals", () => {
  const source = fs.readFileSync(new URL("../app/quellen/page.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('proxyBackend("collection/status", 30)'));
  assert.ok(source.includes('sources.map'));
  assert.ok(source.includes('source.last_success_at'));
  assert.ok(source.includes('source.interval_seconds'));
  assert.ok(source.includes('nicht erreichbar'));
  assert.doesNotMatch(source, /345\.600|475\.000|14\.500/);
});
