# Schritt 22: HLNUG-Grundwasser

Am 10. Oktober 2026 wurde der Gesamtstatus erneut geprüft. Außer den bekannten fachlichen Teilständen für ZAKB und den Bibliser Haushalt fiel die aktive Quelle `hlnug-groundwater` mit `UndefinedFunction` auf. Ein zwischenzeitlicher Verbindungsfehler beim HCV hatte zuvor bereits erfolgreiche Abrufe; Deutsche-Bahn-Quellen bleiben zurückgestellt.

## Reparatur

1. Koordinaten werden beim Aufruf der PostgreSQL-Funktion `write_measurement` ausdrücklich nach `numeric` konvertiert. Ohne diesen Cast sendet psycopg Python-Fließkommazahlen als `double precision`, für die keine passende Funktion existiert.
2. Die Kompatibilitätstabelle erhält die vorgeschriebene Gemeinde sowie die originale HLNUG-Stationsnummer. Ein echter Datenbanktest deckte nach der ersten Korrektur die zuvor verdeckte `NOT NULL`-Verletzung auf. Bei Aktualisierungen werden diese Angaben und der Aktualisierungszeitpunkt ebenfalls übernommen.
3. Die bisherige landesweite ArcGIS-Abfrage lieferte nur 1.000 Treffer mit `exceededTransferLimit=true`. Der Abruf filtert jetzt serverseitig nach den vier Gemeinden Bürstadt, Lampertheim, Biblis und Groß-Rohrheim. Die reale Antwort enthält 120 Stationen ohne Abschneidehinweis. Der bestehende regionale Bounding-Box-Filter bleibt zusätzlich wirksam.
4. Fehlerantworten, fehlende Featurelisten und abgeschnittene Antworten werden ausdrücklich abgelehnt. Ein unvollständiges Ergebnis darf nicht als leerer Erfolg eine bisher gültige Veröffentlichung ersetzen.

Die Quelle liefert ein Stationsinventar mit Koordinaten, keine aktuellen Grundwasserstände oder Nitratmessungen. Solche Werte werden nicht erfunden.

## Prüfung

Echte PostgreSQL-Integration prüft Speicherung der Fließkomma-Koordinaten in der Messwertstruktur, Pflichtgemeinde, Stationsnummer, beide veröffentlichten Datensätze und erfolgreichen Abschlussbeleg. Eine abgeschnittene Folgeantwort erhält den vorherigen Bestand. Parser- und Quellenvertragstests ergänzen die Prüfung.

Commit, CI-/GHCR-Ergebnis und produktiver Nachweis werden nach erfolgreichem Abschluss ergänzt.
