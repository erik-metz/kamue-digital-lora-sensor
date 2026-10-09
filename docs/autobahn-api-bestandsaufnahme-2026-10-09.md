# Autobahn-API: Bestandsaufnahme für das Ried, Schritt 1

Live-Prüfung am 09.10.2026, 19:19 Uhr Europe/Berlin. Geprüft wurden die allgemeine Straßenliste, sämtliche sechs Datentypen auf A67, A5 und A6 sowie zehn regionale Detailstichproben. Alle 29 Requests lieferten HTTP 200. Die Quelle war erreichbar; die früheren lokalen DNS-Fehler waren kein Nachweis eines Anbieterausfalls.

## Quellen und Nachweis

- Basis: https://verkehr.autobahn.de/o/autobahn/
- Listen: `/{road}/services/{category}`
- Details: `/details/{category}/{identifier}`, Kennung URL-kodiert.
- Dokumentation: https://github.com/bundesAPI/autobahn-api/blob/main/openapi.yaml
- [Maschinenlesbare Bestandsaufnahme](evidence/autobahn-api-2026-10-09/inventory.json): Abrufzeiten, URLs, Status, Zählungen, Feldinventar, regionale Datensätze ohne deren Liniengeometrien sowie unveränderte vollständige Listen- und Detailstichproben. Zusätzliche vollständige Stichproben dokumentieren zukünftige Ereignisse. Außerregionale Datensätze sind nicht archiviert; die Gesamtzahlen stammen aus den vollständigen Live-Antworten.

Der allgemeine GET lieferte ausschließlich Autobahnbezeichnungen. B44/B47 werden deshalb in dieser Integration nicht als belegte Quellen geführt und wurden nicht abgefragt. Ihre Erfassung bleibt bei anderen vorhandenen Verkehrsquellen. Auffällig in der Straßenliste: `A60` und `A60 `; Kennungen künftig trimmen und deduplizieren. Auch `A64a` und `A99a` kommen vor; die aktuelle Collector-Validierung deckt solche Bezeichnungen nicht ab, was A67/A5/A6 nicht betrifft.

## Regionale Vorauswahl

Die Zählung verwendet die bestehende Collector-Bounding-Box: Breitengrad 49.45–49.90, Längengrad 8.25–8.75, Grenzen eingeschlossen. Geprüft wurde der gemeldete Standort bzw. Startpunkt. Das ist eine breite Vorauswahl des Rieds mit Anschlussräumen, keine abgeschlossene fachliche Korridorzuordnung. Insbesondere Büttelborn, südliche A5-Rastplätze und westliche A6-Punkte benötigen diese Zuordnung.

Bei Linienereignissen können zusätzliche gebietsquerende Abschnitte mit außerhalb liegendem Startpunkt relevant sein. Die Zahlen unten sind ausdrücklich **Startpunkt-/Standorttreffer**, keine vollständige Schnittmengenanalyse. Eine spätere räumliche Linienprüfung muss sowohl Punkte im Gebiet als auch durchquerende Segmente erkennen. Ein `extent` darf nicht als genaue Straßenlinie interpretiert werden.

## Abdeckungsmatrix

Angabe: regionale Punktetreffer / gesamte Antwort für diese Autobahn. Es handelt sich um Datensätze, nicht automatisch eindeutige Standorte oder aktuell wirksame Störungen.

| Datentyp | A67 | A5 | A6 | Regionale Summe |
| --- | ---: | ---: | ---: | ---: |
| Verkehrsmeldungen (`warning`) | 0 / 0 | 0 / 3 | 0 / 0 | 0 |
| Baustellen (`roadworks`) | 11 / 13 | 12 / 108 | 22 / 120 | 45 |
| Sperrungen (`closure`) | 3 / 3 | 0 / 12 | 7 / 22 | 10 |
| Webcams (`webcam`) | 0 / 0 | 0 / 0 | 0 / 0 | 0 |
| Rastplätze (`parking_lorry`) | 9 / 11 | 14 / 100 | 3 / 90 | 26 |
| Ladeeinrichtungen (`electric_charging_station`) | 8 / 8 | 3 / 40 | 0 / 28 | 11 |

Alle 18 Listenantworten enthielten die erwartete Liste. Null Treffer bedeutet nur: beim dokumentierten Abruf kein entsprechender Datensatz. Es bedeutet weder dauerhaft fehlende Abdeckung noch bestätigte freie Fahrt.

## Ereignisse: hoher Nutzen, bestehende Auswertung verbessern

Von 45 regionalen Baustelleneinträgen waren 13 als `future: true` markiert, von zehn Sperrungen acht. Insgesamt sind somit **21 der 55 Ereignisdatensätze als zukünftig markiert**. Ein Beispiel ist die Anschlussstellensperrung am Griesheimer Dreieck mit Beginn 16.10.2026, 21:00 Uhr und angekündigtem Ende 26.10.2026, 05:00 Uhr.

