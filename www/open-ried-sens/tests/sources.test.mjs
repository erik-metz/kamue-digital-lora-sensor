import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("SiteFooter contains link to /quellen and all domain pages", () => {
  const footerSource = fs.readFileSync(
    new URL("../app/components/SiteFooter.tsx", import.meta.url),
    "utf8"
  );
  assert.ok(
    footerSource.includes('href="/quellen"'),
    "SiteFooter must include link to /quellen"
  );
  assert.ok(
    footerSource.includes("Datenquellen &amp; Takte") ||
      footerSource.includes("Datenquellen & Takte"),
    "SiteFooter must include label 'Datenquellen & Takte'"
  );
  assert.ok(footerSource.includes('href="/"'), "SiteFooter must include link to Dashboard");
  assert.ok(footerSource.includes('href="/daten"'), "SiteFooter must include link to /daten");
  assert.ok(footerSource.includes('href="/demografie"'), "SiteFooter must include link to /demografie");
  assert.ok(footerSource.includes('href="/wirtschaft"'), "SiteFooter must include link to /wirtschaft");
  assert.ok(footerSource.includes('href="/haushalt"'), "SiteFooter must include link to /haushalt");
  assert.ok(footerSource.includes('href="/statistik"'), "SiteFooter must include link to /statistik");
  assert.ok(footerSource.includes('href="/bauen-wohnen"'), "SiteFooter must include link to /bauen-wohnen");
  assert.ok(footerSource.includes('href="/admin"'), "SiteFooter must include link to /admin");
});

test("All 8 public & admin pages render the unified SiteFooter", () => {
  const pages = [
    "../app/page.tsx",
    "../app/daten/page.tsx",
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
