# Implementierungsplan: Externe Datenquellen & VPS-Kollektoren (Phase 1)
## Streng nach dem Three-Table Core Schema (`entities`, `measurement_definitions`, `readings`)

Dieser Plan beschreibt die Anbindung, Normalisierung und Speicherung externer Datenquellen auf dem **Contabo VPS** (`/www/vps`) von **Open Ried Sens**.

> **Architektur-Vorgabe:**  
> Alle Messdaten und skalaren Beobachtungen werden **ausschließlich** in die drei bestehenden Kern-Tabellen von TimescaleDB geschrieben:
> 1. `entities` (Stationen, Messpunkte, Straßenabschnitte, Feldblöcke, Raster-Zellen)
> 2. `measurement_definitions` (Metrik, Einheit, Quelle, Basis, Dimensionen, Semantik)
> 3. `readings` (Hypertable: Zeitstempel, numerischer Wert, Qualität, Provenienz)
> 
> **Es werden keine separaten Tabellen für einzelne Datenquellen angelegt.** Geometrien, Adressen und statische Eigenschaften verbleiben in `entities.metadata` (JSONB) bzw. bestehenden Helfern.
> *(Satellitendaten folgen in Phase 2. Tierstimmen/Bioakustik ist zurückgestellt. Pitch-Deck-Anpassungen entfallen).*

---

## 1. Übersicht des Core-Mappings

| Datenquelle | `entities.entity_type` | `measurement_definitions.metric` (Beispiele) | Basis & Semantik | `readings.value` & Einheit |
| :--- | :--- | :--- | :--- | :--- |
| **DWD RADOLAN** | `radar_grid_cell` oder `weather_station` | `precipitation` | `basis='observed'`, `semantics='period_total'` | mm / $l/m^2$ |
| **DWD MOSMIX** | `weather_station` (z.B. Mannheim, Worms) | `temperature`, `dew_point`, `wind_speed`, `precipitation_probability` | `basis='model'`, `semantics='instantaneous'` (oder `period_total`) | °C, m/s, %, mm |
| **HLNUG Grundwasser** | `groundwater_station` | `water_level`, `water_depth` | `basis='observed'`, `semantics='instantaneous'` | m (über NN), m (unter Flur) |
| **Verkehrsfluss (TomTom / Zählstellen)** | `road_segment` (z.B. B44, A67) | `speed`, `free_flow_speed`, `delay`, `congestion_ratio` | `basis='observed'`, `semantics='instantaneous'` | km/h, Sekunden, Verhältnis [0..1] |
| **Blitzortung.org** | `monitoring_area` (z.B. Ried 25km) | `lightning_strikes_count`, `peak_current_max` | `basis='observed'`, `semantics='period_total'` | Anzahl, kA |
| **INVEKOS Feldblöcke** | `agricultural_field` | `area`, `latitude`, `longitude` | `basis='reported'`, `semantics='reference'` | ha, deg |
| **OSM Features** | `infrastructure_facility` | `capacity`, `latitude`, `longitude` | `basis='reported'`, `semantics='reference'` | Anzahl, deg |

---

## 2. Detaillierte Mapping-Spezifikation für die 3 Tabellen

### A. DWD Open Data (RADOLAN & MOSMIX)

* **Komponente:** Erweiterung des bestehenden `environment-collector`.
* **Bibliothek:** `wetterdienst` (`pip install wetterdienst[radar]`).

#### 1. Entities
* `id`: `dwd-radolan-buerstadt`, `dwd-radolan-lampertheim` (bzw. Gitterzellen-IDs) sowie `dwd-station-10729` (Mannheim), `dwd-station-10738` (Worms).
* `name`: z.B. *"DWD Radar Gitterzelle Bürstadt"*, *"DWD Station Mannheim"*.
* `entity_type`: `weather_station` bzw. `radar_grid_cell`.
* `metadata`: `{"source": "dwd", "resolution": "1km", "coordinates": {"lat": 49.6425, "lon": 8.4552}}`.

#### 2. Measurement Definitions
* `metric`: `precipitation`
  * `unit`: `mm`
  * `source_id`: `dwd_radolan`
  * `basis`: `observed`
  * `dimensions`: `{"product": "RW", "interval": "60m"}`
  * `semantics`: `period_total`
