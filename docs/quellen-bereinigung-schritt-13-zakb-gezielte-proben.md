# Schritt 13: Gezielt offene ZAKB-Straßenproben prüfen

## Auftrag und Auswahl

Die 38 im vorigen Lauf wegen des Zeitbudgets nicht abschließend geprüften Straßen werden gezielt geprüft. Ausgangspunkt ist der veröffentlichte Stand aus Schritt 12: 759 von 844 bestätigten Straßenproben, 13.818 Kalenderereignisse und 85 offene Straßen.

Von den 85 offenen Straßen wurden 40 im letzten Lauf mit Fehler abgeschlossen. Für die übrigen 45 wurde anhand des damaligen Prüfzeitpunkts und der gespeicherten Wiederholungsfristen rekonstruiert, dass sieben zurückgestellt waren. Damit bleiben exakt die 38 budgetbedingt offenen Straßen als Prüfmenge. Die sieben zurückgestellten Straßen sind Am Tambourinsee und An der Schleuse (Biblis), Am Fischweiher, Am Sportplatz und Kleine Gewerbestraße (Bürstadt), Am Küblinger Damm und Georg-Tyczka-Straße (Lampertheim).

## Durchführung

Ein einmaliger gezielter Prüflauf verwendet den bereits veröffentlichten ZAKB-Collector, dessen Code-SHA-256 `9cf5e7f5e88e27c40e48970486c4393350f5bf49fc8bd7b9f71b2f37a202c3d9` geprüft wurde. Die bestehende Quellensperre verhindert einen gleichzeitigen regulären ZAKB-Abruf. Andere Quellen und der reguläre Worker laufen weiter.

Pro Straße werden höchstens die drei kleinsten tatsächlichen numerischen Hausnummern aus dem Inventar verwendet, jeweils mit den zugehörigen Koordinaten. Eine Alternative wird nur nach einer Ablehnung oder abweichenden Adressbestätigung versucht. Fehlende Straßen, unklare Ortsteile und Verbindungsfehler beenden die jeweilige Prüfung. Erfolgreiche Abrufe werden als echte validierte Checkpoints gespeichert, fehlgeschlagene Einzeladressen mit ihrer tatsächlichen Fehlerklasse und Wiederholungsfrist. Es werden keine Probehausnummern erfunden und keine Frischezeitpunkte umgeschrieben.

Deutsche-Bahn-Quellen bleiben übersprungen. Laufzeitdateien und fremde Änderungen anderer Aufgaben werden nicht geändert.

## Ergebnis

Alle 38 ausgewählten Straßen wurden am 9. Oktober 2026 (Europe/Berlin) abschließend geprüft: **29 erfolgreich, neun weiterhin fehlerhaft**. Sechs Straßen fehlen in der ZAKB-Auswahl, zwei Straßen werden bei allen drei geprüften Hausnummern abgelehnt, bei einer Straße bleibt die Adressbestätigung abweichend. Es gab keinen durch das Prüfzeitbudget unbeantworteten Fall in dieser Prüfmenge.

Die öffentliche API wurde nach der Veröffentlichung unabhängig geprüft. Alle 29 erfolgreichen Straßen sind dort mit genau der bestätigten Hausnummer enthalten. Der Veröffentlichungslauf verwendet ausschließlich frische validierte Checkpoints; sein Budget für zusätzliche Anbieteranfragen beträgt eine Sekunde. Vorhandene Kalender werden vor der Budgetprüfung verarbeitet, sodass alle weiterhin frischen Proben veröffentlicht werden.

Der Snapshot vom 9. Oktober 2026 um 00:17:50 (Europe/Berlin) enthält **704 von 844 frische Straßenproben und 12.821 Kalenderereignisse**. Gegenüber dem vorherigen veröffentlichten Stand sind 29 neu bestätigte Straßen hinzugekommen und 84 zuvor bestätigte Straßen nicht mehr in diesem Frischesnapshot enthalten: 759 + 29 − 84 = 704. Die 24-Stunden-Frischegrenze bleibt unverändert; ältere gespeicherte Nachweise werden nicht künstlich verlängert. Der weiterhin verwendete Adressvertrag ist `zakb-address-v2`.

Dieser Veröffentlichungslauf enthält keine zusätzlichen Anbieteranfragen und daher keine eigenen Formularfehler. Die tatsächlichen neun Fehler der gezielten Prüfungen werden unten separat vollständig aufgeführt. Die gesamte Quelle bleibt `partial`; der Cache-Snapshot hat 140 Straßen ohne frische veröffentlichte Probe. Der reguläre Worker ist aktiv und hat anschließend bereits einen weiteren ZAKB-Lauf begonnen. Dessen spätere Ergebnisse sind nicht als Nachweis für diese 38 Prüfungen verwendet.

