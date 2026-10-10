# Schritt 23: Noch nicht konfigurierte Quellen prüfen

Stand: 10. Oktober 2026. Deutsche-Bahn-Anbindungen bleiben ausgenommen.

## Ergebnis und Nachweis

Alle zehn übrigen Sammelplatzhalter haben in `sources.json` eine leere URL,
`enabled: false` und im öffentlich abgerufenen `collection/status` den Zustand
`not_configured`. Das sind geplante Anbindungen, keine zehn ausgefallenen Anbieter.
Die Quellenansicht trennt sie bereits über `isPlaceholderSource` in „Geplante
Anbindungen“ und kennzeichnet sie neutral. Deshalb ist für diesen Prüfschritt
keine Änderung an der Anwendung oder der VPS-Konfiguration erforderlich.

Die öffentlichen Endpunkte `collected/statistics/{demographics,realestate,economy,
finance,environment,social,elections}` wurden einzeln erfolgreich abgerufen.
Die ersten sechs enthalten veröffentlichte HSL-Tabellen; der siebte enthält
Bundestagswahlbezirke 2025. Die Quellen `hessen-municipal-statistics`,
`bundeswahlleiterin-2025` und `hlnug-groundwater` melden jeweils `success`.
`biblis-adopted-budget` meldet weiterhin `partial` mit
`ordinary_totals_do_not_reconcile`; das ist die bereits dokumentierte
inhaltliche Summenabweichung, kein fehlender API-Schlüssel.

## Prüfung aller zehn Einträge

Vorhandene thematische Daten bedeuten nicht, dass die alten generischen
Endpunkte vollständig befüllt oder deren Formate austauschbar sind.

| Platzhalter | Bereits vorhanden | Verbleibende Lücke / Entscheidung |
| --- | --- | --- |
| `demographics-published-source` | HSL unter `statistics/demographics`, unter anderem Bevölkerung 2024 | Tabellen mit ihren Bezugsjahren weiterverwenden. Einrichtungsstandorte, Pendler und gewünschte Altersdarstellung nur nach konkreter Feldprüfung ergänzen. Kein pauschaler Zugang erforderlich. |
| `realestate-published-source` | HSL unter `statistics/realestate`, unter anderem Baugenehmigungen 2024 | Bodenrichtwerte als eigene BORIS-Quelle erschließen; Marktpreise und Bebauungspläne bleiben eigenständige Aufgaben. |
| `economy-published-source` | HSL unter `statistics/economy`, unter anderem Betriebe des verarbeitenden Gewerbes | Aggregate sind kein Firmenverzeichnis und keine vollständige Gründungsstatistik. Dafür noch kein vollständiger regionaler Feed nachgewiesen. |
| `finance-published-source` | HSL-Gemeindefinanzen und separate Bibliser Haushaltsquelle | Historische Ein-/Auszahlungen nicht als aktuelle Haushaltsplanung ausgeben. Bibliser Summenkonflikt bleibt bis zu einer belastbaren Korrektur offen. |
| `elections-published-source` | Bundestagswahl 2025 unter `statistics/elections` | Wahlbezirks- und Briefwahlzuordnung erhalten; keine erfundenen Gemeindesummen. Andere Wahlarten brauchen gesonderte Originaldaten. |
| `environment-published-source` | HSL-Landwirtschaft, separater Grundwasserkatalog; Schutzgebiets-Kartenanbindung im Frontend implementiert (siehe ArcGIS-Plan) | Grundwasserkatalog enthält Standorte, keine aktuellen Wasserstände. Landwirtschaftstabellen haben teilweise Bezugsjahr 2020. Flächengeometrien und Anbauinformationen getrennt prüfen. |
| `social-published-source` | HSL unter `statistics/social` und eigenständige Veranstaltungskalender | HSL enthält hier unter anderem Unfallstatistik; das deckt keine vollständigen Sozialindikatoren, Einrichtungen oder Abfallmengen ab. Kalender sind keine Abfallstatistik. |
| `infrastructure-published-source` | Öffentlicher amtlicher Breitband-Download gefunden und heruntergeladen | Breitbandversorgung zuerst anbinden. Straßenbaulicher Zustand und öffentliche WLAN-Standorte sind damit nicht abgedeckt; noch kein vollständiger Feed bestätigt. |
| `traffic-published-source` | Generischer Sperrungsplatzhalter weiterhin ohne URL | Bestehende Verkehrscollector-Daten vor einer zusätzlichen Anbindung auf genaue Abdeckung prüfen. Straßensperrungen sind kein Straßenbelagszustand. In diesem Schritt keine Vollständigkeit behauptet. |
| `energy-meter-feed` | Vorbereiteter SolarEdge-Zugangsplan | Reale Anlage, Betreiberfreigabe und nutzbarer Messdatenzugang fehlen weiterhin. Installierte Leistung ersetzt keine gemessene Erzeugung; Quelle bleibt deaktiviert. |

