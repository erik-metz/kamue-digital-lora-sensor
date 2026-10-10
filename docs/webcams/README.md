# Schritt 1: Quellenauswahl für das regionale Bildarchiv

Stand: 10.10.2026. Ergebnis dieses Schritts ist eine reviewbare Quellenkonfiguration für den nächsten Implementierungsschritt. [Konfiguration](sources.proposed.json) · [erneute Bildprüfung](selection-probes-2026-10-10.json) · [vollständiges Recherche-Inventar](../ried-webcam-vollinventar-2026-10-10.md).

## Auswahl

| Quelle | Bild | Startintervall | Zweck und Einschränkung |
| --- | --- | --- | --- |
| TU / Flugfeld Griesheim | JPEG, 480 × 360 | 60 s | Nordöstlicher Vergleichspunkt am Ried; Horizont/Flugfeld. Die geprüfte Vorschau ist klein; Originalauflösung erst separat prüfen, falls nötig. |
| Melibokus | JPEG, 2048 × 1536 | 300 s | Panorama über die Ebene; großräumige Sichtentwicklung. Der geprüfte Direktabruf verwendet HTTP. Keine TLS-Prüfung abschalten oder fremden Proxy als Originalquelle ausgeben. |
| Flugplatz Heppenheim, Ansicht 2 | JPEG, 2560 × 1920 | 300 s | Freies Flugfeld/Horizont am östlichen Rand; Ansicht 1 derzeit stark verdeckt, Ansicht 3 überwiegend Hangarvorfeld. |
| Flugplatz Oppenheim | JPEG, 1280 × 720 | 60 s | Westlicher Vergleichspunkt außerhalb des Hessischen Rieds, mit viel lokalem Vordergrund. Kein unmittelbarer Messpunkt in Biblis. |

Alle sechs untersuchten Ansichten ließen sich am 10.10.2026 gegen 19:54 Uhr MESZ erneut vollständig dekodieren. Die Sichtprüfung erfolgte bei Dunkelheit. Tagbilder, saisonale Sichtachsen und längere Verfügbarkeit sind damit nicht geprüft. Nachtbeleuchtung, Infrarot, Belichtung und Bildrauschen sind keine direkten Wettermesswerte. Bildausschnitte zunächst beurteilen, bevor daraus Nebel-/Bewölkungswerte abgeleitet werden. Die temporäre Kontaktübersicht wurde nicht veröffentlicht oder ins Repository aufgenommen.

Die Intervalle sind Vorschläge: Griesheim nennt ca. 60 s Browseraktualisierung, Oppenheim explizit 60 s Bildaktualisierung. Heppenheim zeigte in der vorherigen Stichprobe rund fünf Minuten Abstand zwischen Dateizeiten. Die Melibokus-Angabe von fünf Minuten stammt von der einbindenden Wormser Wetterseite. Keine Quelle bestätigt eine maximale erlaubte Abrufrate; `operatorMaximumRateSeconds` bleibt deshalb `null`.

Für die Auswahl werden keine unbestätigten Kamerakoordinaten oder Kompassrichtungen erfunden. Anlagenadressen sind keine Kamerapositionen. Andere Heppenheim-Ansichten bleiben Reserve; Golfkameras, alte Standbilder und Streams gehören nicht zu diesem ersten Snapshot-Satz. Die Autobahn-Metadatenabfrage auf A67/A5/A6 bleibt unabhängig bestehen. Straßenkameras werden erst nach bestätigtem Medienzugriff für eine spätere Verkehrsauswertung ergänzt.

## Betreiberbedingungen

Die Konfiguration trennt technischen Zugriff und nachgewiesene Nutzungsmöglichkeiten. Die folgenden Angaben sind dokumentierte Anbieterhinweise, keine abschließende rechtliche Bewertung:

