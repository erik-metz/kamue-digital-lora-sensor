# GBIF-Fundmeldungen im Ried

Schritt 4 ergänzt den bestehenden Environment Collector um einen optionalen,
täglich aktualisierten GBIF-Suchausschnitt. Es entstehen keine zusätzlichen
Datentabellen: Meldungen liegen in `entities`, `measurement_definitions` und
`readings`; die vorhandene Rohdatenarchivierung bleibt erhalten.

## Umfang und Aussage

- Quelle: https://api.gbif.org/v1/occurrence/search
- Rechteck: 8.35–8.65° Ost, 49.55–49.76° Nord, Land DE. Das ist ein
  Suchausschnitt des Rieds einschließlich angrenzender Orte, keine Gemeindegrenze.
- Filter: `hasCoordinate=true`, `hasGeospatialIssue=false`,
  `occurrenceStatus=PRESENT`, Jahr des Abrufs minus fünf bis aktuelles Jahr.
- Höchstens zehn Seiten mit je 300 Meldungen, also 3.000 Meldungen täglich.
  GBIF bestimmt die Suchreihenfolge; es wird keine Sortierung nach aktuellstem
  Fund zugesichert. Erst die übernommenen Meldungen werden nach Fundtag sortiert.
- `matched` ist die Trefferzahl der Quelle, `scanned` die gelesene Anzahl,
  `skipped` die wegen fehlender Tagesgenauigkeit, ungültiger Koordinaten,
  unzureichender Taxonomie oder unbekannter Lizenz ausgelassenen Meldungen.
  `source_truncated` zeigt ausdrücklich eine unvollständige Auswahl an.
- Die Live-Probe vom 06.10.2026 liefert 99.094 Treffer seit 2021 für diese Filter.
  Die Auswahl ist weder vollständig noch eine repräsentative Stichprobe.
- Fundmeldungen belegen gemeldete Vorkommen, nicht Individuenbestände,
  Artenreichtum des ganzen Gebiets oder Abwesenheit anderer Arten. Mehrere
  Datensätze können dieselbe biologische Beobachtung melden; nur identische
  GBIF-IDs werden als Duplikate verworfen.

## Speicherung und Nachvollziehbarkeit

Jede HTTP-Antwort wird vor dem Parsen unverändert in `collected_payloads`
archiviert; ihr Abruf steht in `collection_attempts`. Alle Seiten müssen
zusammenhängend sein und dieselbe Gesamtzahl melden. Eine kaputte Seite,
unerwartete Duplikate oder wechselnde Trefferzahlen verhindern die komplette
Übernahme. Der bisherige sichtbare Snapshot bleibt bestehen. Die Suche bietet
keine transaktionale Momentaufnahme; gleichbleibende Trefferzahlen garantieren
keinen unveränderten Suchindex zwischen Seiten.

Entity `environment:gbif:<GBIF-ID>`, Metrik `occurrence_presence`, Wert `1`,
Einheit `count`, Datenart `observation`: eine veröffentlichte Vorkommensmeldung.
Der UTC-Zeitstempel repräsentiert ausschließlich den bekannten Fundtag;
`date_precision=day` bewahrt diese Einschränkung. Es wird keine Uhrzeit behauptet.
Mehrtagige Ereignisse und Datierungen ohne Jahr/Monat/Tag werden ausgelassen.

Provenienz enthält GBIF-ID, wissenschaftlichen Namen und Taxonomie-IDs,
Belegtyp, Original-Datumsangabe, Datensatz-/Herausgeber-ID, Qualitätskennzeichen,
Lizenz und Ortsreferenz samt Koordinatenunsicherheit. Fehlende/ungültige
Unsicherheit wird `null`, niemals null Meter. Zurückgehaltene und vergröberte
Angaben werden bewahrt. Personenangaben und Medien werden nicht in die
Messwert-Provenienz kopiert; das unveränderte Roharchiv enthält die
Originalantwort. Medien besitzen gegebenenfalls abweichende Nutzungsrechte.

Akzeptierte Lizenzen: CC0 1.0, CC BY 4.0, CC BY-NC 4.0. Jede Meldung behält die
konkrete Lizenz des herausgebenden Datensatzes; es gibt keine pauschale
GBIF-Lizenz. Die Übersicht verlinkt Meldung, Datensatz und Lizenz.

Die SHA-256-Kombination der geordneten Seiten identifiziert einen Snapshot in
Definition-Dimensionen. Wiederholte identische Inhalte erzeugen keine neuen
Readings oder Revisionen. Neue Snapshots bleiben historisch getrennt.
Ein atomar aktualisierter Monitoring-Entity-Marker wählt den sichtbaren Stand,
auch wenn der neue Abruf keine gültigen Meldungen enthält. Die Transaktion
prüft Rohdaten, Hashes, Belege, Abrufdatum und Normalisierung nochmals.
Ein Advisory Lock serialisiert parallele Übernahmen. Alte Snapshots verbleiben
im Messwertarchiv; eine automatische Löschung ist nicht eingerichtet.

## API und Oberfläche

`GET /api/v1/environment/measurements/biodiversity?limit=100&offset=0`
liest einen Snapshot mit bis zu 300 Meldungen pro Seite und maximalem Offset
3.000. Es liefert `has_more`, Abdeckungsinformationen, die Anzahl sichtbarer
Meldungen und unterschiedlicher gemeldeter GBIF-Artschlüssel. Verborgene Entities
werden aus Meldungen und Zählungen ausgeschlossen. Fehlende Messwert-Migration:
HTTP 503. Keine Quelle wird synchron durch die API aufgerufen.

`/umwelt/biodiversitaet` zeigt dieselben Angaben, Fundtag, Belegtyp,
wissenschaftlichen Namen, Ortsunsicherheit und Datenquellen. Seitenwechsel
bleiben bei 100 Einträgen. Ein neuer täglicher Snapshot kann die Auswahl beim
Seitenwechsel ändern. Mehr als 72 Stunden ohne erfolgreichen Abruf werden
sichtbar als veraltet markiert. Der Collector führt seine GBIF-Frische unabhängig
von Wetter und Prognosen; ein GBIF-Fehler nimmt deren Writes nicht zurück.

## Aktivierung

Standardmäßig deaktiviert. Vor der Aktivierung die vorhandene additive
Messwert-Migration in der Zielumgebung prüfen/installieren:

```sh
python measurement_migration.py install
```

Anschließend im VPS-Compose-Environment `ENABLE_GBIF=true` setzen und den
Environment Collector aktualisieren. `GBIF_POLL_SECONDS=86400` ist der Standard
und das Mindestintervall. Es werden keine GBIF-Zugangsdaten benötigt.
Dieser Implementierungsschritt veröffentlicht Images, aktiviert die Sammlung
aber nicht selbst auf dem VPS.

## Prüfungen

`tests/test_gbif.py` prüft reale Beispielmeldungen, fehlende Unsicherheit,
Datums-/Lizenzfilter, Duplikate, Seitenlücken, die 3.000er-Grenze, Archivierung
vor dem Parsen, Wiederholung, Manipulation, atomaren Snapshotwechsel inklusive
leerem Ergebnis, API-Paginierung, Sichtbarkeitsfilter, Tagesintervall und
Fehlerisolation. Datenbanktests benötigen die explizite
`COLLECTOR_TEST_DATABASE_URL` einer isolierten Testdatenbank.

Offizielle Referenzen:
- https://techdocs.gbif.org/en/openapi/v1/occurrence
- https://www.gbif.org/data-quality-requirements-occurrences
- https://techdocs.gbif.org/en/data-use/occurrence-issues-and-flags
