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

  // Check required stakeholder slugs
  const expectedSlugs = [
    "politik",
    "schulen",
    "vhs",
    "community",
    "wirtschaft",
    "landwirtschaft",
  ];

  for (const slug of expectedSlugs) {
    assert.ok(
      pitchDataSource.includes(`slug: "${slug}"`),
      `pitchData.ts must define pitch deck with slug '${slug}'`
    );
  }

  // Check required map services
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

test("Pitch visual photo and diagram assets physically exist in public/pitch", () => {
  const expectedImages = [
    "sensor-community-ried-map.png",
    "ttn-mapper-ried-map.png",
    "raspberry-shake-ried-map.png",
    "hackathon-kamue-community.jpg",
    "sensor-hardware-kit.jpg",
    "schul-stem-workshop.jpg",
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

test("Politik pitch deck includes specific asks (smartcity-system.de, TTN gateways, Hackathon)", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  assert.ok(
    pitchDataSource.includes("smartcity-system.de/buerstadt"),
    "Politik pitch must reference smartcity-system.de/buerstadt raw parking sensor data"
  );
  assert.ok(
    pitchDataSource.includes("The Things Network (TTN)"),
    "Politik pitch must ask for opening / access to LoRaWAN TTN gateways"
  );
  assert.ok(
    pitchDataSource.includes("Schirmherrschaft"),
    "Politik pitch must ask for patronage (Schirmherrschaft) at KAMÜ Hackathon"
  );
});

test("Schulen pitch deck includes differentiated STEM learning matrix and multiplier effect", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  assert.ok(
    pitchDataSource.includes("stem-learning-matrix"),
    "Schulen deck must use stem-learning-matrix layout"
  );
  assert.ok(
    pitchDataSource.includes("Praktisches Handwerk"),
    "STEM matrix must include practical craftmanship (soldering, pliers)"
  );
  assert.ok(
    pitchDataSource.includes("Multiplikator"),
    "STEM matrix must include multiplier effect leading to Hackathon participation"
  );
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
