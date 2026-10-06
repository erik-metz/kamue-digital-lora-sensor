# Ried-Veranstaltungen: Bestandsaufnahme und Umsetzung

Stand: 6. Oktober 2026. Schritt 1 abgeschlossen durch Prüfung des Repositorys.
Die laufende Datenbank und die produktive Anzeige wurden dabei nicht geprüft.
Quellen gelten hier als konfiguriert, nicht als nachweislich erfolgreich importiert.

## Verbindliches Veranstaltungsgebiet

Für diesen Kalender umfasst das Ried die vier bisherigen Projektkommunen:

| Gemeinde | Eingeschlossene Orte |
| --- | --- |
| Bürstadt | Kernstadt, Bobstadt, Riedrode |
| Lampertheim | Kernstadt, Hofheim, Hüttenfeld, Neuschloß, Rosengarten |
| Biblis | Kernort, Nordheim, Wattenheim |
| Groß-Rohrheim | Gemeindegebiet |

Maßgeblich ist der tatsächliche Veranstaltungsort, nicht Vereinssitz,
Quellkalender oder ein Suchradius. Beispielsweise bleibt ein Ausflug eines
Bibliser Vereins nach Heppenheim ausgeschlossen. Außerhalb dieser vier
Gemeindegebiete liegende Veranstaltungen werden nicht aufgenommen.
Unklare Orte werden zur Prüfung zurückgestellt; fehlende Ortsangaben dürfen
nicht automatisch durch den Sitz des Quellanbieters ersetzt werden.
Ortsteile werden ihrer Gemeinde zugeordnet und zusätzlich als Ort erhalten.
Diese Festlegung beschreibt den vereinbarten Projektumfang, keine allgemeine
geografische Definition des Hessischen Rieds.

## Bestehende Datenstrecke

1. `www/vps/registry-sync-worker/sources.json` konfiguriert drei aktive
   Eventquellen mit jeweils sechs Stunden Abrufintervall: `cross7-buerstadt`
   (Kalender 667), `cross7-gross-rohrheim` (Kalender 1106) und
   `lampertheim-events` (kommunaler HTML-Kalender).
2. `adapters.py` schreibt in `cultural_events` und veröffentlicht zusätzlich
   einen aggregierten Datensatz `social/events`.
3. `api/v1/endpoints/collected.py` liefert den gespeicherten Datensatz.
   Daneben existiert der Tabellen-Endpunkt in `social_daily_life.py`.
4. `www/open-ried-sens/lib/regionalStats.ts` fordert `/api/v1/social/events` an;
   der dort als `fetch` importierte Wrapper `collectedBackend.ts` schreibt
   den Pfad jedoch zu `/api/v1/collected/social/events` um.
   `app/statistik/page.tsx` lädt die Events einmal für die Seite;
   `StatistikClient.tsx` filtert diese Daten lokal und reicht sie an
   `EventCalendarWidget.tsx` weiter.

Der statische Katalog `BASELINE_EVENTS` ist nicht der Rückfallpfad dieser
Ladefunktion: Die Anzeige bezieht ihre Events aus der API. Bestehende Tests
des statischen Katalogs belegen daher keine vollständigen Live-Imports.

## Belegte Lücken im Code

| Befund | Folge | Umsetzungsschritt |
| --- | --- | --- |
| Keine aktive Eventquelle für Biblis; keine eigenen Vereins- oder Ortsteilkalender im Event-Manifest | Kleine Feste und offene Angebote haben keine systematische Quelle | 3 und 4 |
| Cross7 liest bis zu 100 Seiten mit je 50 Einträgen; Lampertheim liest lediglich eine HTML-Seite | Lampertheimer Folgeseiten und weitere Zeiträume können fehlen | 2 |
| Beide Importer setzen die Gemeinde anhand der Quelle; keine Prüfung des tatsächlichen Veranstaltungsorts | Auswärtige Veranstaltungen können als lokale Termine erscheinen | 2 bis 5 |
| Lampertheim übernimmt Enduhrzeiten am Startdatum und setzt bei fehlender Uhrzeit 10 Uhr | Mehrtägige bzw. über Mitternacht laufende Termine und unbekannte Zeiten werden unzuverlässig abgebildet | 2 |
| Tabellen-Endpunkt begrenzt standardmäßig auf 100, maximal auf 500 Events; die Statistik nutzt jedoch den separaten Collected-Endpunkt | Diese Begrenzung erklärt keine fehlenden Events auf der Statistikseite; beide API-Verträge getrennt prüfen | 2 und 7 |
| Collected-Standardabruf schließt Termine mit Ende vor der aktuellen Zeit aus; Frontend bietet trotzdem einen Archivfilter | Archivfilter kann nicht alle vergangenen Events anzeigen | 7 |
| Frontend-Zeitfilter verwendet fest `2026-09-17T00:00:00Z` | Kategorien wie kommende Termine und Archiv werden mit veraltetem Stichtag berechnet | 7 |
| Gemeindeauswahl des Statistikbereichs beeinflusst auch den Eventfilter bei Auswahl „alle“ | „Alle“ kann weiterhin nur die ausgewählte Gemeinde zeigen | 7 |
| Kalender erhält `events` statt der nach Orts-, Kategorie- und Suchfiltern eingeschränkten Daten | Kalendermarkierungen und Trefferliste können widersprüchlich sein | 7 |
| Kalender verteilt mehrtägige Events auf höchstens 14 Tage | Längere Angebote werden im Kalender abgeschnitten | 6 und 7 |
| Importer setzen `is_free` pauschal auf wahr | Kostenpflichtige Vereinsangebote können als kostenlos erscheinen | 2 bis 4 |
| IDs basieren auf Quellenkennung bzw. Titel, Datum und Ort; kein quellenübergreifender Abgleich | Dasselbe Fest aus mehreren Quellen kann mehrfach erscheinen | 6 |

