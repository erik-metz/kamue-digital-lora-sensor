# Webcam-Snapshots – Schritt 2

Der Adapter `webcam-snapshot` archiviert vollständige Original-JPEGs im
persistenten Volume `sync_state`. Die vier ausgewählten Quellen sind in
`sources.json` integriert, bleiben aber deaktiviert. Auswahl und offene
Betreiberbedingungen: [Quellendokumentation](../../../docs/webcams/README.md).

## Betrieb

- `WEBCAM_ARCHIVE_DIR=/data/webcam-snapshots`: eigenes Archivverzeichnis.
- `WEBCAM_ARCHIVE_MAX_BYTES=5000000000`: globales Limit in Bytes, über
  Compose konfigurierbar. Beim Erreichen werden neue Bilder abgewiesen und
  Fehler protokolliert; vorhandene Bilder bleiben erhalten.
- Pro Quelle: `interval_seconds` (mindestens 60), `timeout_seconds` (15),
  `max_response_bytes` (5 MB), `max_pixels` (20 Millionen) und
  `http_retries` (1, maximal 2).
- Ein Versuch dauert höchstens zweimal den konfigurierten Timeout.
  Wiederholungen warten 1 bzw. 2 Sekunden; der Scheduler verwendet zusätzlich
  seinen Fehler-Backoff. Erfolgreiche Zyklen warten mindestens das konfigurierte
  Intervall, mit bis zu 10 Prozent zusätzlicher Zufallsverzögerung.
- TLS wird geprüft. Redirects sind Fehler. Nur Melibokus erlaubt ausdrücklich
  HTTP. Änderungen der Bildadresse vorher prüfen.

Manifestprüfung im Worker: `python main.py --dry-run`.
Nach gezielter Aktivierung einer Quelle kann ein einzelner Import mit
`python main.py --job ried-griesheim-flugfeld` ausgeführt werden.
Bei deaktivierter Quelle erfolgt dabei kein HTTP-Abruf; der Status lautet
`not_configured`. Dauerbetrieb übernimmt der bestehende Worker-Scheduler.
Aktivierungen benötigen eine dokumentierte Entscheidung zu den offenen
Nutzungsbedingungen; diese Implementierung aktiviert keine Quelle.

## Datenvertrag

`webcam_snapshot_images` enthält je Quelle und SHA-256 ein Originalbild:
relativer Dateipfad, Bytezahl, Breite, Höhe und erste Beobachtungszeit.
Dateipfad: `<source_id>/<sha256>.jpg`. Binärbilder werden nicht in
`collected_payloads` oder Git gespeichert.

`webcam_snapshot_observations` enthält jede erfolgreiche Abfrage, auch
unveränderte Bilder und HTTP 304, mit Verweis auf Bild und
`collection_attempts`, Abrufzeit, HTTP-Status, ETag und Last-Modified.
`capture_time` bleibt NULL: Abrufzeit und HTTP-Dateizeit sind kein
nachgewiesener Aufnahmezeitpunkt. `item_count` zählt neu angelegte
Bilddatensätze, nicht Beobachtungen.

ETag/Last-Modified werden für bedingte Abfragen verwendet, solange die lokale
Datei existiert. Eine fehlende Datei wird beim nächsten vollständigen Abruf
repariert. HTML, beschädigte JPEGs und übergroße Antworten werden verworfen.
Endgültige Fehler werden durch den Worker in `collection_attempts`
protokolliert; interne Wiederholungen erzeugen keine separaten Beobachtungen.

Dateien werden temporär geschrieben, synchronisiert und atomar umbenannt.
Ein datenbankweiter Archiv-Lock serialisiert Quotenprüfung und Veröffentlichung;
der bestehende Quellen-Lock verhindert parallele Imports derselben Quelle.
Schlägt die DB-Transaktion fehl, wird eine gerade neu geschriebene Datei entfernt.
Ein Prozessabbruch zwischen Dateiveröffentlichung und DB-Commit kann eine
verwaiste Datei hinterlassen; sie zählt weiterhin gegen die Quote.
DB und Volume gemeinsam sichern. Nicht unabhängig Dateien löschen.

Die Migration `20261010_webcam_snapshots.sql` wird beim API-Start auch auf
bestehenden Datenbanken ausgeführt; Neuinstallationen erhalten die Tabellen
über `schema.sql`. Der Worker wartet auf die gesunde API.

## Prüfung und nächster Schritt

Die Integrationstests verwenden synthetische JPEGs, einen HTTP-Mock,
ein temporäres Archiv und echtes PostgreSQL. Sie prüfen Deduplizierung,
Bildwechsel, HTTP 304, defekte Antworten, Limits, Timeouts, Wiederholungen,
Dateischreibfehler, DB-Rollback und Reparatur fehlender Dateien.

Schritt 3 ergänzt Aufbewahrungsfristen, Bereinigung verwaister Dateien,
Qualitäts-/Stillstandserkennung und daraus abgeleitete Merkmale.
Automatische Löschung und Bildanalyse sind hier noch nicht implementiert.
Das harte Limit begrenzt bis dahin das Wachstum.
