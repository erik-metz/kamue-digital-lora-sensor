# ArcGIS-Kontextebenen für Open Ried Sens

## Ziel und Umsetzungsschritte

1. **Quellen verifizieren:** öffentliche Feature-Services, Felder, Lizenz und regionale Abdeckung für Landbedeckung, Hochwasserszenarien und Zensus prüfen.
2. **Regionalen Datenzugang implementieren:** feste erlaubte Dienste, ausschließlich lesende Abfragen, begrenzte Pagination, Timeout, Cache, keine unvollständigen Ergebnisse als vollständige Karten veröffentlichen.
3. **Karte erweitern:** drei einzeln aktivierbare Ebenen in den vorhandenen Kategorien und teilbaren URLs; nur bei Aktivierung und passendem Zoom laden. Legenden, Popup-Details, Herkunft, Lizenz, Datenstand und Fehler-/Leerzustände anzeigen.
4. **Prüfen:** Tests für Quellenvertrag, Pagination, Ausfälle, unbekannte Werte und URL-/Preset-Kompatibilität; TypeScript, Lint, Build und Live-Abfragen; Kartenanzeige im Browser kontrollieren.
5. **Veröffentlichen:** eigene Änderungen gezielt committen/pushen und Frontend CI für genau diesen Commit verfolgen.

## Verifizierte Quellen (9. Oktober 2026)

Alle Dienste liegen auf `services2.arcgis.com/jUpNdisbWqRpMo35`. Öffentlicher Zugriff wurde ohne Token geprüft. Der feste Auswahlbereich ist WGS84 `8.35,49.55,8.58,49.76` (Ried um Bürstadt, Lampertheim, Biblis und Groß-Rohrheim). Dies ist kein Zuschnitt auf Gemeindegrenzen: ausgewählt werden schneidende Geometrien, die über den Rand hinausreichen können.

| Ebene | ArcGIS-Item | Sublayer | Regionale Treffer | Datenstand / Lizenz |
| --- | --- | --- | --- | --- |
| Landbedeckung | `6bb9b8ef9de446078796b71ce49b8a36` | 0 | 8306 | LBM-DE2021, Mindestkartierfläche 1 ha; © BKG 2025, CC BY 4.0 |
| Hochwasserrisiko | `91058f6620764a05a43d1d15cdf60d68` | 0 / 1 / 2 | 29 / 49 / 15 | Zyklus 2016–2021, Bearbeitung 2024; © WasserBLIcK/BfG und zuständige Behörden der Länder, 2020, CC BY 4.0 |
| Zensus | `87285c05ac3b498a8cbf257c3c23a37d` | 1 (1 km) | 436 | 15.05.2022; © Statistische Ämter des Bundes und der Länder 2024, Geometrie © GeoBasis-DE / BKG (2024), DL-DE BY 2.0 |

Item-Metadaten: `https://www.arcgis.com/sharing/rest/content/items/{item}?f=json`.

Die erste Recherche nannte beim Hochwasser den Katalogstand 2025. Für die Anzeige gelten stattdessen die detaillierten Metadaten oben. Das Zensus-Gitter wird nach Einwohnerzahl eingefärbt; es ist keine Hitzerisikoberechnung. Fehlende und negative numerische Quellenwerte sind unbekannt. Der Hochwasser-Wiederkehrwert ist ein Quellenstring (z. B. `>200`) und bleibt unverändert.

## Technische Entscheidungen

- Umsetzung vollständig im Next.js-Frontend samt Route Handler; keine Datenbankmigration oder VPS-Änderung erforderlich.
- `GET /api/context-layers?layer=landcover|floodrisk|census` erlaubt keine frei wählbaren URLs, Felder oder räumlich unbegrenzten Abfragen.
- Seiten mit 1000 Features, sortiert nach Objekt-ID, maximal 10 Seiten je Sublayer und 40 Sekunden Gesamtzeit. Bei Ausfall oder Überlauf HTTP 503, keine Teilveröffentlichung. Leere vollständige Antworten bleiben sichtbar als null geladene Flächen.
- Upstream-Cache 24 Stunden, erfolgreiche Antworten Browser-Cache 1 Stunde / CDN 24 Stunden, Fehler nicht cachen. Next.js kann besonders große Upstream-Antworten vom Data Cache ausschließen; sie werden dennoch ausgeliefert.
- Geometrie generalisiert mit `maxAllowableOffset=0.00005` Grad (Hochwasser: `0.0002`) und fünf Nachkommastellen; keine Vermessungsgrundlage. Aufbereitungs-/Vereinfachungshinweis steht in der Oberfläche.
- Ebenen standardmäßig aus; bestehende Presets bleiben unverändert. Landbedeckung/Zensus ab Zoom 12, Hochwasser ab Zoom 10. Separate Leaflet-Panes unter Sensoren und Fahrzeugen. Abbruch beim Deaktivieren/Unmount, Wiederholungsbutton nach Fehlern.
- Schutzgebiete, Wetterwarnungen, Ladepunkte und weitere Quellen sind nicht Teil dieser ersten Implementierung; vorhandene ähnliche Ebenen bleiben bestehen. Automatische Standortanalysen und weitere Zensusmerkmale sind mögliche spätere Erweiterungen.

## Lokaler Abschlussnachweis

- Alle 228 Frontend-Tests erfolgreich, einschließlich acht neuer Datenzugangstests und URL-Roundtrip für die neuen Ebenen.
- TypeScript/Produktionsbuild und gezieltes ESLint erfolgreich.
- Produktionsserver: alle drei API-Antworten HTTP 200; Landbedeckung 8306 Features / 3.38 MB, Hochwasser 93 / 2.01 MB, Zensus 436 / 0.13 MB.
- Browser: drei Canvas-Ebenen, korrekte geladene Flächenzahlen, Quellen-/Lizenzhinweise sowie Zoomschwellen kontrolliert. Screenshot außerhalb des Repositorys: `/tmp/ried-context-map.jpg`.
- Veröffentlichung und CI-Ergebnis werden im abschließenden Chatbericht mit Commit und Workflow-Link dokumentiert.
