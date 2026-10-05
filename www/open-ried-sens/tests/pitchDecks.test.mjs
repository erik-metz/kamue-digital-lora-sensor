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
      new RegExp(`slug["\\s]*: "${slug}"`).test(pitchDataSource),
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
    pitchDataSource.includes("Raspberryshaker (Seismograph für Erschütterungen & Geothermie)"),
    "Raspberryshaker must reference seismograph / vibrations in its title"
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

test("Core Team members (Rüdiger Engert, Michael Binzen, Erik Metz) are featured with photos", () => {
  const pitchDataSource = fs.readFileSync(
    path.join(__dirname, "../lib/pitchData.ts"),
    "utf8"
  );

  assert.ok(
    pitchDataSource.includes("Rüdiger Engert"),
    "Must feature Rüdiger Engert"
  );
  assert.ok(
    pitchDataSource.includes("Engert Agrarmarkt"),
    "Must reference Engert Agrarmarkt in Rüdiger's background"
  );
  assert.ok(
    pitchDataSource.includes("Michael Binzen"),
    "Must feature Michael Binzen"
  );
  assert.ok(
    pitchDataSource.includes("Erik Metz"),
    "Must feature Erik Metz"
  );
  assert.ok(
    pitchDataSource.includes("Digital Fellow am MIT"),
    "Must feature Erik Metz MIT Digital Fellow background"
  );
  assert.ok(
    pitchDataSource.includes("Wir leben im Ried"),
    "Must emphasize living in the Ried"
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

test("Every pitch deck (Politik, Schulen, VHS, Wirtschaft) contains the Core Team slide", async () => {
  const { PITCH_DECKS } = await import("../lib/pitchData.ts");

  assert.equal(PITCH_DECKS.length, 4, "Must have exactly 4 stakeholder pitch decks");

  for (const deck of PITCH_DECKS) {
    const teamSlide = deck.slides.find((s) => s.layout === "team-showcase");
    assert.ok(
      teamSlide,
      `Deck '${deck.slug}' (${deck.title}) must include a slide with layout 'team-showcase'`
    );
    assert.ok(
      teamSlide.teamMembers && teamSlide.teamMembers.length === 3,
      `Deck '${deck.slug}' team slide must feature all 3 core team members`
    );
    assert.ok(
      teamSlide.teamMembers.some((m) => m.name === "Rüdiger Engert"),
      `Deck '${deck.slug}' must include Rüdiger Engert`
    );
    assert.ok(
      teamSlide.teamMembers.some((m) => m.name === "Michael Binzen"),
      `Deck '${deck.slug}' must include Michael Binzen`
    );
    assert.ok(
      teamSlide.teamMembers.some((m) => m.name === "Erik Metz"),
      `Deck '${deck.slug}' must include Erik Metz`
    );
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

test("All decks tell the origin story, include collected data, and end with an ask", async () => {
  const { PITCH_DECKS } = await import("../lib/pitchData.ts");
  for (const deck of PITCH_DECKS) {
    assert.deepEqual(deck.slides.slice(0, 4).map(slide => slide.id), ["team", "hackathon", "origin", "collected"].map(id => `${deck.slug}-${id}`));
    assert.equal(deck.slides.at(-1).layout, "the-ask-commitment");
    assert.equal(deck.slides.filter(slide => slide.layout === "collected-evidence").length, 1);
    assert.equal(new Set(deck.slides.map(slide => slide.id)).size, deck.slides.length);
    assert.deepEqual(deck.slides.map(slide => slide.stepNumber), deck.slides.map((_, index) => index + 1));
    assert.ok(deck.slides.every(slide => slide.speakerNotes.elevatorPitch));
    assert.doesNotMatch(JSON.stringify(deck), /0 € Kommunalkosten|Absolut ungefährlich|2,4 Millionen|garantiertes Erfolgserlebnis/);
  }
});

test("Political asks prioritize raw data and conditionally usable infrastructure", async () => {
  const { POLITIK_DECK } = await import("../lib/pitchData.ts");
  const asks = POLITIK_DECK.slides.flatMap(slide => slide.specificAsks ?? []);
  assert.deepEqual(asks.map(ask => ask.id), ["ask-rohdaten", "ask-infrastruktur", "ask-live-daten", "ask-praesenz"]);
  assert.match(asks[1].description, /Falls ein geeignetes LoRaWAN-Netz/);
  assert.match(asks[3].description, /Hauptpreises/);
});

test("Collected evidence rejects empty and error payloads and preserves actual values", async () => {
  const { previewCollectedData, evidenceExpired } = await import("../lib/pitchEvidence.ts");
  for (const payload of [null, [], {}, {error: "offline"}, {items: []}, "not JSON data"]) assert.equal(previewCollectedData(payload), null);
  const preview = previewCollectedData([{station: "Teststation", value: 0, unit: "cm"}]);
  assert.equal(preview.entries, 1);
  assert.deepEqual(preview.fields.map(field => field.value), ["Teststation", "0", "cm"]);
  assert.equal(evidenceExpired("2026-10-05T12:00:00Z", Date.parse("2026-10-05T12:00:00Z")), true);
  const gauge = previewCollectedData([{name: "WORMS", current_level_m: -0.24, updated_at: "2026-10-05T07:30:00Z"}]);
  assert.deepEqual(gauge.fields.map(field => field.value), ["WORMS", "-0.24", "2026-10-05T07:30:00Z"]);
  const inventory = previewCollectedData({stations: [{operator: "Betreiber", address: "Straße 1", municipality: "Bürstadt", availablePoints: null}]});
  assert.deepEqual(inventory.fields.map(field => field.value), ["Betreiber", "Straße 1", "Bürstadt"]);
  assert.equal(evidenceExpired("invalid"), true);
  assert.equal(evidenceExpired(null), false);
  assert.equal(evidenceExpired("2026-10-05T12:01:00Z", Date.parse("2026-10-05T12:00:00Z")), false);
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
