# Webcam-Snapshots – Schritte 2 und 3

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

## Aufbewahrung und automatische Bereinigung

Der Worker bereinigt beim Start und danach stündlich. Der separate Wartungslauf
funktioniert unabhängig von aktivierten Quellen und benötigt keinen HTTP-Zugriff.
Manuell: `python main.py --webcam-maintenance`. Die Ausgabe nennt gelöschte
Beobachtungen, Bilddatensätze, Dateien und freigegebene Bytes; der Dauerbetrieb
protokolliert dieselben Zähler. Fehler werden protokolliert und im nächsten
Zyklus erneut versucht.

- `WEBCAM_RETENTION_DAYS=14`, zulässig 1–365: ältere Beobachtungen werden
  entfernt, anschließend Bilddatensätze ohne verbleibende Beobachtung.
- **Die letzte erfolgreiche Beobachtung jeder Quelle und ihr Bild bleiben
  erhalten**, auch bei deaktivierter oder lange ausgefallener Quelle. Dies ist
  eine ausdrückliche Ausnahme von der Frist.
- `WEBCAM_ORPHAN_GRACE_SECONDS=86400`, zulässig 3600–604800: nicht mehr
  referenzierte JPEGs und unterbrochene temporäre Dateien werden erst nach
  dieser Schonfrist seit Dateimodifikation gelöscht.
- Nur die erzeugten Pfad-/Dateinamensformen im eigenen Archiv werden bereinigt.
  Fremde Dateien und Symlinks bleiben erhalten.
- Die gemeinsame Archiv-Sperre verhindert Überschneidungen mit dem Collector.
  Zuerst wird die Löschung der Metadaten committed; anschließend werden unter
  erneuter Sperre die aktuellen Dateireferenzen geprüft und verwaiste Dateien
  gelöscht. DB-Rollback löscht dadurch keine referenzierten Bilder. Bei
  Dateifehlern oder Prozessabbruch werden Restdateien im nächsten Zyklus erfasst.
- `collection_attempts` bleibt als übergreifendes Import-Audit erhalten;
  diese Wartung löscht ausschließlich Webcam-Beobachtungen, Bilddatensätze
  und zugehörige Archivdateien. Bereits vorhandene allgemeine Audit-Regeln
  werden nicht ersetzt.

Das 5-GB-Limit gilt weiterhin, einschließlich Restdateien und Schonfrist.
Die Frist ist keine Zusage, dass 14 Tage in die Quote passen: bei größeren
Bildern kann der Import vorher wegen voller Quote scheitern. Die Bereinigung
löscht keine jüngeren, referenzierten Bilder, um Platz zu erzwingen.

## Erkennung unveränderter Bilder

Jede erfolgreiche Beobachtung speichert zusätzlich `unchanged_since`,
`unchanged_observations` und `quality_status`:

- `fresh`: Beginn einer Beobachtungsfolge oder geänderter SHA-256.
  Das bedeutet nicht, dass der Aufnahmezeitpunkt nachgewiesen ist.
- `unchanged`: dieselben JPEG-Bytes wie beim vorherigen erfolgreichen Abruf,
  auch bei HTTP 304.
- `suspected_stale`: mindestens drei aufeinanderfolgende Beobachtungen und
  mindestens `stale_after_seconds` ohne Änderung. Für die vier Quellen sind
  zunächst 1800 Sekunden eingestellt; der effektive Grenzwert beträgt
  mindestens drei Quellenintervalle. Zulässige Konfiguration: 180–604800 s.

Eine Lücke über `max(900 s, 3 × Intervall)` oder eine rückwärts laufende
Abrufuhr setzt die Folge zurück. Fehlgeschlagene Abrufe liefern keine
Bildbeobachtung. Bildwechsel setzt Zähler und Verdachtsstatus zurück.
Die Folge wird in PostgreSQL gespeichert und übersteht Worker-Neustarts sowie
die Aufbewahrungsbereinigung. Ein Verdachtsstatus blockiert keine Speicherung.

Identische Bytes sind ein Hinweis, kein Beweis für eine eingefrorene Kamera:
Nachtbilder, ruhige Szenen oder vorgeschaltete Caches können das ebenso
verursachen. Umgekehrt erkennt der SHA-Vergleich neu komprimierte oder mit
wechselnder Uhr eingeblendete Standbilder nicht zuverlässig. HTTP-Dateizeit
und Abrufzeit werden weiterhin nicht als Aufnahmezeit ausgegeben.
Wettermerkmale, Nebelerkennung und semantische Bildanalyse sind nicht Bestandteil
dieses Schritts.

Letzten Status abfragen:

```sql
SELECT DISTINCT ON (source_id)
       source_id, observed_at, quality_status,
       unchanged_since, unchanged_observations
FROM webcam_snapshot_observations
ORDER BY source_id, id DESC;
```

Die zusätzliche Migration `20261010_webcam_retention.sql` läuft beim API-Start
nach der Snapshot-Migration und ist wiederholbar; bestehende Beobachtungen
bleiben erhalten. Für alte Beobachtungen beginnt die Evidenzkette ohne erfundene
historische Bildwechsel.

## Verifikation

Die Tests verwenden synthetische JPEGs, einen HTTP-Mock, ein temporäres Archiv
und echtes PostgreSQL. Sie prüfen Bildwechsel, Deduplizierung, HTTP 304,
defekte Antworten, Limits, Timeouts, Wiederholungen, Dateischreibfehler,
DB-Rollbacks, Reparatur fehlender Dateien, Retention mit gemeinsam referenzierten
Bildern, Orphan-Schonfrist, Symlinks, wiederholte Bereinigung, Wiederaufnahme
nach Löschfehlern, Archiv-Sperren, Migration bestehender Daten sowie Persistenz
und Rücksetzung des Stillstandsverdachts.
