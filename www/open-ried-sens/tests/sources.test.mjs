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

test("Quellen page covers all real-time collectors and domain registries", () => {
  const quellenSource = fs.readFileSync(
    new URL("../app/quellen/page.tsx", import.meta.url),
    "utf8"
  );

  // Real-time & polling collectors
  assert.ok(quellenSource.includes("Raspberry Shake"), "Must include Raspberry Shake");
  assert.ok(quellenSource.includes("Smart City System"), "Must include Smart City System Bürstadt");
  assert.ok(quellenSource.includes("VRNnextbike"), "Must include Nextbike");
  assert.ok(quellenSource.includes("Autobahn"), "Must include Autobahn GmbH");
  assert.ok(quellenSource.includes("LoRaWAN"), "Must include LoRaWAN Community");
  assert.ok(quellenSource.includes("Pegelonline"), "Must include Pegelonline");
  assert.ok(quellenSource.includes("DWD"), "Must include DWD Open-Meteo");

  // Calculated numbers
  assert.ok(quellenSource.includes("345.600"), "Must show ~345.600 rows for seismic");
  assert.ok(quellenSource.includes("475.000"), "Must show ~475.000 overall rows");
  assert.ok(quellenSource.includes("14.500"), "Must show > 14.500 daily calls");

  // Newly added domains
  assert.ok(quellenSource.includes("Wirtschaft"), "Must cover economic domain");
  assert.ok(quellenSource.includes("Kommunalpolitik"), "Must cover municipal/budget domain");
  assert.ok(quellenSource.includes("Soziales & Leben"), "Must cover social/waste domain");
  assert.ok(quellenSource.includes("Umwelt & Agrar"), "Must cover environmental/groundwater/agro domain");
  assert.ok(quellenSource.includes("Infrastruktur"), "Must cover infrastructure/energy/broadband domain");
  assert.ok(quellenSource.includes("Bauen & Wohnen"), "Must cover real estate/housing/BORIS domain");
});