* `metric`: `temperature`
  * `unit`: `celsius`
  * `source_id`: `dwd_mosmix`
  * `basis`: `model`
  * `dimensions`: `{"forecast_horizon_hours": 1}`
  * `semantics`: `instantaneous`

#### 3. Readings
* `measurement_id`: Entsprechende ID der Definition.
* `observed_at`: Zeitpunkt der Beobachtung bzw. Zielzeitpunkt der Modellvorhersage.
* `period_start` / `period_end`: Für RADOLAN-Stundensummen gesetzt (z.B. 10:00 bis 11:00 UTC).
* `value`: Numerischer Messwert.
* `quality`: `valid`.

---

### B. Hessen Open Data & HLNUG (Grundwasserstände)

* **Komponente:** `environment-collector` (oder `registry-sync-worker`).
* **Quelle:** HLNUG Grundwasserportal / WFS Geoportal Hessen.

#### 1. Entities
* `id`: `hlnug-gw-buerstadt-<station_nr>`
* `name`: *"HLNUG Grundwassermessstelle Bürstadt (Station ...)"*
* `entity_type`: `groundwater_station`
* `metadata`: `{"station_no": "...", "operator": "HLNUG", "municipality": "Bürstadt", "aquifer": "Hessisches Ried"}`

#### 2. Measurement Definitions
* **Pegelstand über NN:**
  * `metric`: `water_level`
  * `unit`: `m`
  * `source_id`: `hlnug`
  * `basis`: `observed`
  * `dimensions`: `{"reference": "masl", "datum": "DHHN2016"}`
  * `semantics`: `instantaneous`
* **Abstand unter Geländeoberkante (Flurabstand):**
  * `metric`: `water_depth`
  * `unit`: `m`
  * `source_id`: `hlnug`
  * `basis`: `observed`
  * `dimensions`: `{"reference": "below_surface"}`
  * `semantics`: `instantaneous`
* **Koordinaten (Latitude / Longitude):**
  * Feste Stationskoordinaten als separate Numeric-Readings mit `semantics='reference'`, wie im Core Contract gefordert.

#### 3. Readings
* Täglicher oder stündlicher Eintrag mit `observed_at` = Messzeitpunkt des HLNUG und `value` = Pegelwert.

---

### C. Verkehrsfluss & Stauvolumen (Optimierung `traffic-collector`)

* **Komponente:** `traffic-collector` (Erweiterung um `traffic_flow.py`).
* **Quelle:** TomTom Traffic Flow API oder Hessen Mobil Dauerzählstellen (B44 / B47 / A67).

#### 1. Entities
* `id`: `road-b44-buerstadt-lampertheim-south`, `road-a67-lorch-buerstadt`
* `name`: *"B44 Bürstadt Süd nach Lampertheim"*
* `entity_type`: `road_segment`
* `metadata`: `{"road": "B44", "direction": "south", "start_junction": "Bürstadt Süd", "end_junction": "Lampertheim Nord"}`

#### 2. Measurement Definitions
* `metric`: `speed` (aktuelle Ist-Geschwindigkeit)
  * `unit`: `km/h`, `source_id`: `tomtom_flow`, `basis`: `observed`, `semantics`: `instantaneous`
* `metric`: `free_flow_speed` (Referenz-Geschwindigkeit bei freier Fahrt)
  * `unit`: `km/h`, `source_id`: `tomtom_flow`, `basis`: `reference`, `semantics`: `reference`
* `metric`: `delay` (Verzögerung / Verlustzeit)
  * `unit`: `s`, `source_id`: `tomtom_flow`, `basis`: `observed`, `semantics`: `instantaneous`
* `metric`: `congestion_ratio` (Stau-Faktor: `current_speed / free_flow_speed`)
  * `unit`: `ratio`, `source_id`: `tomtom_flow`, `basis`: `observed`, `dimensions`: `{"range": "0-1"}`

#### 3. Readings
* Alle 3 bis 5 Minuten ein `reading`-Eintrag je Segment für Geschwindigkeit und Verlustzeit.

---

### D. Blitzortung.org (Live-Gewitterdaten)

* **Komponente:** `environment-collector`.

#### 1. Entities
* `id`: `lightning-zone-ried-25km`
* `name`: *"Blitzüberwachungszone Ried (25 km Radius Bürstadt)"*
* `entity_type`: `monitoring_area`
* `metadata`: `{"center_lat": 49.6425, "center_lon": 8.4552, "radius_km": 25}`

