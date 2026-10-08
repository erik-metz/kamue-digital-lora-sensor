# Schritt 10: ZAKB-Diagnose am 8. Oktober 2026

## Ergebnis

Der Kalender ist erreichbar und liefert bereits viele verifizierte Straßenproben. Der Teilstatus ist berechtigt. Neben vorübergehenden `RemoteProtocolError`-Verbindungsabbrüchen sind zwei konkrete Adapterprobleme nachgewiesen:

1. Das OSM-Inventar meldet beispielsweise Domstiftstraße als Gemeinde Biblis. ZAKB führt diese Straße unter der eigenen Ortsauswahl **Biblis-Nordheim**. Auch **Biblis-Wattenheim** ist eine getrennte Ortsauswahl. Der Collector sendet bisher ausschließlich den Gemeindenamen.
2. Eine nicht angebotene Straße kann vom Formular stillschweigend ersetzt werden. Live-Nachweis: Anfrage Biblis-Nordheim/Luisenstraße 1, Antwort enthält einen Kalender-Download, aber bestätigt im HTML-Element `Lageadresse` **Altrheinstraße 1, 68647 Biblis-Nordheim**. Die bisherige Prüfung auf `filedownload_ICAL` allein erkennt diese falsche Zuordnung nicht. Dagegen bestätigt die korrekte Anfrage Biblis-Nordheim/Domstiftstraße 1 genau diese Adresse.

Die [öffentliche ZAKB-Seite](https://www.zakb.de/abfallkalender) wurde direkt mit ihren regulären Formularschritten geprüft. Es wurden keine Entsorgungsaufträge oder Nachrichten ausgelöst.

## Abdeckung des geprüften Produktionssnapshots

Snapshot `checked_at=2026-10-08T11:39:52.280079+00:00`, Straßenproben je Gemeinde:

| Gemeinde | Vorgesehen | Erfolgreich, wiederverwendet | In diesem Lauf fehlgeschlagen | Zurückgestellt |
| --- | ---: | ---: | ---: | ---: |
| Biblis | 173 | 96 | 21 | 56 |
| Bürstadt | 243 | 227 | 6 | 10 |
| Lampertheim | 354 | 315 | 2 | 37 |
| Groß-Rohrheim | 74 | 65 | 3 | 6 |

Diese Zahlen beschreiben den Snapshot; der Collector arbeitet weiter und spätere Zahlen können abweichen. Erfolgreich bedeutet bisherige Collector-Prüfung, keine rückwirkend bestätigte Adressidentität. Straßenproben bleiben grundsätzlich keine vollständige Hausnummernabdeckung.

## Konkreter nächster Reparaturschritt

- ZAKB-Orts- und Straßenauswahlen für die Zuordnung verwenden; eindeutig passende Ortsteile berücksichtigen. Mehrdeutige Zuordnungen dürfen nicht geraten werden.
- Vor einem Download angebotene Straße und anschließend die bestätigte Adresse prüfen; stillschweigende Ersatzadressen ablehnen.
- Checkpoint-Vertrag versionieren und bestehende Kalender mit der neuen Adressprüfung erneut validieren, damit früher eventuell falsch zugeordnete Antworten nicht ungeprüft wiederverwendet werden.
- Verbindungsabbrüche getrennt von Adressfehlern ausweisen und die Quelle weiterhin schonend abrufen.
- Regressionstests für Ortsteilzuordnung, Ersatzadresse und Mehrdeutigkeit; anschließend CI/GHCR, gezieltes Deployment und neuer Live-Snapshot.

Dieser Schritt ist eine abgeschlossene Diagnose. Noch keine Änderung an Collector, Checkpoints oder veröffentlichten Kalenderdaten. Nur der Prüfbericht wird committed und gepusht; dafür ist kein CI-/GHCR-Lauf vorgesehen. Deutsche-Bahn-Quellen bleiben übersprungen.
