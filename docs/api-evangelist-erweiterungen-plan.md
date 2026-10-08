# API-Evangelist: weitere Datenquellen für das Ried

Stand: 8. Oktober 2026. Umfang: ECOSTRESS, NASA FIRMS, iNaturalist und SolarEdge. Die bereits umgesetzten Integrationen bleiben Grundlage. Nach jedem Schritt wird der Nutzer gefragt, bevor der nächste beginnt.

## Reihenfolge und Abschlusskriterien

| Schritt | Ergebnis | Status |
| --- | --- | --- |
| 1 | Verfügbarkeit, Gebiet, Zugänge und Datenverträge prüfen | Abgeschlossen für öffentliche Vorprüfung; authentifizierte Daten offen |
| 2 | ECOSTRESS: Oberflächentemperatur als echte Rasterdaten | Abgeschlossen: authentifizierter Rasterimport, Kalibrierung, API, Karte und Export produktiv geprüft |
| 3 | FIRMS: satellitengestützte thermische Anomalien | Offen |
| 4 | iNaturalist: zusätzliche Artenbeobachtungen | Offen |
| 5 | SolarEdge: tatsächliche Erzeugung teilnehmender PV-Anlagen | Offen, Anlagenzugang erforderlich |
| 6 | Gemeinsame Betriebsprüfung und Dokumentation | Offen |

Ein Quellenschritt umfasst Collector, Archivierung, API, verständliche Anzeige, passende Tests und Veröffentlichung. Fehlende Zugangsdaten werden als konkrete Blockade dokumentiert; eine vorbereitete Integration zählt nicht als produktiv verfügbare Datenquelle.

## Schritt 1: geprüfte Machbarkeit

Die öffentliche Prüfung verwendete dieselbe rechteckige Region wie die bestehende Satellitenintegration: WGS84 `[8.33, 49.54, 8.58, 49.75]` in der Reihenfolge West, Süd, Ost, Nord. Dies ist keine Gemeindegrenze. Maschinenlesbare Anfrageadressen und Ergebnisse stehen in [der Prüfevidenz](evidence/2026-10-08-api-evangelist-discovery.json).

Für ECOSTRESS `ECO_L2T_LSTE` wurden zwischen 1. Juni und 8. Oktober 2026 insgesamt 370 Katalogtreffer der Bounding-Box-Abfrage der Version 003 gefunden, gegenüber 273 der Version 002. Der vollständige Liveabruf zeigte später einzelne falsche Gebietstreffer durch nahezu globale Bounding Boxes von Kacheln an der Datumsgrenze. Der Collector filtert deshalb zusätzlich auf 32UMA/32UMV; die Katalogzahlen sind keine reine Ried-Aufnahmezahl. Version 003 wird daher als Ausgangspunkt gewählt. Die neuesten abgefragten Kacheln 32UMA und 32UMV stammen vom 6. Oktober 2026, 13:11 UTC. Dies sind Kachel-Metadaten, keine 370 unabhängigen Überflüge und kein Nachweis wolkenfreier Pixel. Geschützte Temperatur-, Qualitäts-, Wolken- und Wasserraster sind im Katalog verlinkt; ihr authentifizierter Download wurde in Schritt 2 geprüft.

iNaturalist meldete 1.728 Beobachtungen für öffentliche, nicht verschleierte Positionen und die ausgewählten Lizenzen CC0, CC BY und CC BY-SA. Ein Datensatz wurde als Stichprobe abgefragt. Die Zahl belegt weder 1.728 zusätzliche GBIF-freie Beobachtungen noch eine gleichmäßige räumliche Abdeckung.

FIRMS und SolarEdge wurden anhand der Anbieterunterlagen eingeordnet. Für FIRMS fehlt ein MAP_KEY, für SolarEdge fehlen eine konkrete teilnehmende Anlage, deren Zustimmung und der passende API-Zugang. Der Earthdata-Zugang für ECOSTRESS wurde während Schritt 2 eingerichtet.

## Schritt 2: ECOSTRESS

