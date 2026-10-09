# Schritt 19: Echte Hausnummernzusätze bei ZAKB

## Änderung

Der OSM-Import übernimmt einzelne Hausnummern mit einem Buchstaben, etwa `8A`, `9 c` oder `18C`, einschließlich ihrer eigenen Knoten- bzw. Gebäudegeometrie. Bereiche und zusammengesetzte Hausnummern bleiben ausgeschlossen. Inventarversion 2 erzwingt einen echten erneuten Download, wenn nur das bisherige numerische Inventar gespeichert ist.

ZAKB erhält Zahl und Buchstaben getrennt über `aos[Hausnummer]` und `aos[Hausnummerzusatz]`. Die bestätigte Adresse muss weiterhin exakt Straße, Ort, Zahl und Zusatz entsprechen; Groß-/Kleinschreibung und Leerraum vor einem Buchstaben sind gleichwertig. Eine alternative Hausnummer aus einer Vorschlagsliste wird nicht automatisch übernommen.

Neue Nachweise verwenden `zakb-house-suffix-v1`; bestehende numerische Nachweise sowie die zwei ausdrücklich geprüften Zahlenbereiche behalten ihre bisherigen Schlüssel. Jeder veröffentlichte Kalender gehört weiterhin nur zur tatsächlich angefragten repräsentativen Adresse, nicht automatisch zur gesamten Straße.

## Prüfung

Gezielte Tests prüfen Formularfelder, abweichende Adressbestätigungen, getrennte Schlüssel, tatsächliche Geometrie, Wiederaufnahme und die Erneuerung alter Inventare. CI, Container-Veröffentlichung und VPS-Ergebnis werden nach der Ausführung unten ergänzt.

## Unverändert offene Fälle

`Bei den Münchäckern 60` und `Am Sportplatz 11` werden durch Buchstabenunterstützung nicht korrigiert. Weder wird eine andere Adresse erfunden noch eine vorhandene Geometrie auf einen anderen Standort übertragen.
