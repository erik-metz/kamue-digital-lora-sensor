import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("Pitch data defines all required stakeholder decks and structure", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  // Check required stakeholder slugs (politik, schulen, vhs, wirtschaft)
  const expectedSlugs = ["politik", "schulen", "vhs", "wirtschaft"];

  for (const slug of expectedSlugs) {
    assert.ok(
      pitchDataSource.includes(`slug: "${slug}"`),
      `pitchData.ts must define pitch deck with slug '${slug}'`
    );
  }

  // Confirm deleted decks are not present in PITCH_DECKS
  assert.ok(
    !pitchDataSource.includes('slug: "community"'),
    "community deck must be removed"
  );
  assert.ok(
    !pitchDataSource.includes('slug: "landwirtschaft"'),
    "landwirtschaft deck must be removed"
  );

  // Check required map services (including renamed Raspberry Shake)
  assert.ok(
    pitchDataSource.includes("https://sensor.community/de/"),
    "Must reference Sensor.Community URL"
  );
  assert.ok(
    pitchDataSource.includes("https://ttnmapper.org/heatmap/"),
    "Must reference TTN Mapper heatmap URL"
  );
  assert.ok(
    pitchDataSource.includes("https://raspberryshake.org/"),
    "Must reference Raspberry Shake URL"
  );
  assert.ok(
    pitchDataSource.includes("Raspberry Shake (Seismograph für Erschütterungen & Geothermie)"),
    "Raspberry Shake must reference seismograph / vibrations in its title"
  );

  // Check that speaker notes structure is present
  assert.ok(
    pitchDataSource.includes("speakerNotes"),
    "pitchData.ts must include speaker notes"
  );
  assert.ok(
    pitchDataSource.includes("elevatorPitch"),
    "speaker notes must include elevatorPitch"
  );
  assert.ok(
    pitchDataSource.includes("talkingPoints"),
    "speaker notes must include talkingPoints"
  );
});

test("Core Team members (Rüdiger Enger, Michael Binzen, Erik Metz) are featured with photos", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  assert.ok(
    pitchDataSource.includes("Rüdiger Enger"),
    "Must feature Rüdiger Enger"
  );
  assert.ok(
    pitchDataSource.includes("Michael Binzen"),
    "Must feature Michael Binzen"
  );
  assert.ok(
    pitchDataSource.includes("Erik Metz"),
    "Must feature Erik Metz"
  );

  // Check physical profile image files
  const teamImages = [
    "ruediger-engert.jpg",
    "michael-binzen.jpg",
    "erik-metz.jpg",
  ];
  for (const img of teamImages) {
    const filePath = path.join(__dirname, "../public/pitch", img);
    assert.ok(fs.existsSync(filePath), `Team image ${img} must exist on disk`);
    assert.ok(fs.statSync(filePath).size > 1000, `Team image ${img} must not be empty`);
  }
});

test("Pitch visual photo and diagram assets physically exist in public/pitch", () => {
  const expectedImages = [
    "sensor-community-ried-map.png",
    "ttn-mapper-ried-map.png",
    "raspberry-shake-ried-map.png",
    "hackathon-kamue-community.jpg",
    "sensor-hardware-kit.jpg",
    "schul-stem-workshop.jpg",
    "ried-smart-cockpit.jpg",
    "kamue-cooperation.jpg",
  ];

  for (const img of expectedImages) {
    const filePath = path.join(__dirname, "../public/pitch", img);
    assert.ok(
      fs.existsSync(filePath),
      `Image file ${filePath} must exist on disk`
    );
    const stats = fs.statSync(filePath);
    assert.ok(stats.size > 1000, `Image file ${img} must not be empty`);
  }
});

test("Politik pitch deck includes specific asks and 0 € cost proposition", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  assert.ok(
    pitchDataSource.includes("smartcity-system.de/buerstadt"),
    "Politik pitch must reference smartcity-system.de/buerstadt raw parking sensor data"
  );
  assert.ok(
    pitchDataSource.includes("0 € Belastung für den städtischen Haushalt") ||
    pitchDataSource.includes("0 € Kommunalkosten"),
    "Politik pitch must emphasize 0 € municipal cost"
  );
  assert.ok(
    pitchDataSource.includes("Schirmherrschaft"),
    "Politik pitch must ask for patronage (Schirmherrschaft) at KAMÜ Hackathon"
  );
});

