# Open Ried Sens – Offene Programmierschnittstelle (Open REST API)

Freie Umweltdaten für **Hackathons, Apps & Forschung** aus Bürstadt & Lampertheim. Eine Initiative vom **KAMÜ Kulturzentrum** & Bürgerinnen/Bürgern.

Das Projekt **Open Ried Sens** stellt alle erfassten Umwelt- und Klimaparameter des Bürstädter und Lampertheimer Sensornetzwerks als **Open Data** zur Verfügung. Die Daten können ohne Zugangsbeschränkungen oder Registrierung abgefragt werden.

- **CORS aktiviert** [Browser-Ready]
- **TimescaleDB Hypertable** im Backend
- **Keine API-Keys** für Lesezugriff erforderlich
- **Swagger UI**: Interaktive API-Dokumentation direkt auf der VPS verfügbar.

---

## 🌐 Basis-URL

<https://open-ried-sens.duckdns.org/api/v1>

Alle Abfragen unterstützen JSON und standardisierte ISO-8601 Zeitformate.

---

## 🚀 Schnelleinstieg in Code

### cURL

# 1. Alle aktiven Stationen auflisten

curl -X GET "<https://open-ried-sens.duckdns.org/api/v1/sensors>" \
 -H "Accept: application/json"

# 2. Neuesten Messwert für Station 'ried-01' abrufen

curl -X GET "<https://open-ried-sens.duckdns.org/api/v1/telemetry/latest?sensor_id=ried-01>"

# 3. 1-Stunden-Durchschnittswerte der letzten 24 Stunden abrufen

curl -X GET "<https://open-ried-sens.duckdns.org/api/v1/telemetry/aggregates?sensor_id=ried-01&interval=1%20hour&start_time=2026-09-12T00:00:00.000Z>"

### Python

import requests

# Neueste Telemetriedaten abrufen

url = "<https://open-ried-sens.duckdns.org/api/v1/telemetry/latest>"
params = {"sensor_id": "ried-01"}

response = requests.get(url, params=params)
data = response.json()

print(f"Station: {data['sensor_id']}, Wert: {data['value']} {data['unit']}")

### JavaScript (Fetch API)

// Aktive Stationen abrufen
async function getSensors() {
const response = await fetch("<https://open-ried-sens.duckdns.org/api/v1/sensors>");
const sensors = await response.json();
console.log(sensors);
}

getSensors();

---

## 📡 Endpunkt-Referenz (v1)

### `GET /api/v1/sensors` (Öffentlich)

Liefert die Liste aller öffentlich sichtbaren Messstationen inklusive Name, GPS-Koordinaten (Breite/Länge) und Beschreibung.

Beispiel-Antwort (`200 OK`):
[
{
"sensor_id": "ried-01",
"friendly_name": "Station 1: Bürstadt Mitte",
"latitude": 49.6425,
"longitude": 8.456,
"is_hidden": false,
"description": "KAMÜ Kulturzentrum Industriestr. 11",
"created_at": "2026-09-11T12:00:00Z"
}
]

---

### `GET /api/v1/telemetry/latest` (Öffentlich)

Ruft den zuletzt empfangenen Einzelwert für eine angegebene Station ab.

Query-Parameter:

- `sensor_id` (string, erforderlich): Die ID der Station, z.B. `ried-01`.

Beispiel-Antwort (`200 OK`):
{
"sensor_id": "ried-01",
"timestamp": "2026-09-11T19:42:00Z",
"value": 21.4,
"unit": "celsius"
}

---

### `GET /api/v1/telemetry/raw` (Öffentlich)

Liefert die historischen Rohdatenpunkte einer Station innerhalb eines definierten Zeitintervalls.

Query-Parameter:

- `sensor_id` (string, erforderlich): ID der Station.
- `start_time` (ISO-8601, erforderlich): Startzeitpunkt.
- `end_time` (ISO-8601, optional): Endzeitpunkt [Standard: jetzt].
- `limit` (int, optional): Max. Punkte [Standard 100, max. 5000].

---

### `GET /api/v1/telemetry/aggregates` (Öffentlich)

Berechnet direkt über TimescaleDBs `time_bucket()` statistische Kennzahlen (Durchschnitt, Min, Max, Anzahl Messungen) über reguläre Zeitintervalle. Ideal für Diagramme und Dashboards!

Query-Parameter:

- `sensor_id` (string, erforderlich): ID der Station.
- `interval` (string, erforderlich): Erlaubte Intervalle: `5 minutes`, `15 minutes`, `30 minutes`, `1 hour`, `3 hours`, `6 hours`, `12 hours`, `1 day`, `7 days`, `1 month`.
- `start_time` (ISO-8601, erforderlich): Startzeitpunkt.
- `end_time` (ISO-8601, optional): Endzeitpunkt.

---

## 📊 Erfasste Umweltparameter & Einheiten

Übersicht über die physikalischen Größen der Multisensor-Stationen:

| Kategorie        | Parameter        | Einheit / Format | Identifikator / Code |
| :--------------- | :--------------- | :--------------- | :------------------- |
| **Klima**        | Temperatur       | °C               | `celsius`            |
| **Klima**        | Luftfeuchtigkeit | % r.F.           | `percent`            |
| **Niederschlag** | Regenmenge       | mm               | `mm`                 |
| **Sonne**        | UV-Index         | Index (0 - 11+)  | `uv_index`           |
| **Luftqualität** | VOC-Index        | Index (0 - 500)  | `voc_index`          |
| **Luftqualität** | NOx-Index        | Index (0 - 500)  | `nox_index`          |
| **Partikel**     | Feinstaub PM2.5  | µg/m³            | `ug/m3`              |
| **Akustik**      | Schallpegel      | dB               | `db`                 |

---

## ⚖️ Open-Data Lizenz & Namensnennung

Die Telemetriedaten werden unter den Bedingungen der **Creative Commons Attribution 4.0 International (CC BY 4.0)** Lizenz bereitgestellt.

Bei Verwendung in Projekten bitten wir um folgende Quellenangabe:

> **„Daten: Open Ried Sens / KAMÜ Kulturzentrum Bürstadt“**

---

**Open Ried Sens** – Eine private Bürgerinitiative mit dem Kulturzentrum **KAMÜ** in Bürstadt.
[Dashboard](https://open-ried-sens.vercel.app/) • [API Data Portal](https://open-ried-sens.vercel.app/daten)