Es wurden keine Laufzeitdateien geändert und keine Container neu veröffentlicht. Prüfung: 38 abgeschlossene Einzelprüfungen, 29 bestätigte Hausnummern über die öffentliche API, Abgleich der Coverage- und Kalenderzahlen, `git diff --check`. Für den eigenen Dokumentationscommit ist wegen der Workflow-Pfadfilter kein zusätzlicher CI-/GHCR-Lauf vorgesehen.

## Ergebnisse je Straße

| Gemeinde | Straße | Tatsächlich geprüfte Hausnummern / Ergebnis | Bestätigte Probe |
| --- | --- | --- | --- |

| Bürstadt | Sputnikweg | 1: success | 1 (18 Termine) |
| Bürstadt | St.-Gallus-Straße | 1: success | 1 (18 Termine) |
| Bürstadt | St.-Hubertus-Weg | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Bürstadt | Theodor-Heuss-Straße | 1: success | 1 (18 Termine) |
| Bürstadt | Vinzenzstraße | 2: MissingStreet | — |
| Bürstadt | Waldgartenstraße | 4: AddressNotAccepted; 8: AddressNotAccepted; 9: success | 9 (18 Termine) |
| Bürstadt | Wasserwerkstraße | 1: AddressMismatch; 2: success | 2 (18 Termine) |
| Bürstadt | Weidenweg | 1: AddressNotAccepted; 2: AddressNotAccepted; 4: success | 4 (18 Termine) |
| Bürstadt | Wolfstraße | 1: AddressNotAccepted; 2: AddressMismatch; 3: success | 3 (18 Termine) |
| Bürstadt | Zeppelinstraße | 2: MissingStreet | — |
| Bürstadt | Zur Biogasanlage | 1: AddressNotAccepted; 2: success | 2 (24 Termine) |
| Lampertheim | Kurpfalzstraße | 1: success | 1 (17 Termine) |
| Lampertheim | Kurt-Schumacher-Straße | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Lampertheim | Küblinger Weg | 2: AddressNotAccepted; 4: AddressNotAccepted; 6: AddressNotAccepted | — |
| Lampertheim | Lorscher Straße | 1: AddressNotAccepted; 2: success | 2 (21 Termine) |
| Lampertheim | Ludwigstraße | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Lampertheim | Maldegemstraße | 2: AddressMismatch; 4: AddressMismatch; 5: success | 5 (17 Termine) |
| Lampertheim | Mannheimer Straße | 1: AddressNotAccepted; 3: AddressMismatch; 5: AddressMismatch | — |
| Lampertheim | Moltkestraße | 1: AddressNotAccepted; 2: success | 2 (17 Termine) |
| Lampertheim | Neugasse | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Lampertheim | Nibelungenstraße | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Lampertheim | Otto-Hahn-Straße | 2: AddressNotAccepted; 3: AddressNotAccepted; 4: success | 4 (17 Termine) |
| Lampertheim | Peter-Bieber-Straße | 3: AddressNotAccepted; 5: AddressNotAccepted; 7: success | 7 (18 Termine) |
| Lampertheim | Pfaffenwiese | 2: AddressNotAccepted; 3: success | 3 (21 Termine) |
| Lampertheim | Poststraße | 2: AddressNotAccepted; 3: success | 3 (17 Termine) |
| Lampertheim | RWE-Siedlung | 1: success | 1 (18 Termine) |
| Lampertheim | Reisstraße | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Lampertheim | Ringstraße | 1: AddressNotAccepted; 3: AddressNotAccepted; 4: success | 4 (17 Termine) |
| Lampertheim | Rosenaustraße | 10: AddressNotAccepted; 12: success | 12 (17 Termine) |
| Lampertheim | Schifferstraße | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Lampertheim | Schillerstraße | 1: AddressNotAccepted; 2: success | 2 (18 Termine) |
| Lampertheim | Schwimmbadstraße | 1: AddressNotAccepted; 3: success | 3 (18 Termine) |
| Lampertheim | Seebuckel | 1: MissingStreet | — |
| Lampertheim | Seehof | 5: MissingStreet | — |
| Lampertheim | Ulmenweg | 1: AddressMismatch; 2: success | 2 (18 Termine) |
| Lampertheim | Wierdenstraße | 1: AddressNotAccepted; 3: AddressNotAccepted; 5: AddressNotAccepted | — |
| Lampertheim | Wildbahn | 1: MissingStreet | — |
| Lampertheim | Wilhelm-von-Ketteler-Straße | 1: MissingStreet | — |

## Nächster Schritt

Die Aktualisierung der älteren bestätigten Kalender prüfen: Die bisherige Abrufmenge und das Zeitbudget reichen nicht aus, um alle Straßen regelmäßig innerhalb des Frischefensters zu erneuern. Dabei müssen bestätigte Daten, tatsächlich fehlende Provider-Auswahlwerte und wartende Aktualisierungen getrennt sichtbar bleiben. Die neun Fehler dieses Schritts sind unabhängig davon gezielt mit offiziellen ZAKB-Adressangaben zu klären. Deutsche-Bahn-Quellen bleiben übersprungen.
