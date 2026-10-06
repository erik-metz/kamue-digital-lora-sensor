# Abflussprognosen bei Worms

Dieser Schritt ergänzt den Environment Collector um täglich archivierte
GloFAS-v4-Abflussprognosen über Open-Meteo. Es werden keine zusätzlichen
Datentabellen angelegt. Die Oberfläche liegt unter `/umwelt/abfluss`.

## Quelle und bewusst begrenzte Ortszuordnung

Die öffentliche Flood-API wird ausdrücklich mit `models=forecast_v4`,
`forecast_days=14` und `timezone=UTC` abgefragt. So werden keine historische
Reanalyse und keine monatliche Saisonprognose als Kurzfristprognose übernommen.
Die Modellkennung wurde anhand der offiziellen OpenAPI-Datei und eines realen
Abrufs bestätigt.

Der Referenzpunkt ist 49.63° N / 8.37° E bei Worms. Die Antwort vom 06.10.2026
verwendet die Rasterzelle 49.625° N / 8.375015° E und enthält 98 Werte:
14 Tage × Kontrolllauf und sechs Ensemble-Kennzahlen. Die Auflösung beträgt
ungefähr 5 km. Angefragte und tatsächlich gelieferte Koordinaten bleiben getrennt.

`river_assignment=unverified` wird ausdrücklich gespeichert und angezeigt.
Die Zuordnung zum Rhein wurde nicht gegen das GloFAS-Flussnetz verifiziert.
Zwei weitere Probe-Punkte nahe dem Rhein (49.697/8.391 und 49.755/8.476)
lieferten deutlich andere Abflussgrößen und werden nicht integriert.
Weitere Gewässerpunkte benötigen zuerst eine belegte Zuordnung, etwa anhand
der GloFAS-Flussnetz-/Einzugsgebietsprodukte und eines hydrologischen Abgleichs.
Die Werte bei Worms allein beweisen noch keine korrekte Gewässerzuordnung.

## Zeit, Unsicherheit und Aussage

Die API liefert Tagesdaten, aber weder Modellinitialisierung noch Ausgabezeit.
`generationtime_ms` ist die Dauer der Antworterzeugung und kein Ausgabezeitpunkt.
Daher gilt `provider_issue_time=null`, `forecast_identity=response_snapshot`.
Die tatsächliche Abrufzeit stammt aus dem archivierten HTTP-Beleg.

Der bestehende skalare Vertrag verlangt für `kind=forecast` einen belegten
Ausgabezeitpunkt. Dieser Adapter nutzt deshalb `kind=model` mit
`product_type=forecast`; der generische Filter `kind=forecast` enthält diese
Snapshots nicht. Der Abfluss-Endpunkt liefert sie gezielt. Kein Datum wird
als vermeintlicher Modelllauf erfunden.

- Metrik `river_discharge`, Einheit `m3/s`, Semantik `rate`.
- Tageszeitstempel in UTC, `period_start`/`period_end` begrenzen den UTC-Tag.
  Abflussraten werden nicht zu einer Niederschlags-/Volumensumme umgedeutet.
- Dimension `statistic`: `control`, `mean`, `median`, `min`, `max`, `p25`, `p75`.
  Mittel, Quantile und Extrema beziehen sich auf die Ensemblemitglieder,
  nicht auf verschiedene Stunden des Tages.
- `p25`–`p75` beschreibt die mittleren 50 % der Ensemblewerte, keine garantierte
  Grenze und keine kalibrierte Wahrscheinlichkeit einer lokalen Überflutung.
- Fehlende Werte bleiben `null` mit Qualität `missing`; gelieferte Nullwerte
  bleiben `0` und `valid`. Negative/nicht endliche Werte, falsche Einheiten,
  fehlende Variablen, inkonsistente Quantile oder unplausible Koordinaten
  verhindern die komplette Übernahme.

Die Oberfläche zeigt Abflussprognosen und die ungeprüfte Ortszuordnung. Es
werden keine Pegelstände, Hochwasser-Wiederkehrzeiten, Gefahrenstufen oder
amtlichen Warnungen aus diesen Daten abgeleitet. Bestehende Pegelmessungen
bleiben unabhängig. PEGELONLINE und das Hochwasserportal Hessen sind verlinkt.
Eine automatische Übernahme amtlicher Warnungen ist hier nicht implementiert.

## Archivierung, API und Betrieb

HTTP-Antworten werden unverändert vor dem Parsen in `collected_payloads`
archiviert und über `collection_attempts` belegt. Importprüfung, alle Messwerte
und Erfolgsmarkierung liegen in einer Transaktion; ein Advisory Lock
serialisiert parallele Importe. Entity: `environment:discharge:worms`.

Definition-Dimensionen enthalten den Antwort-SHA-256. Identische Antworten
werden ohne neue Readings oder Revisionen erneut erfolgreich geprüft; neue
Snapshots behalten überlappende Zieltage getrennt. Die Provenienz hält
Modell, Lizenz CC BY 4.0, Attribution Copernicus CEMS GloFAS / Open-Meteo,
Quelle, Rasterreferenz, Abrufbeleg und unbekannten Ausgabezeitpunkt fest.
Historische Snapshots verbleiben im skalaren Archiv.

`GET /api/v1/environment/measurements/discharge` liest nur den letzten
vollständig erfolgreich importierten Snapshot, maximal 10.000 Werte für
heute und die nächsten 13 UTC-Tage. Es mischt keine Prognosestände und
respektiert verborgene Entities. Bei fehlender Messwert-Migration: HTTP 503.
Die API ruft keine externe Quelle synchron ab.

`/umwelt/abfluss` zeigt täglich aufgelöste Werte und Ensemble-Spannen, Abrufzeit,
Rasterkoordinaten und fehlende Werte. Nach mehr als 72 Stunden ohne erfolgreiche
Quellenprüfung wird der Stand als veraltet markiert. Die Collector-Frische
wird unabhängig von Wetter, Pollen, Boden und GBIF geprüft. Fehler nehmen
deren bereits gespeicherte Werte nicht zurück.

Standardmäßig deaktiviert. Vor Aktivierung in der Zielumgebung die vorhandene
additive Messwert-Migration prüfen/installieren:

```sh
python measurement_migration.py install
```

Danach `ENABLE_DISCHARGE_FORECAST=true` setzen und den Environment Collector
aktualisieren. `DISCHARGE_POLL_SECONDS=86400` ist Standard und Mindestintervall.
Dieser Schritt veröffentlicht die Images, aktiviert die Quelle aber nicht
selbst auf dem VPS.

## Prüfungen und Referenzen

`tests/test_discharge.py` prüft die unveränderte Live-Antwort,
Null/Fehlend-Unterscheidung, Statistik- und Zeitachsenvalidierung, Archivbeleg,
Manipulation, Idempotenz, getrennte Snapshots, Rate-/Tagesintervalle,
API-Auswahl, Sichtbarkeit, täglichen Abruf und Fehlerisolation. PostgreSQL-Tests
nutzen ausschließlich eine explizite isolierte `COLLECTOR_TEST_DATABASE_URL`.
Frontend-Tests schützen die Darstellung gegen fehlende, doppelte oder über
Snapshots/Gewässer gemischte Ensemblewerte sowie falsche Einheiten.

- https://open-meteo.com/en/docs/flood-api
- https://github.com/open-meteo/open-meteo/blob/main/openapi/flood.yml
- https://github.com/open-meteo/open-meteo/blob/main/Sources/App/GloFas/GloFasReader.swift
- https://global-flood.emergency.copernicus.eu/
- https://www.pegelonline.wsv.de/
- https://hochwasser.hessen.de/