#### 2. Measurement Definitions
* `metric`: `lightning_strikes_count`
  * `unit`: `count`
  * `source_id`: `blitzortung`
  * `basis`: `observed`
  * `dimensions`: `{"interval": "5m"}`
  * `semantics`: `period_total`
* `metric`: `peak_current_max`
  * `unit`: `kA`
  * `source_id`: `blitzortung`
  * `basis`: `observed`
  * `semantics`: `instantaneous`

#### 3. Readings
* Intervallweise aggregierte Anzahl der Entladungen und maximale Stromstärke im Beobachtungsfenster (`period_start`, `period_end`).

---

### E. INVEKOS Feldblöcke & OpenStreetMap

* **Komponente:** `registry-sync-worker`.
* **Besonderheit:** Geometrien (Polygone, Linienzüge) gehören laut Core-Vertrag nicht in `readings`, sondern in `entities.metadata`.

#### 1. Entities
* `id`: `invekos-field-<block_id>`
* `name`: *"Feldblock <block_id>"*
* `entity_type`: `agricultural_field`
* `metadata`: 
  ```json
  {
    "block_id": "DEHE...",
    "main_crop_code": "010",
    "main_crop_name": "Winterweizen",
    "area_ha": 4.85,
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[8.45, 49.64], ...]]
    }
  }
  ```

#### 2. Measurement Definitions & Readings
* Skalare Referenzwerte wie `area` (`unit: ha`, `semantics: reference`) werden als reguläre Messdefinition hinterlegt, sodass sie über die Standard-Measurement-APIs abgefragt werden können.

---

## 3. Implementierungsschritte im Backend

1. **Keine Tabellen-Migration nötig:** Da das Three-Table Schema (`entities`, `measurement_definitions`, `readings`) bereits existiert, werden keine neuen Tabellen via SQL angelegt.
2. **Kollektor-Anpassung:**
   * Jeder Collector (`environment-collector`, `traffic-collector`, `registry-sync-worker`) nutzt die bestehenden Helfer für Ingestion in `entities`, `measurement_definitions` und `readings`.
   * Registrierung der `source_id` in den Sammlungsversuchen (`collection_attempts`), damit das Backend den Live-Status kennt.
3. **Erster Schritt zur Umsetzung:**
   * DWD RADOLAN- und MOSMIX-Normalisierung im `environment-collector` implementieren und direkt in die drei Kern-Tabellen schreiben.

---

## 4. Frontend: Integration in die Datenquellen-Seite (`/quellen`)

Sobald neue Quellen im VPS angebunden sind, müssen diese transparent und nachvollziehbar für die Bürgerinnen und Bürger auf der Datenquellen-Seite (`www/open-ried-sens/app/quellen/`) aufgeführt werden:

1. **Backend-Status-Endpunkt (`/api/v1/collection/status`):**
   * Die neuen Quellen (`dwd-radolan`, `dwd-mosmix`, `hlnug-groundwater`, `traffic-flow`, `blitzortung`, `invekos-agriculture`) melden ihre Status-Snapshots (letzter Abruf, Erfolg, Intervall, Fehler) an den Status-Endpunkt.
2. **Quellen-Metadaten in `QuellenClient.tsx` (`SOURCE_INFO`):**
   * Für jede neue Quelle wird ein Eintrag im Metadaten-Objekt hinterlegt:
     * `title`: z.B. *"DWD RADOLAN Niederschlagsradar"*, *"HLNUG Grundwasserpegel"*
     * `domain`: *"Umwelt & Wetter"*, *"Verkehr"* oder *"Landwirtschaft"*
     * `provider`: *"Deutscher Wetterdienst (DWD)"*, *"HLNUG Hessen"*, etc.
     * `description`: Klare Erklärung, was erfasst wird und warum es für das Ried wichtig ist.
     * `frequencyHint`: z.B. *"stündlich"*, *"alle 5 Minuten"* oder *"täglich"*
3. **Logos & Badges in `SourceLogos.tsx`:**
   * Ergänzung der offiziellen Logos/Icons (DWD-Logo, Hessen-Löwe/HLNUG, TomTom/Open Data) für die Kacheln auf der `/quellen`-Seite.