Listen liefern bereits `startTimestamp`, `future`, `display_type`, `impact`, Beschreibung und GeoJSON-Linien. Die Detailstichproben ergänzen unter anderem `delayTimeValue`, `averageSpeed`, `abnormalTrafficType` und `source`; vorhandene Felder sind dabei häufig `null`. Feldexistenz ist kein Nachweis nutzbarer Geschwindigkeits- oder Verzögerungsmessungen. Ein flächendeckender Detailabruf ist deshalb nicht begründet.

Die Beschreibungen trennen den Zeitraum der Bauphase und das Ende der Gesamtmaßnahme. Diese Termine müssen getrennt gespeichert werden. Die neue Terminvariante `Beginn: 04.10.26 um 20:00 Uhr` benötigt ebenfalls einen passenden Parser. `startTimestamp` ist vorzuziehen; fehlende Anbieterzeiten bleiben unbekannt.

Konkrete Befunde im vorhandenen `traffic-collector/normalize.py`:

- `future` und `startTimestamp` werden nicht in das normalisierte Modell übernommen. Zukünftige Maßnahmen können daher in die Verarbeitung aktiver Ereignisse gelangen. Vorrangig fachlich korrigieren.
- `closure` wird pauschal als `standstill` klassifiziert. Das unterscheidet eine Anschlussstellensperrung nicht von einer gesperrten Hauptfahrbahn.
- Die Richtung wird aus abgeleiteten Von-/Bis-Feldern gebildet; das unmittelbar vorhandene Richtungsfeld `subtitle` wird nicht als eigenes Richtungsfeld erhalten.
- `Länge: 1.33 km` einer Baumaßnahme wird vom auf `km Stau` ausgelegten Längenparser nicht erfasst. Maßnahmenlänge und Staulänge brauchen unterschiedliche Bedeutungen.
- Ortsnamen in Richtungsbeschreibungen können den räumlichen Filter übersteuern. Ein entferntes Ereignis mit Ziel Mannheim darf dadurch nicht automatisch zum Ried-Ereignis werden.

In den echten Antworten verwenden `coordinate` und GeoJSON `geometry` unterschiedliche Darstellungen. Außerdem stehen `point` und `extent` bei den geprüften Baustellen in einer von der Dokumentation abweichenden Reihenfolge: etwa `49.79599,8.56729`, während GeoJSON korrekt `[8.56729,49.79599]` verwendet. Deshalb explizites `coordinate.lat/long` bzw. GeoJSON bevorzugen und diese Zeichenketten nicht blind interpretieren.

## Rastplätze: 26 regionale Kandidaten

Beispiele: Lorsch W/O, Wildbahn, Forsthaus, Jägersburger Wald und Pfungstadt O/W an der A67; Bergstraße O, Alsbach W, Nachtweide und Rolandshöhe an der A5. Die drei A6-Kandidaten heißen Dirmsteiner Pfad, Rennschlag und Linsenbühl und sind als Anschlussraum fachlich zuzuordnen.

Wesentliche Schemaabweichung: `coordinate` ist hier selbst ein GeoJSON-Punkt, z. B. `{"type":"Point","coordinates":[8.552061,49.643301]}` für Lorsch W. Ein ausschließlich auf `lat/long` ausgelegter Parser würde alle Rastplätze verwerfen.

- Namen aus `subtitle` verwenden: die geprüften Titel enthalten `A67 | undefined` bzw. entsprechende andere Straßen. Auch der Footer enthält `Koordinaten: undefined`.
- Lorsch W meldet 26 Pkw- und 32 Lkw-Stellplätze. Das sind Kapazitäten, keine freien Plätze.
- Null gemeldete Pkw-Kapazität nicht eigenständig als fehlenden Wert umdeuten; ursprüngliche Anbieterangabe erhalten.
- Ausstattungslisten in den regionalen Datensätzen gesondert auf tatsächliche Befüllung prüfen; ein leeres Array ist kein Nachweis fehlender Toiletten.
- Zehn geprüfte regionale Details insgesamt lieferten keine Grundlage für Live-Belegung.

Empfehlung: Standort-/Kapazitätsinventar, täglicher Abruf und Historie bei Änderungen. Erst mit einer echten Belegungsquelle entstehen Zeitreihen zur Auslastung.

## Ladeeinrichtungen: elf regionale Datensätze

A67: Lorsch West/Ost, Pfungstadt West/Ost und Büttelborn Süd. A5: Bergstraße Ost und Alsbach West. Mehrere Anbieterkennungen liegen an derselben Raststätte; elf Datensätze sind deshalb nicht elf verschiedene Standorte und nicht elf einzelne Ladepunkte.

Leistungen und Anschlüsse stehen als Textblöcke in `description`. Beispiele enthalten 300-kW-DC-Ladepunkte, 43-/50-kW-Kombinationen und einen mit 4 kW gemeldeten Typ-2-Punkt. Solche Werte sind Anbieterangaben ohne belegte Aktualisierungszeit; ungewöhnliche oder möglicherweise ältere Werte nicht automatisch korrigieren.

