# Schritt 17: Zwei ZAKB-Straßen mit Hausnummernbereichen

## Ausgangspunkt und fachliche Prüfung

Nach Schritt 16 sind 819 von 844 repräsentativen Straßenproben bestätigt. Für Georg-Tyczka-Straße und Habichtsweg in Lampertheim liefert ZAKB statt einer einzelnen Hausnummer einen Bereich im Bestätigungsfeld `Lageadresse`.

Die Prüfung verwendet ausschließlich tatsächlich vorhandene Inventarhausnummern. Die Straße Georg-Tyczka-Straße ist zusätzlich durch den [städtischen Umbenennungsbeschluss vom 20. Mai 2009](https://rim.ekom21.de/lampertheim/sdnetrim/UGhVM0hpd2NXNFdFcExjZQGKgXsSXJSzDIB2bafgbK4JEXmNYGdaXRYfsVeggDpaP8u3Qtse7inXT5ml1rbvWg/Gesamtes_Sitzungspaket.pdf) belegt. Das [städtische Vereinsverzeichnis](https://www.lampertheim.de/de/vereinsverzeichnis/?pageIdc93e5fe2=6) führt Habichtsweg 6.

| Straße | Angefragte echte Hausnummern | ZAKB-Bestätigung | Kalender |
| --- | --- | --- | --- |
| Georg-Tyczka-Straße | 4 | 2–4 | 20 Termine |
| Georg-Tyczka-Straße | 5 | Keine akzeptierte Adresse | Kein Download |
| Habichtsweg | 1, 4, 6, 13 | 1–13 | 1 und 13: je 17 Termine; 4 und 6: je 26 Termine |
| Habichtsweg | 15, 19 | 15–19 | Je 23 Termine |

Die verschiedenen Terminanzahlen innerhalb von 1–13 zeigen: Ein bestätigter Bereich rechtfertigt keine Übertragung eines Kalenders auf alle enthaltenen Hausnummern. Auch bei gleicher Terminanzahl wird keine Gleichheit der Kalender unterstellt. Jeder Download und Checkpoint bleibt deshalb an der tatsächlich angefragten Einzeladresse mit deren ursprünglichen Koordinaten gebunden. Für gerade Hausnummern im Bereich 1–13 liegen explizite erfolgreiche Provider-Antworten für 4 und 6 vor; eine Beschränkung auf ungerade Zahlen wäre hier falsch.

## Eng begrenzte Erweiterung

Die Erweiterung akzeptiert ausschließlich die folgenden geprüften Kombinationen aus Provider-Gemeinde, exakter Provider-Straße und numerischen Grenzen:

- Lampertheim / Georg-Tyczka-Straße / 2–4;
- Lampertheim / Habichtsweg / 1–13 oder 15–19.

Die tatsächlich angefragte Inventarhausnummer muss eine eindeutige positive Ganzzahl innerhalb des zurückbestätigten Bereichs sein. Unbekannte oder umgekehrte Bereiche, falsche Straße oder Gemeinde, Zusätze wie 6a, mehrdeutige Schreibweisen wie 06 und Hausnummern außerhalb der Grenzen werden abgelehnt. Bestehende exakte Einzelhausnummernbestätigungen funktionieren unverändert. Andere Straßen erhalten keine allgemeine Bereichserkennung.

Die zwei betroffenen Straßen verwenden den gesonderten Checkpoint-Vertrag `zakb-reviewed-ranges-v1`; alle übrigen Adressen behalten `zakb-address-v2`. Die bisherigen 819 geprüften Kalender werden dadurch nicht ungültig. Das Abdeckungsmanifest nennt beide Verträge (`validation_contract` und `reviewed_range_contract`). Die Hausnummer bleibt Teil jedes Checkpoint-Schlüssels. Der veröffentlichte Kalender enthält weiterhin ausschließlich die konkrete repräsentative Einzeladresse, keine vervielfältigten Bereichsadressen.

## Validierung

73 relevante lokale Formular-, Adressvertrags-, Wiederaufnahme- und Datenbankprüfungen erfolgreich. Die 20 neuen Prüfungen umfassen Bereichsgrenzen, falsche Gemeinde/Straße, unbekannte Bereiche, Hausnummernzusätze, unterschiedliche Checkpoints pro Einzelhausnummer und den gesperrten Download bei einer Hausnummer außerhalb des bestätigten Bereichs. Ruff für die eigenen Python-Dateien und `git diff --check` erfolgreich. CI, GHCR und Live-Veröffentlichung werden nach Abschluss ergänzt.

Deutsche-Bahn-Quellen bleiben übersprungen.
