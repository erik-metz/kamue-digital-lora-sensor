# Schritt 27: Themenansichten auf Datenlücken und Ersatzwerte prüfen

## Ergebnis und Korrekturen

- Atlas-Übersicht: fest eingetragene Einwohner-, Wohnungs-, Recycling- und
  Standortzahlen entfernt. Texte beschreiben die verfügbaren HSL-/BORIS-Daten
  und Veranstaltungen, statt nicht angebundene Zensus-, IHK-, Gesundheits- oder
  Bebauungsplandaten als vorhandene Abdeckung anzukündigen. Die statischen
  Einwohnerangaben in den Ortskarten sind ebenfalls entfernt.
- Sozialansicht: Abfallbilanzen werden ausschließlich für die ausgewählte
  Kommune gefiltert. Kein Ersatz durch Bürstadt oder den Kreis. Die festen
  Ersatzwerte für Recycling, Pro-Kopf-Abfall und Tonnage sind entfernt.
  Eine unbekannte Kommune erhält keine Kennzahlen einer anderen Kommune.
- Arbeitsmarkt: fehlende Werte bleiben offen, echte Nullwerte bleiben sichtbar.
  Keine Mindestbalkenbreite und keine unbelegte Aussage „unter Hessen-Schnitt“.
  Der fest eingetragene Quellenzeitraum 2025/2026 ist entfernt.
- Haushalt: nur der Plan der gewählten Kommune und des gewählten Jahres wird
  verwendet; anderenfalls erscheint ein Hinweis bei weiterhin bedienbarer
  Kommunen-/Jahresauswahl. Keine Wahlbeispiele bei fehlenden Wahldaten und
  keine Wahlergebnisse einer anderen Kommune.
- HSL-Vergleich: fehlende Werte und Nullwerte erhalten keinen positiven Balken.

## Öffentliche Datenprüfung am 10. Oktober 2026

Alle sechs `statistics/*`-Datensätze antworteten mit HTTP 200:
Demografie 4, Wirtschaft 4, Finanzen 3, Wohnen 3, Umwelt 4, Soziales 2 Tabellen.
Die geprüften älteren Detailendpunkte für Demografie, Wirtschaft,
Haushaltspläne und Wohnungszusammenfassungen sowie `social/indicators/summary`
und `social/waste-statistics` antworteten mit HTTP 503.
Die HSL-Ansichten überbrücken diese Lücke mit den Originaltabellen; sie liefern
keine vollständigen Ersatzdaten für alle früher entworfenen Dashboardfelder.
Gesonderte amtliche Haushaltsveröffentlichungen und BORIS-Zonen bleiben in
ihren vorhandenen Komponenten erreichbar.

## Offene Anschlussarbeiten

Die älteren Demografie- und Wohnen-Dashboards enthalten noch selbst berechnete
Gesamtraumwerte, ungewichtete Mittelwerte und eine feste aggregierte
Wohnungskaufpreisangabe. Diese Ansichten werden derzeit durch fehlende
Detaildatensätze auf die amtlichen Tabellen umgeleitet. Vor einer Wiederanbindung
sind diese Aggregationen gesondert zu bereinigen und mit geeigneten
Bezugsgrößen und Berichtsperioden zu prüfen. Die fehlenden Datenanbieter sind
hierdurch nicht repariert. Deutsche-Bahn-Ansichten wurden auftragsgemäß ausgelassen.

## Prüfung

Render-Regressionstests für fehlende Abfallwerte, fremde Kommune, falsches
Haushaltsjahr, Atlas-Übersicht und fehlende/Null-Vergleichsbalken. Dazu Regional-
und HSL-Tests, ESLint der fünf geänderten Komponenten und Produktionsbuild.
Nur Frontendänderungen: kein VPS-Deployment oder GHCR erforderlich.
Ein unabhängiger Nachweis der öffentlich ausgelieferten Frontendversion steht aus.
