# Dauerhafte Arbeitsregeln

Diese Regeln gelten bei jeder Anfrage für das gesamte Repository, unabhängig vom verwendeten Editor. Spezifische Regeln in Unterverzeichnissen gelten zusätzlich. Explizite abweichende Anweisungen des Nutzers haben Vorrang.

## Änderungen abschließen und veröffentlichen

Der Nutzer autorisiert dauerhaft, eigene auftragsbezogene Änderungen nach angemessener Prüfung selbstständig zu committen und zu pushen. Dafür nicht erneut um Bestätigung bitten.

1. Vor Änderungen Git-Status und geltende Repository-Regeln prüfen. Bereits vorhandene Änderungen anderer Aufgaben nicht ungeprüft mit aufnehmen, überschreiben oder zurücksetzen. Nur die eigenen auftragsbezogenen Änderungen gezielt stagen.
2. Änderungen implementieren und die passenden Tests, Lint-Prüfungen und Builds ausführen. Simulationen ausführen, wenn für die betroffene Komponente vorhanden und sinnvoll.
3. Änderungen mit einer aussagekräftigen Nachricht committen und zum vorgesehenen Remote/Branch pushen. Kein Force-Push und keine destruktiven Git-Operationen ohne gesonderten Auftrag.
4. Nach dem Push den GitHub-Actions-Lauf für genau den gepushten Commit prüfen und bis zum Abschluss verfolgen. Ein älterer erfolgreicher Lauf zählt nicht als Nachweis.
5. Für `main` insbesondere den Workflow `.github/workflows/ci.yml` (`FastAPI & Docker CI/CD`) und den Job `build-and-push-ghcr` (`Build & Push Docker Image to GHCR`) prüfen. Erfolg bedeutet: erforderliche Prüfungen und alle vorgesehenen Container-Builds samt Veröffentlichung auf GHCR sind erfolgreich. Der GHCR-Job läuft nur bei Pushes auf `main`; bei anderen Branches einen übersprungenen Job ausdrücklich benennen und nicht als GHCR-Erfolg ausgeben.
6. Bei Fehlern Logs lesen, Ursache beheben, relevante Prüfungen wiederholen, erneut committen und pushen und den neuen Lauf prüfen. Diese Schleife fortsetzen, bis die Prüfungen und vorgesehenen GHCR-Veröffentlichungen erfolgreich sind oder eine konkrete externe Blockade weiteren Fortschritt verhindert.
7. Bei fehlendem Zugriff, fehlenden Zugangsdaten, Infrastrukturproblemen oder nicht verfügbaren Prüfwerkzeugen den tatsächlichen Stand und die konkrete Blockade melden. Erfolg niemals ohne Nachweis behaupten.
8. Zum Abschluss kurz Änderungen, Prüfungen, Commit, Push und CI/GHCR-Ergebnis melden; wenn verfügbar den zugehörigen Workflow-Lauf verlinken.

Reine Fragen ohne Dateiänderungen erfordern keinen leeren Commit. Diese Regeln ändern keine bereits laufenden fremden Aufgaben und gelten auch für Änderungen an dieser Datei.
