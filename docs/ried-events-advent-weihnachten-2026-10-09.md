# Advents- und Weihnachtsveranstaltungen im Ried: Recherche vom 09.10.2026

## Umfang und Vorgehen

Geprüft wurden Bürstadt, Lampertheim, Biblis und Groß-Rohrheim einschließlich ihrer Ortsteile. Recherche über Suchmaschinen, anschließend Abgleich der Originalseiten mit dem öffentlichen Datensatz `/api/v1/collected/social/events` vom 09.10.2026. Auch Beschreibungen und abweichende Veranstaltungsnamen wurden berücksichtigt. Dieser Schritt dokumentiert Funde; er ändert keine Importer oder produktiven Termine.

## Fehlende Veranstaltungen

Alle Uhrzeiten sind Ortszeit Europe/Berlin. Unbekannte Eintrittspreise und Teilnahmebedingungen werden nicht ergänzt oder als kostenlos ausgegeben.

| Veranstaltung | Bestätigter Termin 2026 | Veranstaltungsort | Originalquelle / offene Angaben |
| --- | --- | --- | --- |
| Howwemer / Hofheimer Weihnachtsmarkt | 05.12., 16–21 Uhr; 06.12., 15–19 Uhr | Rund ums Bürgerhaus Hofheim, Lampertheim | [Stadtmarketing Lampertheim](https://www.stadtmarketing-lampertheim.de/stadtmarketing/events/Weihnachtsmaerkte.php), ausdrücklich „Öffnungszeiten 2026“; Zusammenarbeit des Arbeitskreises Hofheimer Vereine mit dem Stadtmarketing. |
| Hüttenfelder Weihnachtsmarkt | 12.12., 15–21 Uhr | Rund ums Bürgerhaus Hüttenfeld, Lampertheim | [Stadtmarketing Lampertheim](https://www.stadtmarketing-lampertheim.de/stadtmarketing/events/Weihnachtsmaerkte.php), ausdrücklich „Öffnungszeiten 2026“; Veranstalter Pro Hüttenfeld. |
| Weihnachtskonzert der KKM Bürstadt | 13.12.; Beginn und Ende nicht angegeben | St. Michael, Bürstadt | [KKM-Terminkalender](https://www.kkm-buerstadt.de/kalender-2/), Zeile „13.12.2026 Weihnachtskonzert St. Michael“. Keine Uhrzeit aus früheren Jahren übernehmen. Vor Übernahme öffentliche Teilnahme und gegebenenfalls Kartenbedingungen anhand einer aktuellen Veranstalterankündigung absichern. |

Die beiden Ortsteil-Weihnachtsmärkte sind als öffentliche Märkte angekündigt und für einen nächsten Importschritt geeignet. Für Hofheim müssen die beiden unterschiedlichen täglichen Öffnungszeiten erhalten bleiben; die Nacht zwischen den Tagen darf nicht als durchgängige Öffnungszeit erscheinen.

## Bereits vorhanden, aber mit abweichenden Angaben

### Lampertheimer Weihnachtsmarkt in der Kernstadt

Die [städtische Veranstaltungsseite](https://www.lampertheim.de/de/freizeit-kultur/veranstaltungen/weihnachtsmarkt.php) nennt ausdrücklich **03.–06.12.2026 auf dem Schillerplatz**. Das [Stadtmarketing](https://www.stadtmarketing-lampertheim.de/stadtmarketing/events/Weihnachtsmaerkte.php) bestätigt diese Tage, ergänzt die Kaiserstraße ab Hausnummer 21 und nennt:

- Donnerstag, 03.12.: 17–22 Uhr.
- Freitag, 04.12.: 17–22 Uhr.
- Samstag, 05.12.: 14–22 Uhr.
- Sonntag, 06.12.: 14–20 Uhr.

Im vorhandenen Datensatz stehen dagegen zwei aus dem allgemeinen kommunalen Kalender importierte Einträge:

- „Weihnachtsmarkt“, 27.–29.11.2026, Domplatz: [Kalendereintrag](https://www.lampertheim.de/de/veranstaltungen/termine/extern/weihnachtsmarkt_1768206666.php).
- „Weihnachtsmarkt Lampertheim“, 04.–06.12.2026, Domplatz: [Kalendereintrag](https://www.lampertheim.de/de/veranstaltungen/termine/extern/weihnachtsmarkt-lampertheim_1768206725.php).

Dies ist ein Quellenkonflikt. Kein dritter Hauptmarkt wird zusätzlich importiert. Ein eigener Korrekturschritt muss die bestehenden Quellenkennungen berücksichtigen und erneutes Einlesen der widersprüchlichen Angaben verhindern. Die übereinstimmenden spezifischen Seiten von Stadt und Stadtmarketing liefern die belegten aktuellen Angaben.

### Neuschloß: Weihnachtsmarkt / Schlosshofzauber

Das [Stadtmarketing](https://www.stadtmarketing-lampertheim.de/stadtmarketing/events/Weihnachtsmaerkte.php) nennt den Weihnachtsmarkt im Schloßhof am **28.11., 15–22 Uhr**, und **29.11., 13–19 Uhr**.

Der Datensatz enthält bereits **„Schlosshofzauber“**, ID `la-5f7e631049`, mit Beschreibung „Weihnachtsmarkt in Neuschloß“, Zeitraum 28.–29.11.2026 und Ort „Neuschloß – Forsthausstraße“: [kommunale Originalquelle](https://www.lampertheim.de/de/veranstaltungen/termine/extern/schlosshofzauber_1786955182.php). Damit kein fehlender zusätzlicher Markt. Der gespeicherte Gesamtzeitraum endet am Sonntag um 22 Uhr Ortszeit; die Stadtmarketing-Seite nennt sonntags 19 Uhr. Tägliche Öffnungszeiten und Veranstaltungsort bei einer späteren Korrektur abgleichen, keine Dublette erzeugen.

## Bereits abgedeckte weitere Adventstermine

Der Abgleich zeigt unter anderem den Bürstädter Weihnachtsmarkt am 04.–06.12., den Bibliser Weihnachtsmarkt am 28./29.11., das BlechPur-Adventskonzert in Biblis am 05.12., den Nordheimer Weihnachtsmarkt am 06.12., den Wattenheimer Weihnachtsmarkt am 12.12., den Groß-Rohrheimer Adventsmarkt am 27.11., den Nikolausmarkt am 05.12. und „Advent im Kirchgarten“ am 11.12. Diese werden nicht erneut als neue Funde importiert.

Vereinsweihnachtsfeiern mit ungeklärtem Teilnehmerkreis und als „in Planung“ bezeichnete Konzerte gelten nicht automatisch als bestätigte öffentliche Veranstaltungen. Suchtreffer aus 2025, insbesondere der Lampertheimer Adventsflyer 2025, belegen keine Termine für 2026. Beim Nikolausreiten in Groß-Rohrheim am 06.12.2026 nennt der kommunale Jahreskalender zwar Datum und Verein, aber keinen eindeutigen Veranstaltungsort oder Beginn; daraus wird noch kein vollständiger Importvorschlag abgeleitet.

## Nächste getrennte Schritte

1. Die zwei fehlenden öffentlichen Weihnachtsmärkte in Hofheim und Hüttenfeld mit belegten täglichen Öffnungszeiten anbinden und gegen Dubletten prüfen.
2. Den Quellenkonflikt beim Weihnachtsmarkt der Kernstadt sowie die Sonntagszeit des Schlosshofzaubers gezielt korrigieren.
3. Eine aktuelle öffentliche KKM-Konzertankündigung und die fehlenden Angaben zum Groß-Rohrheimer Nikolausreiten suchen.

## Prüfung und Veröffentlichung

Originalquellen und bestehende Veranstaltungsdaten abgeglichen; `git diff --check` geprüft. Ausschließlich Dokumentation: Die Pfadfilter von `Frontend CI` und `FastAPI & Docker CI/CD` sehen für diese Datei keinen Lauf vor. Keine VPS- oder GHCR-Änderung.
