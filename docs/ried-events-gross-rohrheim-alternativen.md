# Groß-Rohrheim: Alternativen zum nicht erreichbaren Jahreskalender

Recherche und direkter Quellenabgleich: 7. Oktober 2026.
Alle genannten Veranstaltungen liegen in Groß-Rohrheim und damit im
vereinbarten Ried-Gebiet. Dieser Schritt dokumentiert die Recherche;
zusätzliche Importquellen wurden bei der Recherche noch nicht aktiviert.
Die anschließend beauftragte Musikkiste-Integration ist unten dokumentiert.

## Sechs datierte Lücken im geprüften Bestand

Der öffentliche Backendbestand lieferte beim Abgleich 110 Groß-Rohrheimer
Einträge einschließlich Archiv. Die folgenden sechs Vorkommen wurden dort
nicht gefunden. Das ist eine Momentaufnahme, kein Anspruch auf Vollständigkeit.
Alle Uhrzeiten sind Ortszeit Europe/Berlin.

| Veranstaltung | Veröffentlichtes Datum | Ort | Primärquelle |
| --- | --- | --- | --- |
| Arbeitsgruppe Senioren, offen für weitere Interessierte | 29.10.2026, 17:00 | Rathaussitzungssaal Groß-Rohrheim | [Gemeindemitteilung in der Orts-App](https://gross-rohrheim.orts.app/-arbeitsgruppen-bei-der-gemeinde-gross-rohrheim_LN6I/nHDc) |
| Vereinsfrühschoppen | 01.11.2026, 10:30 | Bürgerhallen-Gaststätte bei „Eule Andrea“ | [Gemeindemitteilung in der Orts-App](https://gross-rohrheim.orts.app/-arbeitsgruppen-bei-der-gemeinde-gross-rohrheim_LN6I/nHDc) |
| Offene Bühne: Out of the box, Valentina Preziosi, 6over5 | 03.11.2026, 20:00–22:00 | Speisegaststätte Alemannia, Am Sportplatz, Groß-Rohrheim | [Musikkiste – Veranstalterseite](https://www.musikkiste.net/event/offene-buehne-3/) |
| Offene Bühne: Nicefield, De Old-Germany-Walter, NOW, P-Trio | 01.12.2026, 20:00–22:00 | Speisegaststätte Alemannia, Am Sportplatz, Groß-Rohrheim | [Musikkiste – Veranstalterseite](https://www.musikkiste.net/event/offene-buehne-12/) |
| Maimarkt | 22.–23.05.2027; keine Uhrzeit auf dieser Übersicht | Groß-Rohrheim; konkrete Plätze/Uhrzeiten separat bestätigen | [Langfristige Termine der Gemeinde](https://www.gross-rohrheim.de/freizeit-kultur/veranstaltungen/veranstaltungskalender/langfristige-termine) |
| Kirchweih / Rohremer Kerb | 21.08.2027; nur dieser Tag bestätigt | Groß-Rohrheim; Ablauf/Veranstaltungsplätze separat bestätigen | [Langfristige Termine der Gemeinde](https://www.gross-rohrheim.de/freizeit-kultur/veranstaltungen/veranstaltungskalender/langfristige-termine) |

Für die Musikabende bestätigen der direkt abgerufene Feed und die aktuellen
JSON-LD-Daten der Veranstaltungsseiten dieselben Termine. Beide sind als
kostenlos ausgewiesen. Suchmaschinen zeigen unter der November-URL teilweise
noch den alten Termin 04.11.2025; dieser wird nicht übernommen.
Bei anderen Quellen werden fehlende Endzeiten, Preise oder Veranstaltungsorte
nicht aus früheren Jahren abgeleitet. Aus dem Kirchweihtag wird insbesondere
kein mehrtägiges Kerbprogramm für 2027 erfunden.

## Zusätzliche Angebote und Quellen

| Quelle | Gefunden | Eignung / noch zu prüfen |
| --- | --- | --- |
| [Musikkiste – strukturierter Kalender](https://www.musikkiste.net/wp-json/tribe/events/v1/events?start_date=2026-10-07&end_date=2027-03-31&per_page=50) | Zwei bevorstehende Musikabende; Titel, Beginn, Ende, Veranstaltungsort, Preis und Quellen-URL sind strukturiert vorhanden | Erste Wahl für den nächsten Importschritt. Bereits vorhandenen Tribe-Adapter auf dieser Quelle prüfen, Pagination und örtliche Veranstaltungsorte beibehalten. |
| [Langfristige Gemeindeübersicht](https://www.gross-rohrheim.de/freizeit-kultur/veranstaltungen/veranstaltungskalender/langfristige-termine) | Bauernmarkt freitags 14:00–17:00 in der Allee, März–November; außerdem allgemeiner monatlicher Hinweis zur Offenen Bühne | Wiederholungen erst nach Prüfung von Gültigkeitszeitraum und Ausnahmen importieren. Für die Offene Bühne haben aktuelle einzeln datierte Veranstalterdaten Vorrang. |
| [TV Groß-Rohrheim – Zumba](https://tv-grossrohrheim.de/2026/08/30/anmeldung-zumba/) | Kursbeginn Donnerstag, 01.10.2026; Anmeldung angeboten | Angebot belegt, aber für einzelne Folgetermine sind vollständige Kurszeiten, Laufzeit und Ort erforderlich. Kein unbegrenzter wöchentlicher Import aus dem Startdatum. |
| [TC74 Groß-Rohrheim](https://tc74.de/) | Jahresplan 2026 als verlinkte Bilddatei; Orts-App nennt Saisonabschluss 11.10.2026 | Potenzielle ergänzende Vereinsquelle. Jahresplan und aktuelle Details einschließlich öffentlicher Teilnahme und Veranstaltungsort vor Import prüfen. |
| [Heimat- und Geschichtsverein](https://rohrheimer-geschichte.de/) | Veranstaltungsberichte, Arbeitseinsätze und ausdrückliche Absage des Sommerschnittkurses 2026 | Nützlich für einzelne Termine und Absagen; Nachrichten sind keine vollständige strukturierte Jahresliste. |
| [Gemeindlicher Veranstaltungskalender](https://www.gross-rohrheim.de/freizeit-kultur/veranstaltungen/veranstaltungskalender) | Bereits importierte Termine, beispielsweise Nikolausmarkt am 05.12.2026 | Bestehende Quelle weiter nutzen; bekannte Veranstaltungen nicht als neue Funde zählen. |

## PDF-Befund und nächste Schritte

Der aktuell in der Orts-App verlinkte Jahreskalender unter
`/file/1d12216b-e2a3-4520-940c-adb9f90217c6` liefert beim erneuten direkten Abruf
weiterhin HTTP 410. Eine erreichbare Ersatzdatei mit vollständigem Jahreskalender
wurde in dieser Recherche nicht gefunden. Suchmaschinen-Auszüge und
Veranstaltungsaggregatoren ersetzen keine vollständig prüfbare Originalquelle.

Vorgeschlagene Umsetzung in getrennten Schritten:

1. Den öffentlichen Musikkiste-Feed prüfen und als weitere Quelle integrieren;
   die beiden konkret bestätigten Musikabende vollständig bis zur produktiven
   Veröffentlichung nachweisen.
2. Die Gemeindemitteilung zu Arbeitsgruppen/Vereinsfrühschoppen gezielt
   erschließen; fehlende Endzeiten als unbekannt behandeln.
3. Langfristige Festtermine ergänzen, sobald die nötigen Ortsangaben bestätigt
   sind. Wiederkehrende Angebote und bildbasierte Vereinspläne getrennt prüfen.

Der PDF-Schritt bleibt als PDF-Import offen. Die erreichbaren Alternativen
ermöglichen unabhängig davon eine weitere Verbesserung der Ried-Abdeckung.

## Umsetzung: Musikkiste als zusätzliche Importquelle

Die Quelle `musikkiste-gross-rohrheim-events` nutzt den vorhandenen
Tribe-Adapter und die eindeutige ID-Vorsilbe `musikkiste-gr`. Der Abruf erfolgt
alle sechs Stunden für das aktuelle und folgende Kalenderjahr, mit vollständiger
Pagination, Prüfung des tatsächlichen Veranstaltungsortes und Erhalt früherer
Vorkommen. Für die belegten Musikreihen sind exakte Titelzuordnungen zu
`concert` hinterlegt; andere Titel behalten die normale Rubrikzuordnung.

Der vollständige öffentliche Feed liefert aktuell 13 Einträge. Davon werden
zwölf übernommen, einschließlich der Offenen Bühne am 03.11.2026 und
01.12.2026 von jeweils 20:00 bis 22:00 Uhr in der Alemannia, Eintritt frei.
Das ältere Herbstjazz-Konzert bleibt wegen widersprüchlicher Ortsdaten
zurückgestellt: Der Feed nennt Groß-Rohrheim, aber die Postleitzahl `68647`
statt `68649`. Es wird keine ungeprüfte Adresskorrektur vorgenommen.

Die Live-Kette wurde bis zur Veröffentlichung in einer isolierten TimescaleDB
geprüft und veröffentlicht dort zwölf Termine. Neue Regressionstests prüfen
Originaltermine, Preise, Uhrzeiten, Quellenkennungen, fremde/fehlende Orte und
Titelzuordnungen. Ein echter Datenbanktest prüft den vollständigen Import und
seine Wiederholung ohne Duplikate.

Die vollständige Worker-Suite einschließlich aller Datenbanktests besteht:
**217 bestanden, keine übersprungen**. Ruff für die geänderten Python-Dateien
und die Prüfung des Diffs sind erfolgreich.