test("Schulen pitch deck does NOT ask schools for money and focuses on STEM & project days", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  assert.ok(
    pitchDataSource.includes("Wir fordern kein Schulbudget"),
    "Schulen deck must explicitly state that no school money is demanded"
  );
  assert.ok(
    pitchDataSource.includes("stem-learning-matrix"),
    "Schulen deck must use stem-learning-matrix layout"
  );
  assert.ok(
    pitchDataSource.includes("Praktisches Handwerk"),
    "STEM matrix must include practical craftmanship (soldering, pliers)"
  );
});

test("Wirtschaft pitch deck spells out CSR and provides flexible sponsorship and LoRa explanation", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  assert.ok(
    pitchDataSource.includes("CSR (Corporate Social Responsibility"),
    "Wirtschaft deck must spell out CSR"
  );
  assert.ok(
    pitchDataSource.includes("100 € pro Schüler"),
    "Wirtschaft deck must offer 100 € student sponsorship"
  );
  assert.ok(
    pitchDataSource.includes("LoRaWAN einfach erklärt"),
    "Wirtschaft deck must explain LoRaWAN simply for non-techs"
  );
});

test("Live regional metrics logic is time-of-day aware (nighttime = 0 bins emptied, 0.0 solar kWh)", async () => {
  const { calculateLiveRegionalMetrics } = await import("../lib/pitchLiveTicker.ts");

  // Test at midnight (00:21)
  const nightMetrics = calculateLiveRegionalMetrics(300, 0);
  assert.equal(nightMetrics.isDaytime, false, "00:00 must be nighttime");
  assert.equal(nightMetrics.binsEmptied, 0, "No bins emptied at night (ZAKB depot sleep)");
  assert.equal(nightMetrics.solarKwhGenerated, "0.0", "Solar generation must be 0.0 at night");
  assert.ok(nightMetrics.telemetryPackets > 0, "LoRaWAN telemetry packets must be > 0 at night (24/7)");
  assert.ok(nightMetrics.trainsTraversed > 0, "Riedbahn freight trains must run at night");

  // Test at noon (12:00)
  const dayMetrics = calculateLiveRegionalMetrics(300, 12);
  assert.equal(dayMetrics.isDaytime, true, "12:00 must be daytime");
  assert.ok(dayMetrics.binsEmptied > 0, "Bins must be emptied during daytime");
  assert.ok(parseFloat(dayMetrics.solarKwhGenerated) > 0, "Solar generation must be > 0 during daytime");
});

test("HandoutModal component exists and provides Ink-Saver white print mode", () => {
  const handoutSource = fs.readFileSync(
    path.join(__dirname, "../app/pitch/HandoutModal.tsx"),
    "utf8"
  );

  assert.ok(
    handoutSource.includes("inkSaverMode"),
    "HandoutModal must support inkSaverMode"
  );
  assert.ok(
    handoutSource.includes("window.print()"),
    "HandoutModal must trigger window.print()"
  );
});

test("Pitch pages have noindex metadata to remain hidden from search engines", () => {
  const hubSource = fs.readFileSync(
    path.join(__dirname, "../app/pitch/page.tsx"),
    "utf8"
  );
  assert.ok(
    hubSource.includes("index: false") && hubSource.includes("follow: false"),
    "Pitch hub page must have robots noindex, nofollow"
  );

  const deckSource = fs.readFileSync(
    path.join(__dirname, "../app/pitch/[slug]/page.tsx"),
    "utf8"
  );
  assert.ok(
    deckSource.includes("index: false") && deckSource.includes("follow: false"),
    "Pitch deck dynamic page must have robots noindex, nofollow"
  );
});

test("Admin panel integrates Pitch Decks navigation and quick launcher", () => {
  const gateSource = fs.readFileSync(
    path.join(__dirname, "../app/admin/AdminClientGate.tsx"),
    "utf8"
  );
  assert.ok(
    gateSource.includes('href="/pitch"'),
    "AdminClientGate must contain link to /pitch"
  );

  const clientSource = fs.readFileSync(
    path.join(__dirname, "../app/admin/AdminClient.tsx"),
    "utf8"
  );
  assert.ok(
    clientSource.includes("PITCH_DECKS"),
    "AdminClient must import and reference PITCH_DECKS"
  );
  assert.ok(
    clientSource.includes("Stakeholder Pitch-Decks (Versteckte Seiten)"),
    "AdminClient must render pitch decks section"
  );
  assert.ok(
    clientSource.includes('href="/pitch"'),
    "AdminClient must link to pitch hub"
  );
});
