# Vier veröffentlichte Lampertheimer Festtermine 2027

Umsetzung am 09.10.2026 auf ausdrücklichen Weiterauftrag nach der
[Fundliste](ried-events-weitere-feste-laeufe-2026-10-09.md).

| Veranstaltung | Bestätigte Tage | Veröffentlichter Veranstaltungsbereich | Originalquelle |
| --- | --- | --- | --- |
| Spargelwanderung | 25.04.2027 | Gemarkungen Lampertheim und Bürstadt; konkreter Verlauf noch offen | [Stadt Lampertheim](https://www.lampertheim.de/de/lampertheim/rund-um-spargel/spargelwanderung.php) |
| Spargelfest Lampertheim | 11.–13.06.2027 | Innenstadt Lampertheim | [Stadt Lampertheim](https://www.lampertheim.de/de/freizeit-kultur/veranstaltungen/spargelfest.php) |
| Howwemer Kerb | 10.–14.09.2027 | Festmeile am Alten Rathaus bis Feuerwehrgerätehaus und Gartenstraße, Hofheim | [Stadt Lampertheim](https://www.lampertheim.de/de/freizeit-kultur/veranstaltungen/howwemer-kerb.php) |
| Lampertheimer Kerwe | 11.–13.09.2027 | Römerstraße und Kaiserstraße, Lampertheim | [Stadt Lampertheim](https://www.lampertheim.de/de/freizeit-kultur/veranstaltungen/lambada-kerwe.php) |

Vor Umsetzung wurde die öffentliche Ereignis-API geprüft: 330 Ereignisse,
keiner der vier neuen Termine für 2027 enthalten. Die Prüfung zählt nicht
nur gleiche Titel, sondern gleicht auch Jahr und Veranstaltungsbereich ab.
Die Spargelwanderung erhält eine einzige Veranstaltung mit beiden Städten
im Ortsnamen; keine doppelte Veranstaltung für jeden beteiligten Ort und
keine erfundene genaue Routenführung oder Startadresse.

## Import und Belegprüfung

Vier unabhängige Quellen mit Adapter `municipal-festival-notice`:
`lampertheim-wanderung-festival-notice`,
`lampertheim-spargelfest-festival-notice`,
`lampertheim-howwemer-festival-notice`,
`lampertheim-kerwe-festival-notice`.
Jede Quelle wird alle sechs Stunden abgerufen; maximale Gültigkeit der
Veröffentlichung zwei Tage. Originalantworten werden vor Verarbeitung
archiviert. Veröffentlichung nutzt die bestehende gemeinsame Ereignis-
Speicherung und Dublettenrichtlinie mit erhaltenen Originalquellen.

Der neue Parser ist auf die vier individuell geprüften Ankündigungen
beschränkt. Er prüft die genaue Hauptüberschrift und normalisierte
Text-Hashes der Absätze mit Datum, Ort und gegebenenfalls Programmaussage.
Geänderte, fehlende oder doppelte Belege stoppen vor Veröffentlichung.
Verifizierte Tage sind ausschließlich 2027, verifizierte Veranstaltungs-
bereiche liegen in Lampertheim beziehungsweise bei der Spargelwanderung
in Lampertheim und Bürstadt. Andere kommunale und Vereinsquellen bleiben
unabhängig erhalten. Bei gescheiterter Aktualisierung wird der zuletzt
veröffentlichte Datensatz nicht durch eine erfundene Ersatzangabe ersetzt.

Die veröffentlichten Tage werden mit den bestehenden Tagesgrenzen
00:00–23:59:59 in Europe/Berlin dargestellt. Der Beschreibungstext erklärt
explizit, dass dies Kalendergrenzen und keine Öffnungszeiten sind.
Eintrittspreise und konkretes Programm 2027 sind unbekannt; kein freier
Eintritt zugesagt. Allgemeine traditionelle Eröffnungen um 15:30 bzw.
17:00 Uhr werden nicht zum bestätigten Tagesprogramm 2027 erklärt.
Keine Öffnungszeiten aus 2026 auf die Spargelwanderung 2027 übertragen.

Live-Abruf mit tatsächlichem Collector-User-Agent: alle vier Seiten HTTP
200; Parser bestätigt genau die oben angegebenen vier Datumsspannen.
Keine Frontendänderung erforderlich.

## Lokale Prüfung

383 Worker-Tests mit separater TimescaleDB erfolgreich, darunter 24 neue
Tests zu Datumsspannen, veränderten Belegen, Archivierung, wiederholtem
Import und Zusammenführung identischer Veranstaltungen verschiedener Quellen.
Ruff und `git diff --check` erfolgreich.