1. Den bestehenden `registry-sync-worker` um eine getrennte Quelle erweitern. NASA CMR nach Collection, Version, Gebiet und Aufnahmezeit durchsuchen; paginieren, wiederholte Kachelimporte anhand stabiler Granule-IDs verhindern und Zeitfenster begrenzen.
2. Einen geschützten Download mit sicher hinterlegtem Earthdata-Zugang ermöglichen. Die produktbezogenen Metadaten und Qualitätsdefinitionen der Version 003 vor der Verarbeitung prüfen. HTTP-Zugänge, Weiterleitungen und Fehler dürfen keine Zugangsdaten in Logs oder Archiven veröffentlichen.
3. LST, QC und erforderliche Masken lesen, auf das Gebiet zuschneiden und gültige Pixel bestimmen. Einheiten, Skalierung und NoData aus dem Produktvertrag prüfen; Celsius nur nach korrekter Umrechnung liefern. Native Auflösung von ungefähr 70 m erhalten. Sentinel-Kachelnamen bedeuten keine identischen Pixelraster. Wolken, Wasser und ungültige Pixel gemäß dem gewählten Auswerteprofil behandeln.
4. Raster mit Aufnahmezeit, Produktversion, Granule-ID, CRS, räumlicher Abdeckung und Qualitätsanteilen archivieren. Die vorhandene Satelliten-API und Kartenanzeige um eine eigene Temperaturschicht, Datumsauswahl, Legende und Download erweitern. Die Größe bezeichnet Oberflächentemperatur; die Beschriftung darf daraus keine Lufttemperatur oder unmittelbar vergleichbaren Tagestrend machen.
5. Zunächst höchstens zwei Szenen je Lauf verarbeiten; bestehende Größen- und Pixelgrenzen überprüfen. Große Quelldateien über begrenzte Downloads bzw. geeignete Rasterfenster behandeln. Metadaten täglich aktualisieren, Raster nur bei neuen Szenen importieren. Archivaufbewahrung und Gesamtspeicherbudget vor Aktivierung festlegen.

Abnahme: Tests für Skalierung, Masken, NoData, Grenzen, Wiederholung und fehlenden Zugang; mindestens ein echter authentifizierter Import mit nachvollziehbaren gültigen Pixeln; API, Karte und Export beziehen sich auf dieselbe Aufnahme. Bei vollständig maskierter Szene wird der leere Befund korrekt angezeigt. Relevante Backend-/Frontend-Prüfungen, CI und bei VPS-Änderungen GHCR-Veröffentlichung erfolgreich; anschließend Produktionsprüfung.

### Umsetzungsstand am 8. Oktober 2026

Collector, begrenzter authentifizierter Rasterdownload, native Temperatur-/Qualitätsauswertung, Archiv, API, Download und Temperaturrenderer mit Aufnahmeauswahl und Legende sind implementiert. API und Registry-Worker sind auf der VPS aktualisiert; ihre ECOSTRESS-Dateihashes stimmen mit dem geprüften Code überein. Der echte öffentliche Import hat 48 lokale Kacheleinträge aus den ersten 60 CMR-Treffern gespeichert. Die öffentliche API und der Regionalatlas zeigen die 20 neuesten Einträge. Nach Einrichtung des Earthdata-Tokens wurden fünf echte Rasterausschnitte archiviert. Vier enthalten gültige Landpixel; eine Aufnahme ist nach Qualitäts-/Wolkenmaskierung ein gültiger leerer Befund. Die neuesten NASA-V003-Dateien sind Float32-Kelvin mit Skalierung 1, Offset 0 und nativem 70-m-Raster in EPSG:32632. Der Ausschnitt 32UMA vom 6. Oktober, 13:11 UTC, enthält 63.693 gültige Landpixel bei 76.238 überdeckten AOI-Pixeln (83,54 %), im Mittel 28,446 °C. Dieser Wert beschreibt nur die gültige Teilfläche dieser Aufnahme.

