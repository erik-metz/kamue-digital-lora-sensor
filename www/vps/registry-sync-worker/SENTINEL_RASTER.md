# Echte Sentinel-2-Rasterindizes

Der bestehende `copernicus-sentinel2`-Import berechnet NDVI, NDWI (McFeeters:
Grün/NIR), NDMI (NIR/SWIR), EVI und SAVI aus den Reflexionsbändern der öffentlichen
Earth-Search-Collection `sentinel-2-c1-l2a`. Vegetationsanteile werden nicht mehr
in einen vermeintlichen NDVI oder eine Dürrefläche umgerechnet.

## Gebiet, Auflösung und Qualität

Das feste Rechteck umfasst 8.33–8.58° Ost und 49.54–49.75° Nord. Dies sind keine
Gemeindegrenzen. Jede Szene wird einzeln ausgewertet; es gibt kein Mosaik und
keinen behaupteten Trend über wechselnde Abdeckungen. Szenen können das Rechteck
nur teilweise überdecken. `aoi_pixels` nennt die Zahl der im jeweiligen
Raster tatsächlich überdeckten Pixelzentren im Rechteck.

Die native SCL-Klassifikation in EPSG:32632 mit 20 m bestimmt das Zielraster.
10-m-Spektralbänder werden durch Mittelung auf 20 m gebracht, 20-m-Bänder
bleiben auf dieser Auflösung. NoData bleibt ausgeschlossen. Nur SCL 4, 5 und 6
(Vegetation, unbewachsener Boden, Wasser) werden verwendet. Wolken, Schatten,
Schnee, unklassifizierte und defekte Pixel sind ausgeschlossen. Dies ist eine
konservative SCL-Maske, keine Garantie vollständiger Wolkenfreiheit.

Skalierung und Offset stammen ausdrücklich aus `raster:bands` der STAC-Assets;
fehlende Kalibrierung führt zum Fehler. Die am 06.10.2026 geprüften realen
Assets liefern `scale=0.0001`, `offset=-0.1`. Digitalzahlen werden deshalb
nicht pauschal durch 10000 geteilt. Jeder Index entsteht je gültigem Pixel;
erst anschließend werden Mittelwert, P10, P90 und gültige Pixelzahl berechnet.
Ungültige/nahe null liegende Nenner bleiben fehlend. Normierte Differenzen
außerhalb [-1,1] werden ausgeschlossen; EVI/SAVI werden nicht künstlich begrenzt.

Niedriger NDVI allein belegt keine Dürre. Es werden keine Dürrehektar,
Grundwasser-Korrelationen, synthetischen Wetterwerte oder Trainingslabels
abgeleitet. Der Datenbank-ML-Export gibt echte gespeicherte Indexmittel und
fehlende Zusatzmerkmale aus; fehlende Zielklassen erfordern echte Labels vor
überwachtem Training. Die direkte Klassifikationshilfsfunktion bleibt eine
Heuristik, kein aus Messungen belegtes Trainingsziel.

## Archiv und Betrieb

Pro Import werden höchstens zwei noch nicht berechnete Szenen bearbeitet,
neueste zuerst. `raster_max_scenes` kann auf 0–2 gesetzt werden. Unveränderte
Quellasset-Manifeste, Methode und Gebiet verwenden den bestehenden Rasterstand.
Dies begrenzt jeden Lauf; historische Szenen werden schrittweise bei weiteren
Läufen nachgezogen. Es werden keine kompletten Sentinel-Kacheln heruntergeladen.
Das Fenster ist auf zwei Millionen Pixel, der NPZ-Beleg auf 40 MiB begrenzt.
GDAL-HTTP-Zeitlimits und begrenzte Wiederholungen gelten je Teilabruf; die
Gesamtdauer hängt von den COG-Blöcken und der Quelle ab.

