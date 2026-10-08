# Schritt 7: Geplante Umweltabrufe wieder ausführen

## Ursache

Die Archivierungsumstellung im Environment-Collector holt die Kernquellen in
`poll_cycle` ab und übergibt deren archivierten Payload als `raw` an den inneren
Zyklus. Dieser verwendete `raw is not None` zugleich als Kennzeichen einer
expliziten Eingabedatei. Dadurch wurde bei jedem regulären Live-Zyklus der
Netzwerkabruf von Boden, Pollen, GBIF, Abfluss und den drei ENTSO-E-Produkten
übersprungen. Fehlende Teil-Payloads führten zur Ausgabe `not_due`, auch wenn der
letzte erfolgreiche Abruf längst veraltet war.

Die Datenbank- und Containerzeit waren korrekt. Auf dem VPS stammten am
8. Oktober 2026 die letzten Boden- und Pollenimporte noch vom 7. Oktober
07:32:45 bzw. 06:30:52 UTC. Der globale Healthcheck lieferte deshalb zu Recht 1.

## Änderung

Der innere Zyklus erhält ein separates `replay`-Kennzeichen, das ausschließlich
von einer expliziten Eingabe des Aufrufers abgeleitet wird. Im Live-Betrieb werden
die aktivierten Teilquellen wieder über ihre bestehenden Abrufintervalle
abgefragt. Bei einer Eingabedatei bleiben sie im Replay-Modus; es erfolgen keine
zusätzlichen Netzwerkabrufe. Provider-URLs, Abrufintervalle, Prognosemodelle,
Datenvalidierung und Healthcheck-Grenzen werden nicht verändert.

Zwei Regressionstests prüfen den tatsächlichen Live-Einstieg mit vorheriger
Archivierung und alle fünf Teiladapter (drei ENTSO-E-Produkte), sowie den
Netzwerkverzicht bei explizitem Replay. Bestehende Adapter- und Datenbanktests
prüfen die Speicherseite.

Produktionsnachweis und CI-Ergebnis werden nach Veröffentlichung ergänzt.

## Zusätzlicher Befund im ersten produktiven Zyklus

Der erste Live-Zyklus mit korrigierter Steuerung schrieb tatsächlich 8.064 neue
Bodenwerte und 2.880 Pollenwerte; auch GBIF und Abfluss wurden aktualisiert.
Die bisherige globale Laufzeitgrenze von 50 Sekunden brach danach die laufenden
ENTSO-E-Schreibtransaktionen ab. Deshalb wird ausschließlich beim
Environment-Collector ein konfigurierbares, begrenztes Zyklusbudget von 180
Sekunden verwendet (`ENVIRONMENT_CYCLE_TIMEOUT_SECONDS`, positive Zahl bis
3600). Abrufintervalle und Healthcheck-Aktualitätsgrenzen bleiben unverändert.
Die Grenze wird weiterhin durch `asyncio.timeout` erzwungen; Timeout-Tests
prüfen, dass ein abgebrochener Lauf keinen falschen Gesundheitsstatus erzeugt.

Die bereits erfolgreich heruntergeladenen ENTSO-E-Antworten werden aus den
archivierten HTTP-200-Belegen mit den bestehenden Validierungs- und
Idempotenzregeln fertig verarbeitet, statt erneut Daten abzurufen oder
historische Zeitstempel zu verändern.
