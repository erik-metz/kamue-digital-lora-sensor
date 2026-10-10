# Autobahn-Integration: Planabgleich am 10.10.2026

Der Abgleich bezieht sich auf die im Repository dokumentierten nächsten Umsetzungsschritte der [Bestandsaufnahme](autobahn-api-bestandsaufnahme-2026-10-09.md), die darauf folgenden Implementierungen und die öffentlich abrufbaren gespeicherten Daten. Ein ursprünglicher darüber hinausgehender Chat-Plan liegt hier nicht als vollständiges Dokument vor.

| Teil | Stand | Nachweis |
| --- | --- | --- |
| Regionale Datenbestandsaufnahme A67/A5/A6 | umgesetzt | Bestandsaufnahme und echte Listen-/Detailantworten vom 09.10. |
| Verkehr: aktuelle/geplante Ereignisse, Bauphasen, Sperrungsarten, Fahrtrichtung und unbekannte Verzögerung | umgesetzt | Traffic-Collector, Migration `20261009_traffic_events.sql`, Ereignis-API und Kartenfilter |
| Lade- und Rastplatzinventare dauerhaft importieren | umgesetzt und produktiv abrufbar | Neun unabhängige Quellen einschließlich Webcam-Discovery; Rohdaten, Versionen, Fehlerschutz und Ablauf über bestehende Registry-Pipeline |
| Ladeangebote in der Karte mit Registerabgleich | umgesetzt | Separate Anbieterangebote; räumliche Kandidaten bleiben unbestätigt; keine Addition von Kapazitäten |
| Rastplatzinventare mit Belegungsdaten verbinden | umgesetzt | Exakte DATEX-Kennung und Standortprüfung; Quellenkapazitäten getrennt; Belegung maximal 30 Minuten alt |
| Webcam-Metadaten wiederholt prüfen und speichern | umgesetzt | Drei tägliche Discovery-Quellen mit erfolgreichen vollständigen Leerbeständen |
| Webcam-Bilder auf dem VPS archivieren / später auswerten | offen, durch fehlende regionale Quelle blockiert | A67/A5/A6 liefern weiterhin keine regionalen Kameras; kein prüfbares Bild oder Stream verfügbar |
| B44/B47 | außerhalb dieser API | Die Autobahn-API belegt keine Bundesstraßenabdeckung; vorhandene andere Verkehrsquellen bleiben zuständig |
| Verständliche Benennung im Quellenmonitor | mit diesem Abschluss ergänzt | Namen für alle sechs Inventar- und drei Webcam-Quellen samt Anbieter und Fachbereich |

## Produktiver Datenstand

Die [maschinenlesbare Abschlussprüfung](evidence/autobahn-api-2026-10-10/completion-check.json) enthält Prüfzeit, öffentliche Pfade, HTTP-Status, Bestandszahlen, Beobachtungszeiten, Ablaufzeiten und die neun zugehörigen Quellenberichte. Alle neun Quellen sind aktiviert, auf 86.400 Sekunden eingestellt und melden bestätigte erfolgreiche Verarbeitung sowie jeweils eine veröffentlichte Datenmenge. Die Mengen einzelner Einträge sind im Quellenstatus nicht gemeldet (`item_count=null`); die folgenden Werte stammen aus den tatsächlichen Inventarantworten.

| Autobahn | Ladeangebote | Rastplätze | Kameras |
| --- | ---: | ---: | ---: |
| A67 | 8 | 9 | 0 |
| A5 | 3 | 14 | 0 |
| A6 | 0 | 3 | 0 |

Alle neun gespeicherten Endpunkte liefern HTTP 200. Inventar-Beobachtung am 10.10.2026 gegen 11:44 UTC; Ablauf am 13.10. gegen 11:44 UTC. Abrufzeit ist keine bestätigte Anbieteraktualisierung. Die Verkehrs-API liefert für `event_status=active` und `planned` ebenfalls HTTP 200; deren Gesamtzahlen umfassen weitere integrierte Verkehrsquellen und sind deshalb kein reiner Autobahn-Bestand.

## Verbleibende Arbeit am Bildarchiv

Das Bildarchiv ist ausdrücklich noch nicht implementiert. Sobald die Discovery eine regionale Referenz liefert, muss zunächst festgestellt werden, ob sie ein Einzelbild, einen Stream oder eine Playerseite liefert. Danach folgen eine begrenzte Prüfung von Bildwechseln, Quellzeitstempeln und Speicherbedingungen sowie die Festlegung von Abrufrate, Deduplizierung, Aufbewahrung und Speicherlimit. Erst mit diesen Befunden ist eine belastbare Implementierung und Prüfung möglich. Zehn Sekunden bleiben eine mögliche Anforderung, kein derzeit belegtes Quellintervall.

Die täglichen Discovery-Läufe erkennen neue Metadaten im bestehenden Quellenbestand. Sie starten bislang weder Medienabrufe noch Bildarchivierung oder eine gesonderte Benachrichtigung automatisch. Es wurde keine neue Automation angelegt.

## Prüfgrenzen und Veröffentlichung

Die Verkehr-, Collector- und Kartenimplementierungen wurden in ihren jeweiligen Umsetzungsschritten getestet und veröffentlicht. Dieser Abschluss ergänzt Quellenbeschriftungen und dokumentiert einen aktuellen API-/Quellenstatusabgleich. Er ist keine mehrtägige Zuverlässigkeitsmessung, keine erneute Prüfung sämtlicher Container und kein Nachweis eines neuen Frontend-Produktivdeployments.

Für diese Änderung sind Quellenregressionstests, ESLint, Typprüfung und Frontend CI relevant. VPS-Code und Deployment wurden hier nicht geändert. Frühere Prüfdetails: [Ladeabgleich](autobahn-ladeinfrastruktur-kartenabgleich.md), [Rastplatzabgleich](autobahn-rastplaetze-belegungsabgleich.md).
