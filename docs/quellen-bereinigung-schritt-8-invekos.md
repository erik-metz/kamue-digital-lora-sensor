# Schritt 8: INVEKOS Hessen

Der WFS-Abruf lieferte HTTP 200. Die anschließende Speicherung scheiterte mit `UndefinedFunction`: Python-Fließkommazahlen wurden als `double precision` übergeben, die Funktion `write_measurement` erwartet `numeric`. Fläche und Koordinaten werden nun ausdrücklich als `numeric` gebunden.

Fehlende Flächen werden als fehlend gespeichert; fehlende Bio-Angaben bleiben unbekannt. Referenzjahr und Gültigkeit stammen aus der Quelle. Abrufzeit und fachlicher Datenstand werden getrennt ausgewiesen. Ungültige oder abgeschnittene GeoJSON-Antworten ersetzen keinen veröffentlichten Datensatz. Erfolgreiche Abrufe melden die tatsächlich verarbeiteten Parzellen.

## Prüfung vor Veröffentlichung

- Zwei PostgreSQL-Integrationstests prüfen echte Speicherung, fehlende Werte, Veröffentlichungen und den Schutz vor abgeschnittenen Antworten; zusammen mit dem bestehenden Parsertest: drei Tests erfolgreich.
- Simulation mit der archivierten echten Antwort: 4.877 gelieferte Features, nach bestehendem räumlichem Filter 4.766 Parzellen, 14.298 gespeicherte Messwerte, 10.484,36 ha. Referenzjahr 2025; Bio-Angabe bei allen 4.766 Parzellen unbekannt.
- Gesamter Registry-Testlauf lokal: 256 erfolgreich; ein anderer GTFS-Test benötigt die lokal nicht installierte TimescaleDB-Erweiterung. Der vollständige Lauf wird zusätzlich in der vorgesehenen CI mit TimescaleDB geprüft.
- Ruff für geänderte Python-Dateien und `git diff --check` erfolgreich.

Produktionsprüfung und CI-Ergebnis werden nach Veröffentlichung ergänzt. Deutsche-Bahn-Quellen bleiben übersprungen.