Empfehlung: In die vorhandene Ladeinfrastruktur-Pipeline integrieren, Kennungen und Originalbeschreibung erhalten, Ladepunkte strukturiert extrahieren und Standortgruppen vorsichtig abgleichen. Gegenüberliegende Fahrtrichtungen und verschiedene Ladeangebote an einer Raststätte bleiben unterscheidbar. Preise und Live-Verfügbarkeit konnten nicht belegt werden. Vorläufig täglich abrufen und Änderungen historisieren.

## Webcams: Bildarchiv derzeit nicht mit dieser Quelle belegbar

Die drei geprüften Autobahnen lieferten jeweils HTTP 200 mit `{"webcam":[]}`. Damit gibt es im geprüften Umfang weder regionale Bild-URLs noch Stream-URLs. Bildformat, Bildzeitstempel, Cache-Header, tatsächliches Aktualisierungsintervall und Änderungsrate konnten nicht geprüft werden. Das sagt nichts über andere Kameraanbieter oder zukünftige API-Bestände aus.

Das Produktziel ist eine **spätere Auswertung gespeicherter Bilder auf dem VPS**, keine Webcam-Anzeige. Ein Bildarchiv wird erst implementiert, sobald eine geeignete regionale Bildquelle vorliegt. Dann zuerst eine begrenzte Probe:

1. Snapshot-URL gegenüber Stream unterscheiden; verfügbare Bild- und HTTP-Zeitangaben erfassen.
2. Beispielsweise zwölf Abrufe über zwei Minuten mit zehn Sekunden Abstand vergleichen. Hashes zeigen tatsächliche Bildwechsel; Abrufzeit ersetzt keinen belegten Aufnahmezeitpunkt. Die kurze Probe beweist noch keine dauerhafte Bildrate.
3. Abrufintervall, Nutzungs-/Speicherbedingungen, mittlere Dateigröße und Verfügbarkeit bestimmen.
4. Für das Archiv Kamera-ID, Quelle, Abrufzeit, optional Aufnahmezeit, Hash, Dateityp, Größe und Speicherpfad vorsehen. Bilder als Dateien/Objekte speichern, Metadaten und später abgeleitete Messwerte in PostgreSQL.
5. Unveränderte Bilder deduplizieren, getrennte Abrufprotokolle behalten, Aufbewahrung und Speicherlimit festlegen. Spätere Auswertungen mit Modellversion und Qualität kennzeichnen.

Planungsrechnung, keine gemessenen Größen: Bei 200 kB je Bild und zehn Sekunden Abstand entstehen 8.640 Bilder bzw. rund 1,73 GB pro Kamera und Tag; zehn Kameras benötigen vor Deduplizierung rund 518 GB für 30 Tage. Ein zehnsekündiger Bildabruf ist erst sinnvoll, wenn die Quelle entsprechend häufig neue Bilder liefert. Ein Stream benötigt einen zusätzlichen Decoder-/Extraktionsschritt; den Aufwand erst bei einer konkreten Quelle bewerten.

## Nächste Umsetzung

1. Zukünftige/aktuelle Ereignisse, Bauphasen, Sperrungsarten, Richtung und unbekannte Verzögerung korrekt modellieren. Mit den gesicherten echten Antworten testen.
2. Ladeeinrichtungen in die vorhandene Infrastruktur-Pipeline integrieren, anschließend Rastplatzinventar ergänzen. Beide Quellen liefern bereits nachweislich regionale Daten.
3. Webcam-Metadaten bei Bedarf in einem langsamen Discovery-Lauf erneut prüfen; Bildarchiv bleibt bis zu einer belegten Quelle zurückgestellt. Kein zehnsekündiger Abruf leerer Listen.
4. B44/B47 weiter über die dafür vorhandenen Quellen behandeln. Keine zugesicherte Bundesstraßenabdeckung aus der Autobahn-Spezifikation ableiten.

## Prüfung und Umfang

Die gespeicherte Evidenz wurde auf 18 erfolgreiche Listen, zehn erfolgreiche Detailantworten, passende regionale Inventarlängen und 92 regionale Kandidatendatensätze geprüft. Die 21 zukünftigen Ereignisse sind Teil dieser 92 Kandidaten. Der Nachweis ist eine zeitpunktbezogene Bestandsaufnahme und keine mehrtägige Verfügbarkeitsmessung.

Nur Dokumentation und Evidenz werden geändert. Kein produktiver Collector, keine Datenbank, kein VPS-Dienst und kein Frontend werden in Schritt 1 verändert. Die Pfadfilter von `ci.yml` und `frontend.yml` sehen für diese Dokumentationspfade keine Läufe vor; VPS-/GHCR-Prüfungen sind nicht erforderlich.