Die Seite fängt außerdem einen Fehler ihrer gemeinsamen Datenabfragen ab und
zeigt dann `OfficialStatisticsPage`. Ein fehlender Eventbereich kann deshalb
auch durch eine andere fehlgeschlagene Abfrage verursacht sein. In Schritt 7
sind Datenverfügbarkeit und Darstellung getrennt zu prüfen.

## Geplante Quellen

| Schritt | Quelle | Nutzen |
| --- | --- | --- |
| 2 | Kommunale Kalender Bürstadt, Groß-Rohrheim und Lampertheim | Vollständige Seiten, Zeiträume und Detailangaben |
| 3 | https://www.buergerstiftung-biblis.de/events/monat/ | Vereinsveranstaltungen und offene Angebote in Biblis und Ortsteilen |
| 4 | https://www.xn--tvbrstadt-s9a.de/798-2/ | Brutzelfest, Stadtlauf, Silvesterlauf |
| 4 | https://tv1896hofheim.de/hofheimer-volkslauf/ | Hofheimer Volkslauf |
| 4 | https://www.sg-huettenfeld.de/kerwe/ und https://www.sg-huettenfeld.de/kerwelauf/ | Ortsteilkerwe und Kerwelauf |
| 4 | https://www.kkm-buerstadt.de/kalender-2/ | Vereinsfest, Kerwe-Frühschoppen, Konzerte |
| 4 | https://lampertheim.dlrg.de/aktuelle-termine/ | Kurse und Vereinsangebote; Teilnahmebedingungen prüfen |
| 4 | https://neuschloss.net/termine/ | Lokale Veranstaltungen in Neuschloß |
| 5 | Groß-Rohrheimer PDF-Jahreskalender über Gemeinde bzw. Orts-App | Feste und kleinere Vereinstermine ohne strukturierten Feed |

Quellen und Detailseiten vor ihrer Anbindung erneut prüfen. Ein
Sperrungszeitraum, Veröffentlichungsdatum oder regelmäßig wiederkehrendes
Wochenende allein ist kein bestätigter Veranstaltungstermin. Termine für ein
neues Jahr werden erst nach Veröffentlichung übernommen.

## Ablauf und Abnahme

- [x] 1. Quellen, Filter und Anzeige untersuchen; Gebiet und Lücken festhalten.
- [ ] 2. Kommunale Kalender vollständig und mit belastbaren Orts-/Datumsangaben erfassen.
- [ ] 3. Bürgerstiftung Biblis anbinden.
- [ ] 4. Vereins- und Ortsteilkalender ergänzen.
- [ ] 5. PDF-Jahreskalender ergänzen.
- [ ] 6. Dubletten, Absagen und wiederkehrende Termine behandeln.
- [ ] 7. Importabdeckung und Anzeige gegen recherchierte Beispiele prüfen; dokumentierte Anzeigefehler beheben.

Nach jedem Schritt passende Prüfungen ausführen, die eigenen Änderungen
committen und pushen sowie nur die für diese Pfade vorgesehenen CI-Läufe des
gepushten Commits verfolgen. Danach den Nutzer fragen, ob der nächste Schritt
beginnen soll. Schritt 1 ändert nur diese Dokumentation und aktiviert noch
keine neue Quelle oder Filterlogik.
