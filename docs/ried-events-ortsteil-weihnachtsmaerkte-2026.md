# Hofheim und Hüttenfeld: Weihnachtsmärkte 2026

## Umsetzung

Die neue Quelle `lampertheim-district-christmas-markets` liest die [offizielle Stadtmarketing-Seite](https://www.stadtmarketing-lampertheim.de/stadtmarketing/events/Weihnachtsmaerkte.php) alle sechs Stunden. Der Adapter `verified_christmas_markets.py` übernimmt ausschließlich die zwei im Rechercheschritt bestätigten Ortsteil-Märkte:

| Veranstaltung | Öffnungstag und Ortszeit | Ort |
| --- | --- | --- |
| Howwemer Weihnachtsmarkt | 05.12.2026, 16–21 Uhr | Rund ums Bürgerhaus Hofheim, Lampertheim-Hofheim |
| Howwemer Weihnachtsmarkt | 06.12.2026, 15–19 Uhr | Rund ums Bürgerhaus Hofheim, Lampertheim-Hofheim |
| Hüttenfelder Weihnachtsmarkt | 12.12.2026, 15–21 Uhr | Rund ums Bürgerhaus Hüttenfeld, Lampertheim-Hüttenfeld |

Die zwei Märkte ergeben drei tägliche Kalendereinträge. Damit zeigt der Kalender keine durchgehende Öffnung über Nacht. Stabile Kennungen verhindern zusätzliche Einträge bei wiederholtem Import. Die Originalquelle wird archiviert. Unbekannte Eintrittspreise werden ausdrücklich als unbekannt beschrieben; eine kostenlose Teilnahme wird nicht behauptet.

Die normalisierten Textabschnitte einschließlich Veranstaltungsbereich, Jahreszahl und Öffnungszeiten sind mit SHA-256 an die am 09.10.2026 überprüften Originalangaben gebunden. Fehlende oder doppelte Abschnitte sowie geänderte Angaben brechen den Import ab; die letzte erfolgreiche Veröffentlichung bleibt erhalten. Änderungen an anderen Märkten lösen keine automatische Übernahme zusätzlicher Veranstaltungen aus. Es gibt keine jährliche Fortschreibung.

Die bereits vorhandenen Hauptmarkt-Einträge und der Schlosshofzauber bleiben Gegenstand des gesonderten Korrekturschritts aus [der Adventsrecherche](ried-events-advent-weihnachten-2026-10-09.md).

## Prüfung

Die neue Testsuite prüft die drei unterschiedlichen täglichen Zeitfenster, Ortszuordnung, stabile Kennungen, unbekannte Preise, Jahres-/Datums-/Zeit-/Ortsänderungen, fehlende und doppelte Abschnitte sowie den wiederholten Datenbankimport und den Erhalt der letzten erfolgreichen Veröffentlichung bei Quellenänderungen. Der Parser wurde zusätzlich gegen den frisch abgerufenen vollständigen Original-HTML-Inhalt geprüft.

Der vollständige Worker-Testlauf mit temporärer TimescaleDB war erfolgreich: **431 Tests bestanden** (88,32 Sekunden), einschließlich der neun neuen Adapter- und Datenbanktests. Die Lint-Prüfung der geänderten Python-Dateien sowie `git diff --check` waren erfolgreich. Veröffentlichung und produktive Prüfung werden nach Abschluss ergänzt.
