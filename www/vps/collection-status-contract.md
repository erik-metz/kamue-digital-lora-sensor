# Quellenstatus: Abruf und Verarbeitung

`GET /v1/collection/status` bleibt abwärtskompatibel. Bestehende Felder und
Statuswerte werden beibehalten. Die Quellenseite wird in Schritt 2 angepasst.

Zusätzliche Felder je Quelle:

- `http_status`: HTTP-Antwort des letzten Versuchs, soweit bekannt.
- `fetched_at` / `last_fetch_success_at`: Zeitpunkt des aktuellen bzw. letzten
  erfolgreichen Downloads. Dies belegt noch keine nutzbaren Daten.
- `processed_at`: Abschluss des letzten Versuchs mit `success` oder `partial`.
- `last_processed_at`: letzter gemeldeter vollständiger Verarbeitungsabschluss.
- `completion_recorded`: für diesen Versuch liegt ein Abschlusszeitpunkt vor.
  Dies ist eine Collector-Meldung, keine unabhängige Qualitätsprüfung.
- `item_count` / `item_count_unit`: tatsächlich verarbeitete Datenmenge, soweit
  der Collector sie meldet. `null` bedeutet unbekannt, niemals null Datensätze.
- `published_dataset_count`: Anzahl der aktuell veröffentlichten Dataset-Einträge;
  kein Messwertzähler und kein Ersatz für `item_count`.
- `error_stage`: `acquisition`, `processing` oder `storage`, soweit bestimmt.

Neue Abschlüsse erhalten ihren Zeitpunkt durch einen Datenbanktrigger innerhalb
derselben Transaktion. Historische Einträge werden nicht rückwirkend umgedeutet.
Die additive Migration `20261007_collection_status.sql` läuft beim API-Start auch
auf der bereits migrierten kanonischen Datenbank. Vor dem Collector-Rollout muss
sie angewendet sein. Der Bootstrap enthält dieselbe idempotente Migration.

EMF und TTN Mapper protokollieren jeden produktiven Zyklus einschließlich
Fehlern. Erfolg wird erst nach bestätigter Speicherung gemeldet. EMF meldet
fehlgeschlagene Detailabrufe als Teilerfolg; leere regionale Importe werden als
Teilerfolg mit Menge 0 gekennzeichnet. Dry-runs schreiben keine Statushistorie.

Der Umwelt-Collector schließt nur die konkreten Receipt-IDs seines Zyklus ab.
Downloads ohne verwertbare Beobachtungen erhalten `partial`, Menge 0 und eine
Verarbeitungsmeldung. HTTP-Fehler und abgebrochene Verarbeitungen bleiben Fehler.
Ein Nullwert als echte Messung (z. B. kein Regen) zählt weiterhin als Beobachtung.

Andere Collector behalten ihre vorhandene fachliche Erfolgsdefinition; neue
Abschlüsse erhalten einen Zeitpunkt. Nicht gemeldete Mengen/Fehlerphasen bleiben
unbekannt. Insbesondere ein Verbindungsstatus von Live-Feeds belegt keine
vollständige Abdeckung. Die Bereinigung der einzelnen Adapter folgt in den
weiteren Schritten, statt alte Erfolgseinträge nachträglich zu erfinden.
