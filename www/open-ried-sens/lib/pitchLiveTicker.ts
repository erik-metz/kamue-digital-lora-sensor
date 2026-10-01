export interface LiveRegionalMetrics {
  elapsedSeconds: number;
  formattedDuration: string;
  isDaytime: boolean;
  currentHour: number;
  binsEmptied: number;
  binsStatusText: string;
  levelCrossingEvents: number;
  trainsTraversed: number;
  telemetryPackets: number;
  parkingStateChanges: number;
  solarKwhGenerated: string;
  solarStatusText: string;
  waterEvaporatedLiters: number;
  co2Measurements: number;
  pm25Samples: number;
}

export interface LiveEventLogItem {
  id: string;
  secondsAgo: number;
  timeAgoFormatted: string;
  category: "lora" | "zakb" | "bahn" | "parking" | "umwelt";
  iconName: string;
  title: string;
  detail: string;
  location: string;
  statusBadge: string;
  badgeColor: "emerald" | "sky" | "amber" | "rose" | "violet";
}

export function calculateLiveRegionalMetrics(
  elapsedSeconds: number,
  hourOverride?: number
): LiveRegionalMetrics {
  const safeSeconds = Math.max(1, elapsedSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  const formattedDuration = `${minutes > 0 ? `${minutes}m ` : ""}${seconds < 10 && minutes > 0 ? `0${seconds}` : seconds}s`;

  const currentHour = typeof hourOverride === "number" ? hourOverride : new Date().getHours();
  // Daytime operational hours in the Ried: 06:00 to 18:59
  const isDaytime = currentHour >= 6 && currentHour < 19;

  // 1. ZAKB Waste Collection:
  // Daytime: ~1 bin every 6-8 seconds during rounds across Bürstadt, Lampertheim, Biblis.
  // Nighttime (19:00 - 05:59): ZAKB vehicles are parked at Depot Hüttenfeld -> 0 bins emptied.
  const binsEmptied = isDaytime ? Math.max(1, Math.floor(safeSeconds * 0.14)) : 0;
  const binsStatusText = isDaytime
    ? "Touren aktiv im Ried"
    : "Nachtruhe (Fuhrpark im Depot Hüttenfeld, Start 06:30 Uhr)";

  // 2. Solar PV Generation:
  // Daytime: solar active. Nighttime: 0.0 kWh.
  const solarKwhGenerated = isDaytime ? (safeSeconds * 0.08).toFixed(1) : "0.0";
  const solarStatusText = isDaytime
    ? "Dach- & Freiflächen aktiv"
    : "Nachtzeit (keine Solar-Einspeisung)";

  // 3. Level Crossing Events (BÜ Bobstadt, Bürstadt B47):
  // 24/7 active because freight and regional trains run around the clock.
  const levelCrossingRate = isDaytime ? 0.05 : 0.025;
  const levelCrossingEvents = Math.max(1, Math.floor(safeSeconds * levelCrossingRate));

  // 4. Trains traversed (Riedbahn & Nibelungenbahn):
  // 24/7 active (ICE, RE70 by day; DB Cargo freight corridor and night trains by night).
  const trainRate = isDaytime ? 0.03 : 0.018;
  const trainsTraversed = Math.max(1, Math.floor(safeSeconds * trainRate));

  // 5. LoRaWAN IoT Telemetry Packets:
  // Runs 24/7 uninterrupted (~3.2 packets/sec across deployed nodes).
  const telemetryPackets = Math.max(4, Math.floor(safeSeconds * 3.2));

  // 6. Smart Parking (smartcity-system.de Bürstadt):
  // High during day, low at night.
  const parkingRate = isDaytime ? 0.12 : 0.02;
  const parkingStateChanges = Math.max(isDaytime ? 1 : 0, Math.floor(safeSeconds * parkingRate));

  // 7. Environmental & Soil Sensors:
  // Runs 24/7 continuous sensor readings.
  const waterEvaporatedLiters = Math.max(1, Math.floor(safeSeconds * (isDaytime ? 1.2 : 0.3)));
  const co2Measurements = Math.max(2, Math.floor(safeSeconds * 1.1));
  const pm25Samples = Math.max(2, Math.floor(safeSeconds * 1.3));

  return {
    elapsedSeconds: safeSeconds,
    formattedDuration,
    isDaytime,
    currentHour,
    binsEmptied,
    binsStatusText,
    levelCrossingEvents,
    trainsTraversed,
    telemetryPackets,
    parkingStateChanges,
    solarKwhGenerated,
    solarStatusText,
    waterEvaporatedLiters,
    co2Measurements,
    pm25Samples,
  };
}

export function getLiveEventFeed(
  elapsedSeconds: number,
  hourOverride?: number
): LiveEventLogItem[] {
  const safeSeconds = Math.max(5, elapsedSeconds);
  const currentHour = typeof hourOverride === "number" ? hourOverride : new Date().getHours();
  const isDaytime = currentHour >= 6 && currentHour < 19;

  // Pool of authentic regional events in the Ried (adapted for day / night)
  const eventTemplates = isDaytime
    ? [
        {
          category: "lora" as const,
          iconName: "Radio",
          title: "LoRaWAN Umweltpaket empfangen",
          detail: "SCD41: 442 ppm CO2 · SPS30: 6.8 µg/m³ PM2.5 · SHT41: 19.4°C",
          location: "Station Bürstadt-KAMÜ #01",
          statusBadge: "868 MHz OK",
          badgeColor: "emerald" as const,
          interval: 7,
        },
        {
          category: "zakb" as const,
          iconName: "Trash2",
          title: "ZAKB Mülltonnen-Leerung registriert",
          detail: "Behälter #4812 (Restmüll 120L) gewogen & registriert",
          location: "Tour Bürstadt / Nibelungenstraße",
          statusBadge: "ZAKB GPS Live",
          badgeColor: "amber" as const,
          interval: 14,
        },
        {
          category: "bahn" as const,
          iconName: "ShieldAlert",
          title: "Bahnübergang Schrankenöffnung",
          detail: "Freigabe Straßenverkehr nach Durchfahrt RE 70 (Mannheim → Frankfurt)",
          location: "BÜ Bobstadt (B47 Kreuzung)",
          statusBadge: "Offen für Verkehr",
          badgeColor: "sky" as const,
          interval: 22,
        },
        {
          category: "parking" as const,
          iconName: "Car",
          title: "smartcity-system Belegungswechsel",
          detail: "Stellplatz #14 von 'belegt' auf 'frei' gewechselt",
          location: "Marktplatz Bürstadt",
          statusBadge: "Park-Sensor",
          badgeColor: "violet" as const,
          interval: 18,
        },
        {
          category: "bahn" as const,
          iconName: "Train",
          title: "Riedbahn Schnellzug-Passage",
          detail: "ICE 271 passiert Korridor mit 160 km/h ohne Halt",
          location: "Abschnitt Biblis → Lampertheim",
          statusBadge: "Auf Trasse",
          badgeColor: "rose" as const,
          interval: 35,
        },
        {
          category: "umwelt" as const,
          iconName: "Droplets",
          title: "Bodenfeuchte-Messung Ackerfläche",
          detail: "Sonde #AG-04: Bodenfeuchte 28% in 40 cm Tiefe (Sandlehm)",
          location: "Versuchsfeld Bürstadt-Ost",
          statusBadge: "Bodenfeuchte OK",
          badgeColor: "emerald" as const,
          interval: 28,
        },
      ]
    : [
        {
          category: "lora" as const,
          iconName: "Radio",
          title: "Night-Owl LoRaWAN Umweltpaket",
          detail: "SCD41: 418 ppm CO2 · SPS30: 3.9 µg/m³ PM2.5 · SHT41: 11.4°C",
          location: "Station Bürstadt-KAMÜ #01",
          statusBadge: "24/7 Live",
          badgeColor: "emerald" as const,
          interval: 8,
        },
        {
          category: "zakb" as const,
          iconName: "Trash2",
          title: "ZAKB Fuhrpark im Depot Hüttenfeld",
          detail: "Fahrzeuge in Betriebsruhe · Nächste Sammeltour startet um 06:30 Uhr",
          location: "ZAKB Wertstoffzentrum Hüttenfeld",
          statusBadge: "Nachtruhe (0 Leerungen)",
          badgeColor: "amber" as const,
          interval: 30,
        },
        {
          category: "bahn" as const,
          iconName: "Train",
          title: "Riedbahn Güterzug-Transit",
          detail: "DB Cargo Transit (Maschen → Mannheim Rbf) auf Nachtkorridor",
          location: "Korridor Biblis → Bürstadt",
          statusBadge: "Güterverkehr",
          badgeColor: "sky" as const,
          interval: 25,
        },
        {
          category: "bahn" as const,
          iconName: "ShieldAlert",
          title: "Bahnübergang Schrankenfreigabe",
          detail: "Freigabe Straßenverkehr nach nächtlicher Güterzug-Passage",
          location: "BÜ Bobstadt (B47 Kreuzung)",
          statusBadge: "Offen für Verkehr",
          badgeColor: "rose" as const,
          interval: 35,
        },
        {
          category: "parking" as const,
          iconName: "Car",
          title: "smartcity-system Nachtstatus",
          detail: "Ruhender Nachtverkehr Bürstadt · 15/25 Stellplätze belegt",
          location: "Marktplatz Bürstadt",
          statusBadge: "Park-Sensor",
          badgeColor: "violet" as const,
          interval: 40,
        },
        {
          category: "umwelt" as const,
          iconName: "Droplets",
          title: "Bodenfeuchte Nacht-Messung",
          detail: "Sonde #AG-04: Bodenfeuchte stabil bei 29% (Taubildung aktiv)",
          location: "Versuchsfeld Bürstadt-Ost",
          statusBadge: "Bodenfeuchte OK",
          badgeColor: "emerald" as const,
          interval: 28,
        },
      ];

  const events: LiveEventLogItem[] = [];

  eventTemplates.forEach((tmpl, idx) => {
    // Generate events based on elapsed time
    const occurrenceSec = safeSeconds - ((idx * 6) % Math.max(8, safeSeconds));
    const secondsAgo = Math.max(1, safeSeconds - occurrenceSec);
    const timeAgoFormatted =
      secondsAgo < 60 ? `vor ${secondsAgo}s` : `vor ${Math.floor(secondsAgo / 60)}m ${secondsAgo % 60}s`;

    events.push({
      id: `evt-${idx}-${occurrenceSec}`,
      secondsAgo,
      timeAgoFormatted,
      category: tmpl.category,
      iconName: tmpl.iconName,
      title: tmpl.title,
      detail: tmpl.detail,
      location: tmpl.location,
      statusBadge: tmpl.statusBadge,
      badgeColor: tmpl.badgeColor,
    });
  });

  return events.sort((a, b) => a.secondsAgo - b.secondsAgo);
}
