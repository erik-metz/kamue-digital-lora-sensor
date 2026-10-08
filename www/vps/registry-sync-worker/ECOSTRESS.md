# NASA ECOSTRESS V003

Der Adapter `ecostress` fragt täglich den öffentlichen NASA-CMR-Katalog ab: Collection `C3998139651-LPCLOUD`, 90 Tage, maximal drei Seiten mit je 20 Einträgen, WGS84 West/Süd/Ost/Nord `[8.33,49.54,8.58,49.75]`. Rohantworten werden mit SHA-256 archiviert. Kacheln sind keine unabhängigen Überflüge. Die Suche ist kein vollständiger historischer Backfill.

## Rasterzugang

Standardmäßig werden ausschließlich Katalogdaten importiert. Geschützte Raster benötigen einen gültigen NASA-Earthdata-User-Token (`EARTHDATA_TOKEN`) und `ECOSTRESS_RASTER_ENABLED=true` im serverseitigen Compose-Environment. Konto: https://urs.earthdata.nasa.gov/users/new ; Tokenverwaltung: https://urs.earthdata.nasa.gov/profile . Ein vorhandener anderer Anbieter-API-Key ersetzt diesen Zugang nicht. Der Betreiber hinterlegt den Token in `/root/.env` mit restriktiven Dateirechten; keine Geheimnisse committen oder in Chat/Logs ausgeben. Nach Änderung nur den Registry-Worker neu erstellen.

Der Download sendet den Bearer-Token ausschließlich an den fest vorgegebenen LP-DAAC-Datenhost, folgt keinen Weiterleitungen und akzeptiert nur TIFFs. Fehler enthalten Typ/Host/HTTP-Status, keine Header oder vollständigen URLs. Ein abgelaufener bzw. ungeeigneter Token führt zu einem dokumentierten Importfehler. NASA-Freigaben bzw. Nutzungsbedingungen sind im Konto gegebenenfalls zuerst zu bestätigen.

## Auswertung

Maximal zwei neue/geänderte Kacheln pro Lauf, vier Layer (LST, QC, cloud, water), 32 MiB pro Quelldatei, zwei Millionen Pixel je AOI-Raster, 40 MiB pro komprimiertem Ausschnitt. Gesamtes ECOSTRESS-Rasterarchiv höchstens 500 MiB; bei Erreichen wird kein weiterer Rasterimport zugelassen. Alte Archive werden nicht automatisch gelöscht, weil Messwerte und Downloads auf deren Belege verweisen. Eine spätere Aufbewahrungsänderung muss diese Referenzen berücksichtigen. Speichergröße und Laufzeit sind nach dem ersten echten Import zu überprüfen.

Nur deckungsgleiche EPSG:32632-Raster mit ungefähr 70 m werden akzeptiert; keine Hochskalierung auf Sentinel-20-m-Pixel. Floating-COGs werden als bereits skalierte Kelvin mit Skalierung 1 akzeptiert; gepacktes uint16 erfordert explizite GeoTIFF-Skalierung 0.02. Unbekannte Kodierung/Einheit führt zu einem Fehler. Die offizielle Dokumentation vermischt stellenweise SDS- und COG-Angaben; deshalb ist die Prüfung eines echten V003-Rasters vor produktiver Freigabe erforderlich.

Gültige Landpixel: separate cloud=0 und water=0, Mandatory QA bits 0–1=0, Datenqualität bits 2–3=0, Genauigkeitsklasse bits 14–15 >=2 (gut/ausgezeichnet). Kein Rückschluss auf Wolken aus QC. NoData/NaN werden ausgeschlossen, QC=65535 gilt als ungültig, QC=0 ist ein interpretierbares Bitfeld. Der zusätzliche Plausibilitätsbereich ist 150–400 K. Umrechnung zu Celsius: K−273.15. Alle maskierten Szenen bleiben als erfolgreicher leerer Befund mit Mittelwert null erhalten.

Das NPZ enthält Celsius, AOI/gültige Pixel, QC/cloud/water sowie CRS, Transform, Aufnahmezeit, Kalibrierung, Quellen-URLs, Input-Hashes und Auswerteprofil. Der Ausschnitt-Hash, erfolgreiche Archivbeleg und echte Aufnahmezeit sind mit Entity/Messwert verknüpft. Provider-Revisionen invalidieren den Cache; wiederholte identische Kacheln werden nicht neu heruntergeladen.

API: `/api/v1/satellite/ecostress/scenes` und `/api/v1/satellite/ecostress/crop/{scene_id}.npz`. Der API-Download prüft Hash und erfolgreichen Collector-Beleg. Der Regionalatlas zeigt Aufnahmezeit, Kachel und Verfügbarkeit bzw. Temperaturstatistiken und Download. Eine interaktive Temperaturschicht mit Aufnahmeauswahl und fester Legende erscheint nur für archivierte Raster mit gültigen Pixeln. Tiles werden aus demselben geprüften NPZ wie der Download berechnet; der Renderer hat keinen Providerzugang. Die echte Kartenabnahme bleibt bis zum authentifizierten Import offen.

## Stand der Abnahme

Automatisierte Tests verwenden synthetische georeferenzierte TIFFs; sie sind keine NASA-Beobachtungen. Öffentliche Metadaten wurden live geprüft. Ein authentifizierter NASA-Import, echte gültige Pixel, Kartenabnahme und vollständige Produktionsabnahme bleiben ohne Zugang offen. Schritt 2 des Gesamtplans ist deshalb noch nicht abgeschlossen.

Primärquellen: [aktueller V003 User Guide](https://github.com/ECOSTRESS-Collection-3/ECOv003-L2-LSTE/blob/main/documentation/ECOL2_User_Guide_V3.md), [Produkt](https://doi.org/10.5067/ECOSTRESS/ECO_L2T_LSTE.003), [CMR API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html).
