# Schritt 25: Amtliche BORIS-Bodenrichtwertzonen

Stand: 10. Oktober 2026. Neue Quelle `hvbg-boris-2024` mit täglichem Abruf,
Adapter `boris-wfs`. Keine Deutsche-Bahn-Anbindungen verändert.

## Verfügbarkeit und Datenstand

Die [HVBG-Dienstübersicht](https://hvbg.hessen.de/geoinformation/geodateninfrastruktur/geoportal-hessen/geodatendienste-im-originaeren-format)
stellt ausdrücklich klar, dass 2026 nicht per WFS bereitgestellt wird; der
neueste dort angebotene Vektordienst ist 2024. [BORIS Hessen](https://hvbg.hessen.de/immobilienwertermittlung/boris-hessen)
bietet 2026 zur Online-Recherche an. Die neue Anbindung importiert deshalb
**historische Werte zum 1. Januar 2024**, keine angeblich aktuellen 2026-Werte.
[Metadaten und Lizenz](https://www.geoportal.hessen.de/spatial-objects/864):
HVBG, Datenlizenz Deutschland – Zero 2.0.

Dienst: `https://www.gds.hessen.de/wfs2/boris/cgi-bin/brw/2024/wfs`, WFS 2.0,
Objektart `boris:BR_BodenrichtwertZonal`, EPSG:4326. Begrenzter regionaler Ausschnitt
49,45–49,90° Nord / 8,25–8,75° Ost; ganze Zonen ohne geometrisches Beschneiden.
Gemeindezuordnung anschließend anhand vollständigem AGS und amtlichem Namen.
Der Ausschnitt enthält Nachbargemeinden, die nicht veröffentlicht werden.

## Ergebnis des vollständigen regionalen Probeabrufs

18 Datenseiten mit insgesamt 1739 Objekten und eine zusätzliche leere
Abschlussseite. 210 Objekte gehören zu den vier gewünschten Gemeinden:

| Gemeinde | Zonen |
| --- | ---: |
| Lampertheim | 100 |
| Bürstadt | 53 |
| Biblis | 41 |
| Groß-Rohrheim | 16 |

Originalwerte in EUR/m², Stichtag, Richtwertnummer, Gemarkung, Nutzungsart,
Entwicklungszustand und Bodenrichtwertart bleiben erhalten. Originalcodes werden
nicht ohne Fachgrundlage umgedeutet. Es werden keine Mittelwerte, Marktpreise,
Angebotspreise oder künstlichen Zonenmittelpunkte erzeugt.

## Verarbeitung und Darstellung

- Jede unveränderte WFS-Antwort wird mit SHA-256 archiviert. Die gemeinsame
  Publikation referenziert ein ausdrücklich gekennzeichnetes Seitenmanifest
  mit Hash, Offset und Anzahl je Seite, einschließlich leerer Abschlussseite.
- Da der Anbieter `numberMatched=unknown` meldet, wird nicht nach einer vermeintlich
  bekannten Gesamtzahl abgebrochen. Seitenweise Abrufe bis zur leeren Seite;
  Wiederholungen, widersprüchliche Seitenzahlen und das Sicherheitslimit führen
  zum Fehler. Fehlende Gemeinden verhindern eine Veröffentlichung.
- EPSG:4326 liefert hier Breite/Länge. GeoJSON verwendet korrekt Länge/Breite.
  Alle Polygonpunkte und Innenringe werden erhalten, ohne Vereinfachung.
  Ungültige Geometrien, Achsen, Preise oder geänderte Stichtage werden abgelehnt.
- Tabelle `realestate/boris` und GeoJSON `map/layers/boris` werden atomar publiziert.
  Fehlerhafte Updates lassen die letzte gültige Veröffentlichung bestehen.
- Der Abschnitt unter „Bauen & Wohnen“ zeigt Originalwerte und historischen
  Stichtag unabhängig von den noch fehlenden übrigen Immobilien-Detailfeeds.
  Quellenansicht nennt HVBG und Stichtag. Keine 2026-Aktualität behauptet.
- Täglicher Abruf prüft Änderungen dieser historischen Ausgabe; neue Ausgaben
  werden nicht stillschweigend übernommen. Ablaufdatum fünf Jahre ab Stichtag,
  nicht fünf Jahre ab wiederholtem Empfang; keine Behauptung heutiger Marktwerte.

## Lokale Prüfungen

Parser/PostgreSQL: 4 Tests plus 6 Fehlerfall-Untertests erfolgreich.
Registry-Regression: 474 Tests und 19 Untertests erfolgreich; der bekannte lokale
GTFS-Migrationstest ohne TimescaleDB wurde gezielt ausgenommen und wird in der
CI mit TimescaleDB geprüft. Ruff erfolgreich. Die 210 echten regionalen
Probeobjekte wurden zusätzlich mit dem Parser verarbeitet.
Frontend: 6 Immobilienprüfungen einschließlich gerenderter historischer Anzeige und
echtem Nullwert, 9 Quellenprüfungen, ESLint und Produktionsbuild einschließlich
TypeScript erfolgreich. React-Prüfung: serverseitige Tabelle, parallele unabhängige
Datenabrufe, stabile IDs, native Details-Bedienung und beschriftete Tabellenspalten.
CI und VPS-Nachweis werden nach Abschluss ergänzt.
