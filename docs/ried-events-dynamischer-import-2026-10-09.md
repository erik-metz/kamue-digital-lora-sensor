# Dynamischer Vereinsimport statt einzelner Termine

Die KKM-Quelle ist aktiv und wird alle sechs Stunden vollständig neu gelesen.
Der Import verwendet die veröffentlichten Datumsangaben; das Zeitfenster umfasst
das laufende und folgende Kalenderjahr und verschiebt sich automatisch.
Neue Zeilen benötigen keine Freigabe einzelner Veranstaltungstitel.

## Umgesetzter Schritt

Eine wiederverwendbare Ortszuordnung für den Titelabschluss „St. Michael“ ergänzt
den bisherigen Vereinsimport. Dadurch wird das Weihnachtskonzert am 13.12.2026
in Bürstadt übernommen, ebenso neue Veranstaltungen mit anderen Titeln und
Datumsangaben an diesem Ort. Es wurde kein fester Konzerttermin programmiert.
Eine ausdrücklich vorhandene Ortsspalte hat Vorrang. Termine außerhalb des Ried
und Termine ohne zuordenbaren Veranstaltungsort bleiben ausgeschlossen.
Unbekannte Uhrzeiten und Preise werden weiterhin ausdrücklich als unbekannt
beschrieben; Tagesgrenzen dienen nur der Kalenderdarstellung.

## Nächster Schritt für die Abdeckung

Die angebundenen Quellen insgesamt auf Aktualisierung, vollständig gelesene
Kalenderseiten und verworfene Orts-/Datumsangaben prüfen. Daraus die häufigsten
Lücken je Quellenformat beheben und zusätzliche öffentliche Ried-Kalender
anbinden. Schwerpunkt sind vollständige Quellen, keine Listen einzelner Termine.
Bereits vorhandene jahresgebundene Sonderimporte separat auf eine Umstellung auf
dynamische Kalender oder Veranstalterfeeds prüfen.

## Prüfung

40 Tests des Vereinsimports erfolgreich; Ruff für die geänderten Python-Dateien
und `git diff --check` erfolgreich. Ein neuer Test prüft insbesondere einen neu
ergänzten Veranstaltungstitel im Folgejahr sowie den Ausschluss von Lorsch und
Terminen ohne Ortsangabe.
