# Open Ried Sens – Digitales Umweltsensornetzwerk Bürstadt & Lampertheim

**Open Ried Sens** ist eine private Initiative zur Digitalisierung der Städte **Bürstadt** und **Lampertheim** sowie der umliegenden Region des Hessischen Rieds. Das Projekt wird von engagierten Bürgerinnen und Bürgern in Kooperation mit dem [Kulturzentrum KAMÜ](https://kamue.me) in Bürstadt getragen.

---

## 📌 Projektkontext & Vision

Ziel der Initiative ist die Ausrichtung eines großen regionalen **Hackathons**. Um den Teilnehmerinnen und Teilnehmern des Hackathons eine fundierte Datenbasis zu bieten, benötigt die Region kontinuierliche, verlässliche und historische Umwelt- und Echtzeitdaten. Da solche digitalen Datensätze in den Städten Bürstadt und Lampertheim bislang nicht in ausreichendem Maße öffentlich zur Verfügung stehen, wurde dieses Multisensor-Projekt ins Leben gerufen.

---

## 🛰️ Phasengliederung

### Phase 1: Aufbau der ersten 5 Multisensor-Stationen (Aktuell)
In der ersten Phase werden **5 moderne Multisensor-Messstationen** auf privaten Grundstücken in Bürstadt, Lampertheim und Umgebung installiert. Diese Stationen erfassen rund um die Uhr relevante Umwelt- und Umfelddaten:

- 🌡️ **Temperatur & Luftfeuchtigkeit**
- 🌧️ **Niederschlag / Regenmenge**
- ☀️ **UV-Index & Sonneneinstrahlung**
- 💨 **Luftqualität (VOC & NOx Gase)**
- 🌫️ **Feinstaub (PM2.5 & PM10)**
- 🎙️ **Akustische Lärmklassifizierung** (Einsatz eines Mikrofons zur Klassifikation von Fahrzeuglärm, Passanten/Sprache, Wind- und Umweltgeräuschen)

### Phase 2: Aufbau der regionalen LoRaWAN-Infrastruktur
Da in der Region bislang keine flächendeckende LoRaWAN-Abdeckung existiert, umfasst das Projekt auch den schrittweisen **Aufbau von LoRaWAN-Gateways**, die an [The Things Network (TTN)](https://www.thethingsindustries.com) angebunden sind. Dadurch wird erstmals eine freie, energiesparsame IoT-Funkinfrastruktur für Bürger, Landwirtschaft und Umweltprojekte in Bürstadt und Lampertheim geschaffen.

### Phase 3: Mini-Hackathon mit Schulen (50–100 Sensorstationen)
Die gewonnenen Erfahrungen aus den ersten 5 Stationen dienen als Katalysator für einen **Mini-Hackathon in Zusammenarbeit mit lokalen Schulen** (z. B. der *Erich Kästner Schule* in Bürstadt). Schülerinnen und Schüler lernen dabei den Zusammenbau, die Programmierung und den Betrieb eigener LoRaWAN-Sensoren. Ziel ist die Ausweitung des Sensornetzes auf **50 bis 100 Messpunkte** in der gesamten Region.

### Phase 4: Der regionale Hackathon & Kommunale Einbindung
Nach einer mehrmonatigen Datenerfassungsphase steht der Haupt-Hackathon an. Mit den gesammelten historischen Daten können innovativste Anwendungen für Smart City, Umweltschutz, Lärmschutz und Bürgerdienste entwickelt werden. Parallel wird das Projekt in den politischen Gremien beider Städte vorgestellt, um öffentliche Förderungen und kommunale Mittel zur langfristigen Sicherung des Netzwerks einzuwerben.

---

## 🛠️ Technischer Stack der Web-Applikation

Die Web-Anwendung dient als zentrales Dashboard und Dokumentationsportal für das Netzwerk:

- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Kartendarstellung**: Leaflet & OpenStreetMap (Bürstadt / Lampertheim / Ried Region)
- **Funkstandard**: LoRaWAN OTAA über [The Things Network (TTN)](https://www.thethingsindustries.com)

---

## 🚀 Entwicklung & Start

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungs-Server starten
npm run dev

# Production Build erstellen
npm run build
```

Öffne [http://localhost:3000](http://localhost:3000) im Browser.
# Security configuration

Copy `.env.example` and configure `ADMIN_PASSWORD`, `BACKEND_API_URL`,
`BACKEND_ADMIN_API_KEY`, and `ADMIN_SESSION_SECRET`. Generate the session secret
with `openssl rand -hex 32`; it must be 64 hexadecimal characters and independent
of the password. Use separate credentials/secrets for development and production.
All environments require the correct password to log in. Changing the session
secret signs out every administrator; existing password-signed cookies are no
longer accepted after this upgrade. Keep the session secret consistent across
instances of the same deployment, separately from the Server Actions encryption key.

Use the HTTPS backend URL for a remote VPS. Its Docker services no longer publish
the database or plaintext API ports. Set the VPS `ADMIN_API_KEY` to match
`BACKEND_ADMIN_API_KEY`; it must differ from the ingestion `API_KEY`.

Run security regression checks with `npm run test:security`.
# Sensor map

The dashboard uses clustered Leaflet markers without permanent sensor IDs.
Theme buttons support multiple selections and persist them in local storage.
Clicking a theme from the initial "Alle" selection isolates that theme; subsequent
clicks add/remove themes. "Zurücksetzen" restores all themes and category colours.
The map and station selector use the same filtered inventory. Multi-theme stations
are counted once on the map, so category totals can overlap.

The initial viewport stays around Bürstadt/Lampertheim. "Alle Standorte" fits the
selected inventory, including regional stations. Cluster rings show theme
composition; clicking expands a cluster, and colocated markers spread apart at
maximum zoom. Names appear on hover, measurements in popups, and short values at
zoom 16+. Technical IDs and source descriptions are under "Stationsdetails".

"Temperatur · °C" uses five labelled temperature bins for current Celsius
readings; it excludes stations without a compatible temperature measurement.
Icons still distinguish themes, including soil versus weather. Old/missing values
are muted and dashed; in temperature mode they are gray. Temperature clusters
remain neutral count bubbles rather than implying an averaged temperature.

Freshness describes the observation, never device connectivity: seismic readings
are current for 2 minutes, general weather/water readings for 2 hours, air-quality
index for 3 hours, and explicit soil metrics for 6 hours. Parking is an event-driven
last-reported state and is not labelled online/offline. Every popup includes its
source timestamp. These are display heuristics, not provider uptime guarantees.

The server and `/api/map-sensors` proxy read `/api/v1/map/sensors` once per refresh
(60 seconds). The backend reads its `sensor_latest` table, maintained by a database
trigger for inserts, corrections and deletes. Deploy the updated API/schema before
the frontend. First migration backfills existing history once and may take time on
large databases; subsequent restarts do not repeat the backfill. A 404 from an older
API falls back to metadata-only markers with an explicit message that readings are
unavailable; it does not invent status or fetch measurements separately per station.

Validation: `npm run test:map`, `npm run test:security`, `npm run build`.