13 Raster-/Datenbanktests einschließlich sichtbarer Pixel, Transparenz, Archivdownload und Datumsgrenzen-Filter bestehen; 215 Frontend-Tests, Lint, TypeScript und Frontend-Build ebenfalls. [Frontend CI für den Karten-Commit 6cef01f](https://github.com/erik-metz/kamue-digital-lora-sensor/actions/runs/37738667014) ist erfolgreich. [Backend CI für den Korrekturcommit fa5daaf](https://github.com/erik-metz/kamue-digital-lora-sensor/actions/runs/37739797636) ist erfolgreich: 16 Jobs einschließlich aller 17 vorgesehenen GHCR-Container-Builds und Veröffentlichungen.

Der authentifizierte Import ist abgenommen. Der reguläre Worker verwendet die veröffentlichte Korrektur; sein Downloader-Dateihash stimmt mit dem geprüften Code überein, und der reguläre Import ohne Testüberschreibung meldet `success`. Archivhash und NPZ-Download stimmen überein, die Karten-API liefert sichtbare Pixel und die Produktionsseite zeigt dieselbe Szene, Temperaturstatistik, Legende und geladene Temperaturkacheln. NASA liefert eine signierte HTTP-303-Weiterleitung über einen fest geprüften CloudFront-Host; der Downloader folgt genau dieser ohne Bearer-Header oder Cookies und unterdrückt signierte URL-Logs. Fremde/weitere Weiterleitungen bleiben gesperrt. Ein vorübergehender NASA-502-Abruf gelang bei Wiederholung. Wiederholungen übernehmen vorhandene Archive; nur zwei neue Ausschnitte pro Lauf werden importiert. Drei Archive belegen zusammen 328.147 Bytes, der laufende Worker etwa 355,5 MiB nach den Testimporten (keine Messung des Spitzenverbrauchs). 14 Raster-/Datenbanktests einschließlich der neuen Weiterleitungsprüfung bestehen. [Backend CI für 6ac3f17](https://github.com/erik-metz/kamue-digital-lora-sensor/actions/runs/37769558893) ist erfolgreich: alle 16 Jobs und 17 vorgesehenen GHCR-Veröffentlichungen. [Maschinenlesbare Rasterevidenz](evidence/2026-10-08-ecostress-authenticated-import.json) enthält keine Zugangsdaten. Schritt 2 ist abgeschlossen; der begrenzte tägliche Nachimport weiterer Kacheln bleibt regulärer Betrieb. Der Token läuft nach 60 Tagen ab und muss erneuert werden. Schritt 3 wurde nicht begonnen. Betriebsdetails: [ECOSTRESS.md](../www/vps/registry-sync-worker/ECOSTRESS.md).

## Schritt 3: NASA FIRMS

1. Kostenlosen MAP_KEY einrichten und eine regionale CSV-Abfrage mit dokumentierter Quelle, zunächst `VIIRS_NOAA20_NRT`, implementieren. Abfragefenster auf die dokumentierten 1–5 Tage begrenzen; historische Nachimporte gesondert planen. Landsat-NRT ist für dieses Gebiet nicht geeignet.
2. Satellit, Instrument, Position, Erfassungszeit, Konfidenz, Fire Radiative Power und Kennung archivieren. UTC korrekt aus Datum/Uhrzeit bilden, providerabhängige Konfidenzwerte getrennt behandeln und doppelte Abrufe vermeiden. Meldungen verschiedener Satelliten nicht ohne fachliche Regel zu einem Ereignis zusammenlegen.
3. Regionale API und Kartenpunkte mit Zeitfilter, Herkunft und Download ergänzen. Beschriftung: thermische Anomalie; kein bestätigter Brand und keine Warnfunktion. Ein erfolgreich leerer Abruf ist ein eigener Zustand gegenüber einem API-Fehler.
4. Anfangs stündlich abrufen, Transaktionsgrenzen respektieren und bei Fehlern verzögert wiederholen. Der MAP_KEY steht im URL-Pfad: auch Fehlertexte, HTTP-Logs und archivierte Anfrageadressen müssen diesen maskieren.

Abnahme: CSV-Parsing, Einheiten, UTC, Wiederholungen, leere Antwort und Providerfehler testen; echten Abruf mit MAP_KEY prüfen. Ein fehlender regionaler Treffer gilt als gültiges Ergebnis, nicht als fehlgeschlagener Import. API/UI und relevante Veröffentlichung prüfen.

## Schritt 4: iNaturalist

1. Öffentliche Beobachtungen regional und inkrementell abrufen, mit begrenzter Pagination und Rücksicht auf Anbieterlimits. Nur freigegebene Lizenzen und unverdeckte, auch taxonomisch nicht verschleierte Koordinaten übernehmen. Die gewählten API-Filter zusätzlich im Parser prüfen.
2. Beobachtungs-ID, Taxon, Zeitpunkt, Qualitätsstufe, Lizenz und notwendige Attribution erfassen. Fotolizenz separat prüfen; Bilder nur bei passender Freigabe verwenden. Private oder verschleierte Positionen ausschließen. Personenprofile und Kontaktdaten nicht sammeln.
3. Mit GBIF anhand belastbarer Anbieter-IDs bzw. Herkunftslinks abgleichen. Unsichere Ähnlichkeit darf keine Beobachtungen automatisch löschen. API/UI zeigen Quelle und Qualitätsstufe; Häufigkeiten nicht als repräsentative Artenbestände ausgeben.
4. Täglich neue/geänderte Beobachtungen importieren und einen begrenzten Nachlauf vorsehen. Periodisch bestehende IDs auf Änderungen, Löschung, geänderte Lizenz oder Datenschutzstatus prüfen und unzulässige veröffentlichte Datensätze entfernen. Bei großen Nachimporten Anbieterempfehlungen für Exporte berücksichtigen.

Abnahme: Lizenzen, Fotolizenzen, Geoprivacy, Taxon-Geoprivacy, Aktualisierung/Löschung, Pagination und GBIF-Überschneidungen testen; echte regionale Beobachtungen samt Quellenverweisen in API/UI prüfen; relevante CI abschließen.

## Schritt 5: SolarEdge

1. Zuerst eine teilnehmende Anlage, Zustimmung zur öffentlichen Darstellung und Site-Zugang erhalten. Mit dem Anlagenbetreiber klären, welche aktuelle API und Zugriffsrechte tatsächlich verfügbar sind. Den Vertrag anhand der aktuellen Anbieterunterlagen verifizieren, bevor Endpunkte festgelegt werden.
2. Nur freigegebene Erzeugungsdaten abfragen. Leistung W/kW und Energie Wh/kWh getrennt normalisieren; Zeitzone, Messintervalle, kumulative Zähler und Datenlücken berücksichtigen. Stromverbrauch, Geräteinformationen und genaue private Standortdaten standardmäßig nicht veröffentlichen.
3. Im vorhandenen Kernmodell die tatsächliche Anlage und Messwerte mit Herkunft speichern. API und Energieseite zeigen die Erzeugung teilnehmender Anlagen. Daraus keine Gesamtproduktion des Rieds ableiten. Einwilligung, gewünschte Standortgenauigkeit und Anbieter-Attribution dokumentieren.
4. Abrufintervall an den freigegebenen Endpunkt und seine Quote anpassen. Zugangsdaten ausschließlich serverseitig hinterlegen. Widerruf muss Veröffentlichung und weitere Sammlung stoppen können. Bis zum echten Zugang bleibt die Quelle deaktiviert.

Abnahme: Einheiten, Tageswechsel, doppelte/kumulative Werte, Lücken, Quoten und Zugriffsentzug testen; echte freigegebene Anlagenwerte mit Betreiberanzeige vergleichen; API/UI, Rechte und relevante CI prüfen. Ohne Anlagenzugang bleibt dieser Schritt ausdrücklich offen.

## Schritt 6: Gesamtbetrieb

Pro Quelle Aktualität, letzter erfolgreicher Abruf, Fehler und leere Ergebnisse prüfen. Aufbewahrung, Speicherverbrauch und Laufzeiten anhand echter Importgrößen festlegen. Keine feste Aktualitätszusage für unregelmäßige Satellitenüberflüge. Quellen, Einheiten, Lizenz, Zeitbezug und Export prüfen; Datenschutz- und Widerrufsregeln aus Schritt 4/5 praktisch überprüfen.

Die Umsetzung nutzt `entities`, `measurement_definitions`, `readings` sowie `collected_payloads` und `collection_attempts`; vorhandene Rasterarchive werden erweitert. Neue Quellentabellen sind nur bei nachgewiesener technischer Notwendigkeit vorgesehen. Migrations-, Parser-, API- und UI-Prüfungen richten sich nach den tatsächlich geänderten Komponenten. Eigene Änderungen werden gezielt committed und gepusht. Für genau diesen Commit werden nur relevante Workflows verfolgt; VPS-Änderungen auf main erfordern auch erfolgreiche vorgesehene GHCR-Builds. Eine reine Planänderung löst die beiden pfadgefilterten Backend-/Frontend-Workflows nicht aus.

Gesamtabnahme: Alle verfügbaren Quellen funktionieren vom echten Abruf bis zur Darstellung und zum Export; fehlende Zugänge sind mit betroffenem Schritt separat benannt. Der Nutzer entscheidet nach jedem abgeschlossenen Schritt über die Fortsetzung.

## Primärquellen

- [ECOSTRESS-Produkte und Versionen](https://ecostress.jpl.nasa.gov/data/atbds-summary-table), [L2T LSTE Version 003](https://www.earthdata.nasa.gov/data/catalog/lpcloud-eco-l2t-lste-003), [NASA CMR API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html).
- [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/), [FIRMS API-Nutzung](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html), [MAP_KEY anfordern](https://firms.modaps.eosdis.nasa.gov/api/map_key).
- [iNaturalist API](https://api.inaturalist.org/v1/docs/), [API-Empfehlungen](https://www.inaturalist.org/pages/api+recommended+practices), [aktuelle Geoprivacy-Erklärung](https://help.inaturalist.org/en/support/solutions/articles/151000169938-what-is-geoprivacy-what-does-it-mean-for-an-observation-to-be-obscured-).
- [SolarEdge Developer Portal](https://developer.solaredge.com/), [Monitoring-API-Dokumentation als ergänzende ältere Referenz](https://knowledge-center.solaredge.com/sites/kc/files/se_monitoring_api.pdf).

Die ECOSTRESS-Produktdetailseite war bei der ersten automatisierten Dokumentabfrage nicht lesbar. Während Schritt 2 wurde der aktuelle V003 User Guide im offiziellen Produktrepository gelesen und für Qualitätsbits und Formatprüfung verwendet. Die Skalierung der floating COG wurde am echten V003-Raster bestätigt; gepackte SDS werden getrennt behandelt. Die öffentliche Metadatenverfügbarkeit wurde direkt bei CMR geprüft.