- [TU-Impressum](https://www.tu-darmstadt.de/impressum/index.de.jsp), Abschnitt Urheberrecht: Veröffentlichung/Verwendung eigener Inhalte in anderen Publikationen setzt ausdrückliche Zustimmung voraus. Automatisierter Abruf, internes Archiv und Analyse sind dort nicht gesondert freigegeben.
- [Heppenheim-Impressum](https://aeroclub-heppenheim.de/impressum/): Downloads/Kopien werden für privaten, nicht kommerziellen Gebrauch beschrieben; weitergehende Verwertung setzt schriftliche Zustimmung voraus. Für unser Projekt keine passende Zusage nachgewiesen.
- [Oppenheim-Impressum](https://aeroclub-oppenheim.de/kontakt/): Betreiber bittet um Kontaktaufnahme vor Verwendung von Inhalten. Keine abweichende Webcam-Lizenz gefunden.
- Melibokus: Direkte Bildquelle technisch bestätigt; Betreiberkontakt und konkrete Nutzungsbedingungen noch nicht bestätigt. Kein Transfer der Bedingungen einer verlinkenden Wetterseite auf das Originalbild.

Für alle vier Quellen bleiben automatisierter Dauerabruf, Archivierung, Analyse und erneute Veröffentlichung getrennt als `not_confirmed` dokumentiert. Es wurde kein Betreiber angeschrieben. Diese offenen Quellenbedingungen verhindern weder die Umsetzung des Collectors noch dessen Tests mit eigenen/synthetischen Bildern. Eine produktive Aktivierung ist eine separate Entscheidung nach geklärter Quellennutzung.

Bei einer späteren Betreiberanfrage sind konkret zu nennen: Forschungs-/Umweltvergleich für das Ried, obige Intervalle, Speicherung von Originalbildern auf eigener VPS, beabsichtigte Aufbewahrungsdauer, Ableitung von Wettermerkmalen, etwaige Bildveröffentlichung, gewünschte Quellenangabe und technische Limits. Antworten samt Datum und erlaubten Nutzungsarten pro Quelle festhalten.

## Konfigurationsvertrag für Schritt 2

`sources.proposed.json` ist bewusst **kein** Eintrag im bestehenden `registry-sync-worker/sources.json`: Der bisherige Adapter `autobahn-inventory` speichert Metadaten und lädt keine Kamerabilder. Ein externer JPEG-Abruf benötigt einen eigenen Snapshot-Collector. `runtimeIntegrated=false` und `enabled=false` verhindern, dass der Vorschlag als laufender Import ausgegeben wird.

Die stabilen Quellenkennungen sind für Bildpfade und Datenbankreferenzen vorgesehen. `inventoryId` verweist auf den Rechercheeintrag. Quellaktualisierung, eigenes Intervall und bekannte maximale Betreiberrate sind getrennte Felder. `lastProbeAt` bezeichnet nur die letzte technische Prüfung. `captureTime=null` bleibt bestehen, solange kein zuverlässiger Aufnahmetimestamp aus der Quelle vorliegt; HTTP Last-Modified und Abrufzeit nicht automatisch als Aufnahmezeit übernehmen.

Für den Collector sind 15 s Timeout, maximal 5 MB pro Antwort, strikte JPEG-Dekodierung und SHA-256-Deduplizierung vorgesehen. Redirects werden zunächst nicht verfolgt; veränderte Ziele bedürfen erneuter Quellenprüfung. TLS bleibt geprüft. Der spätere Collector muss die Konfiguration validieren und nur aktivierte Quellen verarbeiten. Er benötigt eigene, begrenzte Wiederholungen, Backoff bei Fehlern, Dateischreiben über temporäre Dateien und eine eindeutige Zuordnung zur Datenbank.

Auf Basis dieser abendlichen Stichprobe ergeben sich bei jedem Abruf eines neuen Bildes etwa **317 MB pro Tag** für die vier Quellen vor Deduplizierung. Das ist eine Größenordnung, keine gemessene Tagesmenge oder zugesagte Obergrenze: Tagesbilder können erheblich größer sein. Speicherfrist und hartes globales Speicherlimit werden in Schritt 2 explizit konfiguriert und aus realen Größen nachjustiert.

## Übergabe

Schritt 1 ist abgeschlossen: vier konkrete Quellen, geprüfte Direktbilder, begründete Auswahl und Intervalle sowie getrennte offene Nutzungs-/Geometrie-/Qualitätsfragen liegen vor. Die Quellen sind fachliche Kandidaten, keine freigegebenen produktiven Imports.

Schritt 2 implementiert Snapshot-Collector, Dateispeicherung und Datenbank-Metadaten. Verifikation zunächst mit lokalen Testbildern: vollständiges Bild, unverändertes Bild, defektes JPEG, Antwortlimit, Timeout und fehlgeschlagenes Dateischreiben. Produktiven Dauerabruf erst gezielt pro Quelle aktivieren. In diesem Schritt wurden keine Laufzeitdateien oder VPS-Container verändert.
