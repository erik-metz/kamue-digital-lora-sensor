# Schritt 14: ZAKB-Kalender rechtzeitig erneuern

## Ursache

Die bisherige Reihenfolge bevorzugte alphabetisch sortierte Straßen. Bei begrenzten Laufzeiten konnten ältere Nachweise am Ende wiederholt warten. Außerdem wurde die bewährte Ersatzhausnummer nach Ablauf ihres Checkpoints nicht mehr bevorzugt. Der tägliche reguläre Prüfrhythmus und die 24-Stunden-Cachefrist waren an denselben Parameter gekoppelt.

Vor dem Deployment hat sich der alte Worker bereits wieder auf 793 bestätigte von 844 Straßenproben erholt. Diese Erholung ist kein Ergebnis der neuen Änderung. Sie zeigt, dass die bestehenden Teilläufe weiterarbeiten; die Änderung soll vor allem die Wiederholung von Aktualisierungslücken verhindern.

## Änderung

- Stündlicher regulärer Prüfrhythmus, unabhängig von der unveränderten 24-Stunden-Frischegrenze gespeicherter Kalender.
- Erneuerung beginnt ab zwölf Stunden Alter.
- Bereits bestätigte Hausnummern bleiben auch nach Ablauf der erste Kandidat. Tatsächliche Inventaralternativen bleiben begrenzt auf insgesamt drei Proben.
- Alle noch frischen Kalender werden vor neuen Anbieteranfragen geladen und veröffentlicht.
- Überfällige bekannte Nachweise und anschließend frühzeitig fällige Erneuerungen werden nach ihrem tatsächlichen Abrufzeitpunkt abgearbeitet. Erfolgreiche Erneuerungen erhalten einen neuen Zeitpunkt; der nächste Lauf arbeitet dadurch an den verbliebenen ältesten Nachweisen weiter.
- Ein Erneuerungsfehler entfernt keinen noch frischen Kalender. Diese Fehler und die noch ausstehenden Erneuerungen werden getrennt in der Coverage veröffentlicht.
- Die bestehenden Wiederholungsfristen, Anbieterabstände, Quellensperre und der strenge Adressvertrag bleiben erhalten. Abgelaufene Nachweise werden nicht künstlich verlängert.

Deutsche-Bahn-Quellen bleiben übersprungen.

## Prüfung

34 relevante lokale PostgreSQL-, Formular-, Scheduling- und Vertragstests erfolgreich. Die neuen Prüfungen belegen die Wiederverwendung einer bewährten Ersatzhausnummer nach Ablauf, älteste Erneuerung vor alphabetischer Reihenfolge, Fortschritt im nächsten Lauf und den Erhalt eines frischen Kalenders bei fehlgeschlagener Erneuerung. Ruff für die eigenen geänderten Python-Dateien und `git diff --check` erfolgreich.

Commit `1a1f3a8fe09e1cfcdac1e585fa00983abdcb4d57` ist auf `main` gepusht. [FastAPI & Docker CI/CD](https://github.com/erik-metz/kamue-digital-lora-sensor/actions/runs/37891836185) ist für exakt diesen Commit vollständig erfolgreich abgeschlossen: alle 15 Prüfjobs und alle 17 vorgesehenen GHCR-Builds einschließlich Veröffentlichung.

Registry-Image für das gezielte Deployment: `ghcr.io/erik-metz/open-ried-sens-registry-sync-worker@sha256:10863e3dbc2e8db4be7ee59a6e37a80bcb22c8ad9ce2948fa14d780f7f49684f`. Code-SHA-256 der neuen `zakb.py`: `8968e61c373d721a073e45b46496c470c3973749204b0d24ea4077ec706c54a4`.

## Deployment-Stand

SSH zu `169.58.102.132:22` ist derzeit bei mehreren Versuchen in einen Verbindungs-Timeout gelaufen. Die öffentliche HTTPS-API antwortet weiterhin, und der Hostname löst auf dieselbe IP auf. Die genaue Ursache des SSH-Ausfalls ist unbekannt. Ohne SSH-Zugriff kann das Registry-Image nicht gezielt eingespielt und dessen Laufzeitverhalten auf dem VPS nicht überprüft werden. Deshalb ist noch kein erfolgreicher Produktiveinsatz der Änderung nachgewiesen.


## Offener Abschluss

Nach Wiederherstellung des SSH-Zugriffs zunächst die aktiven Compose-Dateien und das aktuell laufende Image prüfen, dann ausschließlich den Registry-Worker auf das oben veröffentlichte Image aktualisieren. Andere parallel veröffentlichte Änderungen dürfen nicht zurückgesetzt werden. Anschließend den geladenen Code und die Quelleneinstellungen prüfen sowie anhand der tatsächlichen Checkpoint-Zeitpunkte belegen, dass die ältesten bekannten Kalender erneuert werden. Die öffentliche Coverage muss die getrennten Erneuerungszähler und das unveränderte 24-Stunden-Frischefenster enthalten.

Dieser Dokumentationscommit löst wegen der Workflow-Pfadfilter keinen zusätzlichen CI-/GHCR-Lauf aus. Das Deployment und die produktive Verifikation bleiben wegen des tatsächlichen SSH-Verbindungsfehlers offen.