Das NPZ in `collected_payloads` enthält die ausgerichteten, gegebenenfalls auf
20 m gemittelten Digitalzahlen, SCL, Gebietsmaske, Indexraster sowie CRS,
Transform, Kalibrierung, STAC-Feature und Quellasset-Adressen. Es archiviert die
Berechnungseingaben nach Resampling, nicht die kompletten originalen COG-Dateien.
SHA-256 und ein eigener `collection_attempts`-Beleg verknüpfen Messwerte,
Metadaten und Raster. Angegebene Provider-Dateichecksums werden dokumentiert,
aber mangels vollständigen Dateidownloads nicht als selbst geprüft ausgegeben.
Messungen verwenden `basis=model` und eine Methodendimension; alte heuristische
Messungen bleiben historisch erhalten und werden in diesen Ansichten nicht
mehr als echte Rasterindizes ausgewählt.

Die bestehende Quelle ist bereits aktiviert. Nach Deployment der API und des
Registry Workers verarbeitet sie Raster beim nächsten geplanten Import; ein
API-Aufruf löst keinen externen Import aus. Der skalare Messvertrag muss bereits
installiert sein (`python measurement_migration.py install` im API-Verzeichnis).
Es werden keine neuen Fachtabellen und keine produktive Migration automatisch
ausgeführt. Rasterfehler werden separat belegt und bleiben als fehlende Raster
sichtbar. Der STAC-Metadatenimport kann dabei erfolgreich bleiben.

## API und Oberfläche

`/satellite/scenes` und `/latest` lesen gespeicherte, sichtbare Entitäten.
Fehlende Szenen erzeugen eine leere Liste beziehungsweise 404; alte
Cover-Schätzungen werden als fehlende Indizes ausgegeben. Im Regionalatlas
stehen echte Kennzahlen und Qualitätsangaben statt erfundener Zeitreihen.

`/satellite/tiles/{scene}/{z}/{x}/{y}.png?layer=rgb|ndvi` rendert PNG-Kacheln
in Web Mercator aus dem archivierten Ausschnitt. `latest` bezeichnet die letzte
sichtbare tatsächlich berechnete Szene. Außerhalb des Ausschnitts und für
maskierte Pixel sind Kacheln transparent. Fehlende Raster liefern 404;
es gibt keinen Ersatz durch Weltbilder oder Vorschaubilder. NDVI-Farben werden
im Backend berechnet. RGB verwendet festen Kontrast 0–0.3 und Gamma 2; beide
Ansichten sind 20 m. Zwei Raster-Layervarianten werden pro API-Prozess gecacht;
decodierende Renderzugriffe sind serialisiert.

Der JSON-Download liefert ein Manifest mit echten Werten. ZIP enthält NPZ-
Belege, tatsächliche RGB-/NDVI-PNG-Vorschauen und das Manifest. PNG-Vorschauen
besitzen keine eigene Georeferenzierung; NPZ enthält diese. Fehlende Raster
werden im Manifest aufgeführt, nicht durch Platzhalterbilder ersetzt.
Der Export ist auf 100 Szenen und 100 MiB NPZ-Eingaben begrenzt.

## Verifikation

Die echte Szene `S2B_T32UMV_20261005T102902_L2A` vom 05.10.2026 wurde am
06.10.2026 aus ihren öffentlichen COGs gelesen. Der überdeckte Ausschnitt
enthielt 559497 Gebiets-Pixel. Der pixelweise berechnete NDVI-Mittelwert
betrug etwa 0.483691 (558051 für NDVI gültige Pixel). Der 15.4-MB-NPZ-Beleg
hat SHA-256 `754644fefa1bb6500d3142876d12365f2c181c2265378fefbecc759dae10a187`.
Das war ein lokaler Liveversuch, keine Aktivierung auf dem VPS.

Tests verwenden kleine echte GeoTIFFs mit bekannten Pixeln, Kalibrierung,
SCL-/NoData-Lücken, PostgreSQL-Import, Wiederholung, Quellenänderungen,
PNG-Kacheln und ZIP-Ausgabe. Die synthetischen Testpixel sind ausdrücklich
Testdaten; sie werden nicht als Live-Messungen veröffentlicht.

## Primärquellen

- https://github.com/Element84/earth-search
- https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a
- https://sentiwiki.copernicus.eu/web/s2-processing
- https://rasterio.readthedocs.io/en/stable/api/rasterio.vrt.html
