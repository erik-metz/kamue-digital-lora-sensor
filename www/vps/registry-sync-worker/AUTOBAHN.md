# Autobahn-Infrastruktur im Ried (Schritt 3)

Der Adapter `autobahn-inventory` ruft täglich sechs unabhängige Listen ab: Ladeangebote und Rastplätze auf A67, A5 und A6. Die Auswahl erfolgt ausschließlich über Koordinaten im Ausschnitt 49,45–49,90° N / 8,25–8,75° E. Das ist der dokumentierte regionale Kandidatenausschnitt, keine administrative Ried-Grenze. B44/B47 gehören nicht zu dieser Quelle.

## Speicherung und Zugriff

Die bestehenden Tabellen `collected_payloads`, `collection_attempts`, `collected_dataset_versions` und `collected_datasets` speichern unveränderte HTTP-Antworten, Abrufstatus, historische Beobachtungen und den letzten gültigen Bestand. Gleiche Rohdaten werden über SHA-256 dedupliziert. Jede erfolgreiche Beobachtung bleibt datiert in der Versionshistorie. Es ist keine neue Datenbankmigration erforderlich.

Die bestehende Lese-API liefert nach dem ersten erfolgreichen Collector-Lauf:

- `/api/v1/collected/infrastructure/autobahn/A67/charging`
- `/api/v1/collected/infrastructure/autobahn/A67/rest-areas`
- dieselben Pfade mit `A5` bzw. `A6`.

Antwort: `records`, `road`, `kind`, `bbox`, `complete`, `observedAt`, `sourceUpdatedAt`, `timestampBasis` und `availabilityBasis`. `observedAt` ist die Abrufbeobachtung. Ein Anbieteraktualisierungsdatum ist nicht belegt: `sourceUpdatedAt=null`, `timestampBasis=collector_observed`. Die vorhandene interne Spalte `source_updated_at` dient für diese Datensätze als Beobachtungs-/Versionszeit; die API benennt sie deshalb als `X-Inventory-Observed-At`, nicht als Anbieteraktualisierung. `X-Collected-At` und `X-Data-Expires-At` bleiben verfügbar. Nach 72 Stunden ohne erfolgreiche Beobachtung liefert die API 503 statt veralteter Daten als aktuellen Bestand.

Ladeangebote erhalten Originalkennung, Autobahn, Zielrichtung, Koordinaten, Ladepunkte mit ihren Steckertypen und kW-Angaben sowie den vollständigen Originaldatensatz unter `raw`. `maxPointPowerKw` bezeichnet die höchste gemeldete Ladepunktleistung, keine gesamte Anschlussleistung. Mehrere Steckertypen desselben Ladepunkts erhöhen die Punktzahl nicht. Unbekannte Werte bleiben `null`; ungewöhnliche Anbieterangaben wie 4 kW werden nicht korrigiert.

Rastplätze erhalten gemeldete PKW-/LKW-Kapazität. Eine Kapazität von null ist ein bekannter Wert; fehlende Kapazität bleibt unbekannt. Freie Plätze, Ladebelegung, Preise und Betriebszustand werden nicht abgeleitet. `providerBlocked` und `providerFuture` sind gesonderte Anbieterkennzeichen ohne Umdeutung als Live-Belegung.

Anbieterkennungen, Fahrtrichtungen und mehrere Angebote an derselben Raststätte bleiben getrennt. Der Adapter überschreibt weder `infrastructure/ev-charging` noch den BNetzA-Kartenlayer. Ohne belastbare gemeinsame Kennung wird kein automatischer Standortabgleich durchgeführt (`reconciliationBasis=separate_provider_inventory`). Ebenso ersetzt das statische Rastplatzinventar keine dynamischen Rast-Monitor-Messwerte. Die Daten sind in diesem Schritt über die Daten-API nutzbar; eine gemeinsame Karten-/Detaildarstellung benötigt einen gesonderten Abgleich.

## Fehlerverhalten und Betrieb

Jede Autobahn/Kategorie hat eine eigene Quellenkennung und einen unabhängigen Zeitplan. Fehlende Listen, ungültige Koordinaten, widersprüchliche Kennungen, nicht interpretierbare Beschreibungsstrukturen oder HTTP-Fehler erhalten den letzten gültigen Bestand. Eine nachweislich vollständige leere Liste ersetzt ihn dagegen durch einen leeren Bestand. Fehler und ihre Rohantworten bleiben archiviert. Erfolgreiche andere Quellen bleiben unabhängig davon nutzbar.

Die sechs Quellen sind im Standardmanifest aktiviert und starten über den bestehenden Infrastruktur-Scheduler des Registry-Sync-Workers. Nach Aktualisierung des VPS-Containers kontrollieren: sechs Quellen im Quellenstatus, erfolgreiche Abrufe, API-Antworten und Ablaufzeiten. Ein GHCR-Push allein bestätigt noch keinen laufenden Import auf dem VPS.

## Nachweis

Live-Prüfung vom 10.10.2026: A67 8 Ladeangebote / 9 Rastplätze, A5 3 / 14, A6 0 / 3 im Ausschnitt. Die Tests verwenden zusätzlich die gesicherte Evidenz vom 09.10.2026 und prüfen Parser, Rohdatenarchiv, Versionshistorie, Fehlererhalt, vollständige Leerlisten und die tatsächliche Datenbank→Lese-API-Kette einschließlich Ablauf und Zeitheader.

[API-Spezifikation](https://github.com/bundesAPI/autobahn-api/blob/main/openapi.yaml) · [Bestandsaufnahme](../../../docs/autobahn-api-bestandsaufnahme-2026-10-09.md)
