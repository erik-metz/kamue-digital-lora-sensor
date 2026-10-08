# iNaturalist im Ried

Quelle `inaturalist-ried`, Adapter `inaturalist`, täglich. Ohne Zugangsdaten: ausschließlich die öffentliche API v1, niemals authentifizierte private Felder. Suchgebiet W/S/E/N `8.33,49.54,8.58,49.75`, offene Geoprivacy und Taxon-Geoprivacy, Beobachtungslizenzen CC0, CC BY 4.0, CC BY-SA 4.0. Der Parser prüft Filter unabhängig und verlangt ausdrücklich `obscured=false`. Standard-Geoprivacy `null` entspricht öffentlich, sofern keine Verschleierung angegeben ist.

## Umfang und Datenschutz

Täglicher vollständiger, begrenzter Neuabgleich statt einer rein inkrementellen Suche: derzeit rund 1.727 öffentliche Treffer, höchstens zehn Seiten zu 200 Meldungen. Neue und geänderte Meldungen werden damit erfasst; frühere IDs außerhalb der aktuellen freigegebenen Auswahl werden entfernt. Bei mehr als 2.000 Treffern wird der Ausschnitt ausdrücklich als unvollständig angezeigt. Keine Aussage, dass eine fehlende ID beim Anbieter gelöscht wurde. Für größere Mengen wären Anbieterexporte und ein eigenes Nachlaufkonzept nötig.

Nur Beobachtungs-ID, Taxon/Taxonrang, Fundtag ohne erfundene Uhrzeit, Aktualisierungsdatum, öffentliche Koordinaten/Unsicherheit, Qualitätsstufe, Lizenz, Herkunftslink und erforderlicher öffentlicher Benutzername werden übernommen. CC0 benötigt keinen Namen. Keine Profile, Klarnamen, Kontakte, Kommentare, Beschreibungen, Fotos, Töne oder private Positionsfelder. Medien werden gar nicht verwendet, daher wird keine Fotolizenz aus der Beobachtungslizenz abgeleitet. Ausgewählte Metadaten und Umfangsänderung werden bei jeder Meldung ausgewiesen; jede Meldung behält ihre eigene Lizenz, insbesondere ShareAlike.

Providerantworten werden nur im begrenzten Arbeitsspeicher verarbeitet, nicht roh archiviert. Dauerhafte Abrufbelege enthalten Query, Seitenprüfsummen, Projektionsprüfsumme und Zähler, keine Beobachtungs-IDs, Funddaten, Positionen oder Namen. Damit sind sie ein Audit und **kein vollständiges Replayarchiv**. Nur die aktuelle Veröffentlichung und aktuelle Kernmessungen bleiben gespeichert. Das allgemeine Monatsarchiv schließt iNaturalist-Entitäten ausdrücklich aus, damit keine unveränderlichen ZIP-Kopien früherer Positionen entstehen. Der eigene JSON-Download liest ausschließlich den aktuell geprüften Stand. Der atomare Ersatz entfernt auch frühere Dataset-Versionen, Messdefinitionen, Lesewerte, letzte Werte und Revisionshistorie dieser Quelle. Fremde Quellen bleiben erhalten.

Ein fehlgeschlagener Neuabgleich zieht die alte Veröffentlichung und ihre Kernwerte zurück. API/UI veröffentlichen keine abgelaufenen Positionen (36 Stunden Höchstalter). Änderungen beim Anbieter werden beim nächsten täglichen Lauf berücksichtigt; das ist keine sofortige Widerrufsgarantie. Kein öffentliches HTTP-Caching dieser API oder ihrer Downloads.

## Abgleich mit GBIF

Nur exakte Herkunftslinks `http(s)://[www.]inaturalist.org/observations/ID` in archivierten GBIF-Datensätzen zählen. Abgleich gegen IDs des aktuellen gespeicherten GBIF-Kernausschnitts; keine Ähnlichkeit anhand Taxon, Datum oder Position. Aus den zehn neuesten erfolgreichen GBIF-Seiten werden ausschließlich die Seiten verwendet, deren kombinierte Prüfsumme genau dem aktuellen GBIF-Snapshot entspricht; je höchstens 20 MiB/300 Zeilen. Frühere Herkunftslinks derselben GBIF-ID dürfen keine aktuelle Überschneidung begründen. Fehlende Herkunftsarchive werden als teilweise oder nicht verfügbar ausgewiesen. GBIF-Suchgebiet `8.35,49.55,8.65,49.76`, Zeitraum und 3.000er-Grenze unterscheiden sich. „Ohne nachgewiesenen GBIF-Link“ bedeutet nicht weltweit GBIF-frei.

API `/api/v1/environment/measurements/inaturalist`: `limit=1..200`, `offset=0..2000`, `include_duplicates=false` standardmäßig; vollständiger gespeicherter Export `/inaturalist/download`. UI `/umwelt/biodiversitaet#inaturalist`, mit Qualitätsstufe, Attribution, Lizenz, Fundtag und Quellenlinks. Nachgewiesene Überschneidungen sind standardmäßig ausgeblendet, zuschaltbar und mit GBIF-Referenz sichtbar. Kernmodell: `inaturalist:ID`, `occurrence_presence=1 count`, Beobachtung, Tagpräzision, Referenzsemantik; keine Bestandszählung.

## Betriebsgrenzen

Maximal 20 MiB dekodierte Antwort pro Seite, zehn Seiten und drei Versuche bei 429/5xx; keine Weiterleitungen. Mindestens 1,1 Sekunden zwischen Seiten, Retrywartezeiten 2/4 Sekunden, 60 Sekunden Requesttimeout. Eigener User-Agent. Regelbetrieb höchstens 30 Requests/Tag; manuelle Wiederholungen berücksichtigen die Anbieterquote. Erfolgsbelege im niedrigen KiB-Bereich pro Lauf; Quellantworten und historische Positionen werden nicht angesammelt.

Lokal: `PYTHONPATH=www/vps/registry-sync-worker:www/vps/tests COLLECTOR_TEST_DATABASE_URL=... pytest www/vps/registry-sync-worker/tests/test_inaturalist.py` gegen eine Wegwerfdatenbank. Produktiv: `docker compose exec -T registry-sync-worker python main.py --job inaturalist-ried`.

Anbieter: [API-Empfehlungen](https://www.inaturalist.org/pages/api+recommended+practices), [Geoprivacy](https://help.inaturalist.org/en/support/solutions/articles/151000169938), [getrennte Beobachtungs-/Medienlizenzen](https://help.inaturalist.org/en/support/solutions/articles/151000173511).