## Zwei konkrete öffentliche Alternativen

### 1. Breitbandatlas: nächster Umsetzungsschritt

Die [amtliche Downloadübersicht](https://gigabitgrundbuch.bund.de/GIGA/DE/Downloads_Suche/start.html)
veröffentlicht die Breitbandverfügbarkeit mit Stand **Dezember 2025**.
Der [XLSX-Download](https://data.bundesnetzagentur.de/Bundesnetzagentur/GIGA/DE/Breitbandatlas/Downloads/bba_12_2025.xlsx)
war ohne Anmeldung mit HTTP 200 abrufbar (10.415.522 Bytes); ZIP-Prüfung erfolgreich.
Er enthält unter anderem die Arbeitsblätter Privathaushalte, Fläche, Schulen,
Krankenhäuser und Unternehmen. Noch keine Werte daraus produktiv importiert.

Der vollständige nächste Schritt umfasst: Nutzungshinweise und Gemeindeschlüssel
prüfen, die vier Gemeinden eindeutig auswählen, Technologie/Bandbreite/Bezugsgröße
und Prozentwerte prüfen, einen eigenen Collector mit Tests ergänzen und die
Daten samt Bezugsstand veröffentlichen. Versorgung ist keine gemessene momentane
Internetgeschwindigkeit. Erfolgskriterien: Originalwerte für alle vier Gemeinden,
keine Nullwerte für fehlende Angaben, korrekte Quellenanzeige und erfolgreiche
relevante CI samt Containerveröffentlichung nach Implementierung.

### 2. BORIS: anschließender Umsetzungsschritt

Der [amtliche Geoportal-Eintrag](https://www.geoportal.hessen.de/spatial-objects/864)
verweist auf einen öffentlichen WFS für den **Stichtag 1. Januar 2024**, mit
Datenlizenz Deutschland – Zero – Version 2.0. Die Geoportal-Ansicht der zonalen
Bodenrichtwerte liefert tatsächliche Datensätze, darunter Lampertheim, mit
Gemeinde, Richtwertnummer, Wert, Stichtag und Nutzungsart. Kein Konto war nötig.
Das beweist die öffentliche Verfügbarkeit dieser Ausgabe, nicht die Aktualität
für 2026 oder eine bereits vollständige regionale Übernahme.

Vor Import neuesten verfügbaren amtlichen Stichtag ermitteln; danach Gemeinde-
und Geometriefilter, Einheiten, Nutzungsarten, Pagination und Vollständigkeit
prüfen. Bodenrichtwerte nicht mit Immobilienangebotspreisen gleichsetzen.

## Weitere Reihenfolge und Grenzen

1. Breitband für alle vier Gemeinden vollständig umsetzen.
2. BORIS mit explizitem amtlichem Stichtag und regionalen Geometrien anbinden.
3. Vorhandene HSL-Daten gezielt den gewünschten Ansichten zuordnen; pro Feld
   Bezugsjahr und Einheit erhalten, keine generischen JSON-Platzhalter aktivieren.
4. Übrige Einrichtungen, WLAN, Sperrungen und Bebauungspläne jeweils mit einer
   konkreten regionalen Quelle prüfen. Ohne bestätigte Abdeckung geplant lassen.
5. Energie erst mit freigegebenem Anlagenzugang fortsetzen; Vorbereitung siehe
   [SolarEdge-Anlagenzugang](solaredge-anlagenzugang.md).

Schutzgebiets-Implementierung und deren lokaler Prüfstand sind im
[ArcGIS-Kontextplan](arcgis-context-layers-plan.md) dokumentiert; eine neue Prüfung
aller öffentlichen Frontend-Karten war nicht Bestandteil dieses Schritts.
Bibliser Haushalt und offene ZAKB-Adressen bleiben ihre getrennt dokumentierten
Restfälle. Es wurden keine externen Nachrichten verschickt oder Konten angelegt.

## Prüfung und Veröffentlichung

Dokumentationsänderung: Quellenkonfiguration und Statuslogik gelesen, zehn
Platzhalter live bestätigt, sieben Statistik-Endpunkte erfolgreich abgerufen,
amtliche Alternativen geprüft und Breitband-XLSX technisch validiert.
Kein Anwendungscode verändert; daher kein zusätzlicher Build oder Testlauf nötig.
Die Pfadfilter von `ci.yml` und `frontend.yml` schließen reine `docs/`-Änderungen
aus; für diesen Commit sind keine dieser CI-Läufe oder GHCR-Builds vorgesehen.
