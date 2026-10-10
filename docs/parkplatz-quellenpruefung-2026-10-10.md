# Parkplatz-Doppelmarker: Quellenprüfung vom 10.10.2026

## Ergebnis

Die doppelten Symbole entstehen im Frontend: `MapComponent` zeigt rast-monitor-Sensoren, `MapRestAreaLayer` zeichnet seit der Inventarerweiterung zusätzlich dieselben Standorte aus dem Autobahn-Inventar. Die separate Inventarebene verwendete blaue Quadrate mit nach oben versetztem Anker. Sie ist keine zusätzliche Belegungsquelle.

Live-Abgleich der öffentlichen APIs: 9 regionale A67-, 14 A5- und 3 A6-Inventareinträge. Alle 26 besitzen genau einen rast-monitor-Treffer mit identischer DATEX-Kennung und konsistenter Geometrie. Gegenfahrbahnen haben eigene Kennungen. Der Vergleich steht unter `evidence/parking-source-audit-2026-10-10/parking-comparison.json`; Zeitstempel beziehen sich auf die jeweilige Quelle. Die Produktionsdatenbank wurde dabei nicht direkt abgefragt.

## Backend und Bedeutung der Angaben

- `registry-sync-worker/autobahn_inventory.py` speichert statische PKW-/LKW-Inventare unter `infrastructure/autobahn/{road}/rest-areas`. Diese werden über die Collected-API gelesen, ohne Telemetriesensoren zu erzeugen.
- `rast-collector` erzeugt `rast-{datex_id.lower()}`-Sensoren und dynamische LKW-Telemetrie. Kapazität: `total_spaces`, ersatzweise `official_spaces`. Freie Plätze: `vacant_spaces`, ersatzweise aus Kapazität und `occupancy_pct` berechnet, mindestens null. `fetched_at` ist die Datenzeit, keine garantierte Messzeit.
- Beispiel Lorsch West: Inventar 32 LKW, rast-monitor offiziell 32, insgesamt 42, Belegung 140 %, freie Plätze null. Lorsch Ost: 51 / 51 / 77, Belegung 110 %, freie Plätze null. Die Anzeigen `0/42` und `0/77` entsprechen der bestehenden Collector-Logik.
- Nicht alle Konflikte lassen sich so erklären: Wildbahn meldet Inventar 22, rast-monitor offiziell 28 und insgesamt 37. Es gibt keinen hinreichenden Aktualitätsnachweis, um eine Kapazität pauschal als richtig zu erklären. Keine Addition, kein Überschreiben dynamischer Belegung durch statisches Inventar. Auch fehlende Belegung (z. B. Dirmsteiner Pfad) bedeutet nicht null freie Plätze.

Die Quellenspeicher überschneiden sich bei den Standorten, enthalten aber unterschiedliche Datenarten. Eine Löschung eines Collectors würde Informationen verlieren. Der Fehler wird bei der Darstellung behoben: eindeutiger Identitätstreffer → nur bestehender lila Marker; ohne Treffer → ergänzender Marker im gleichen Stil. Zusatzinformationen und Konflikte bleiben in der Inventarliste sichtbar.

## Ladesäulen

Direkte BNetzA- und Esri-Einträge werden bereits nach BNetzA-ID dedupliziert, der direkte Import gewinnt. Autobahn-Angebote besitzen keine nachgewiesene gemeinsame Registerkennung. Der bestehende 75-m-Abgleich bezeichnet ausschließlich mögliche räumliche Überschneidungen; Kapazitäten werden nicht addiert. Mehrere Autobahn-Angebote am exakt gleichen Punkt mit gleicher Autobahn und Richtung teilen bereits einen Marker. Ohne belegte Identität bleibt ein Autobahn-Angebot ein separater Datensatz. Alle Lade-Marker verwenden jetzt das bestehende grüne Ladestationsdesign und denselben zentrierten Anker; die Quelle ist im Popup erkennbar.

Quellen: https://rast-monitor.de/api/sites und https://verkehr.autobahn.de/o/autobahn/{A67,A5,A6}/services/parking_lorry. Der Live-Abgleich prüft die öffentlich angebotenen Werte, keine tatsächliche physische Belegung vor Ort.
