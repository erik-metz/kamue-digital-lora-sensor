# Daten und Quellen

`/daten` bündelt Downloads und den Link zur FastAPI-Dokumentation. Der kurze
Mitmachblock steht am Anfang; API-Client-Import und Satellitendownloads sind
aufklappbar. Regionale Kataloge, Originalquellen und Erfassungsstatus stehen unter
`/quellen`. Berechnete Datenvolumina aus pauschalen Annahmen werden nicht angezeigt.

## CSV-Pakete

`GET /api/v1/downloads?sample=true` liefert ein ZIP mit zusammengehörigen
`entities.csv`, `measurement_definitions.csv` und `readings.csv`, README und
Manifest. Die Stichprobe enthält bis zu 300 Messgrößen mit je einem zuletzt
gespeicherten Wert und den dazugehörigen Objekten.

`GET /api/v1/downloads?topic=temperature&start=2026-09-01&end=2026-09-30`
exportiert den öffentlichen kanonischen Bestand des gewählten Themas für bis
zu 31 inklusive UTC-Kalendertage. Themen: `all`, `temperature`, `mobility`,
`roadworks`. Temperaturen umfassen auch Boden- und Modellwerte; Basis, Dimensionen
und Qualität bleiben enthalten. Mobilität umfasst skalare Verkehrs-, Park-,
Lade- und Bewegungsdaten, keine vollständigen GTFS-Dateien.

Baustellen/Sperrungen werden als zusätzliche `street_closures.csv` und
`traffic_incidents.csv` exportiert, wenn ihre Gültigkeit den Zeitraum überlappt.
Die Meldungen enthalten ihren zuletzt gespeicherten Stand, keine historische
Versionsfolge. Die drei Kern-CSVs bleiben in jedem Paket enthalten; bei einem
reinen Meldungsexport haben sie gegebenenfalls nur Spaltenüberschriften.

Vollständige Exporte laufen ohne Zeilenlimit über Servercursor in einer konsistenten
Datenbanktransaktion. ZIP-Inhalte werden paketweise gestreamt. Ein abgeschlossenes
Paket enthält `manifest.json` mit `complete: true` und den Zeilenzahlen. Ein
unterbrochener Download muss erneut gestartet werden. Die Browseroberfläche lädt
das ZIP direkt über die native Downloadfunktion, ohne die ganze Datei zuerst
als Blob im Arbeitsspeicher zu sammeln. `check=true` prüft zuvor die Verfügbarkeit
und liefert JSON statt eines ZIPs. Ausgeblendete und gelöschte Stationen werden
gefiltert, Dezimalwerte ohne Float-Konvertierung exportiert.

## Veröffentlichung

Backend mit dem neuen Downloads-Router vor dem Frontend bereitstellen. Die
kanonischen Tabellen und deren bestehende Migration müssen eingerichtet sein;
der Download aktiviert keinen Read-Cutover und startet keinen History-Backfill.
Noch nicht migrierte Daten gehören nicht zum kanonischen Exportbestand.

Die bestehenden UploadThing-Archive sind unabhängige Sensor-Snapshots mit
`measurements.csv` und Stationsmetadaten. Am 5. Oktober 2026 lieferte der öffentliche
Endpunkt `/api/v1/archives` eine leere Liste. Vorhandene Daten allein veröffentlichen
keine Archivdateien. Der Archiv-Worker muss auf dem VPS eingerichtet und ausgeführt
werden; siehe [Archiv-Worker](../www/vps/archive-worker/README.md). Im Rahmen dieses
Seitenumbaus wurden keine Cloud-Archive erzeugt oder auf UploadThing veröffentlicht.

## Prüfung

Frontend: `node --test tests/dataDownloads.test.mjs tests/sources.test.mjs tests/security.test.mjs`,
TypeScript und ESLint für die betroffenen Komponenten.

Backend: `python -m unittest discover -s tests -p test_data_exports.py -v` im
Verzeichnis `www/vps/api/v1`; mit `COLLECTOR_TEST_DATABASE_URL` gegen eine
wegwerfbare lokale PostgreSQL-Datenbank. Die Tests prüfen CSV-Präzision,
Sichtbarkeit, Verknüpfungen, Themen, Gültigkeitsintervalle, Verfügbarkeitsprüfung
und vollständige ZIPs über mehrere Cursor-Batches.
