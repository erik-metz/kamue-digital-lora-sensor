# Schritt 30: ZAKB nach wiederhergestelltem VPS-Zugriff

Am 10. Oktober 2026 ist SSH mit dem freigegebenen Schlüssel wieder erfolgreich.
Die erwarteten Container laufen, darunter Registry-Worker und Backend-API.
Die vorherige SSH-Blockade ist damit aufgehoben. Keine Container neu gestartet,
keine Compose-Dateien oder Datenbankinhalte verändert.

## Vollständige read-only-Nachprüfung

Das aktuelle VPS-Adressinventar wurde gegen die veröffentlichten Kalender
verglichen: weiterhin 18 Straßen ohne bestätigten Kalender. Die Zahl vier im
letzten Status bezeichnet nur die zuletzt fehlgeschlagenen Proben, nicht den
vollständigen offenen Restbestand. Die übrigen 14 waren zurückgestellt.

Aktuelle ZAKB-Formularlisten wurden auf der VPS frisch geladen:
Biblis 137, Biblis-Nordheim 33, Biblis-Wattenheim 24, Bürstadt 262,
Lampertheim 386, Groß-Rohrheim 85 Straßeneinträge. Abgleich über die bestehende
orthografische Normalisierung und bereits geprüfte Aliase, keine unscharfe
Ähnlichkeitssuche. Für die drei angebotenen Straßennamen wurde jeweils ein
neues Formular von Anfang an aufgebaut und die Originalhausnummer angefragt.

Ein erster Formularlauf mit wiederverwendeten Ortsformularen ergab uneindeutige
Antworten, die den exakten Adressvergleich nicht bestanden. Diese Antworten
wurden verworfen. Der abschließende Lauf mit neuem Formular je Adresse bestätigt
für alle drei Originalnummern: kein bestätigter Kalenderdownload. Ein angebotener
Downloadknopf allein wäre ohnehin kein Identitätsnachweis. Begrenzte Wiederholung
nach einem vorübergehenden HTTP-Verbindungsabbruch; abschließender Lauf erfolgreich.

| Kommune | Offene Straße | Frisches Ergebnis |
| --- | --- | --- |
| Biblis | Eichenweg | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Biblis | Am Tambourinsee | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Bürstadt | Außerhalb | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Lampertheim | Seehof | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Lampertheim | Außerhalb-Brunnengewännchen | Haus 3 abgelehnt; angeboten: 1, 5. |
| Lampertheim | Seebuckel | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Lampertheim | Bahnhaus | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Biblis | Dungauer Weg | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Biblis | Berliner Weg | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Lampertheim | Außerhalb-Große Lache | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Bürstadt | Kleine Gewerbestraße | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Bürstadt | Am Sportplatz | Haus 11 abgelehnt; angeboten: 2. |
| Bürstadt | Am Fischweiher | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Lampertheim | Außerhalb-In der Bildgewann | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Biblis | An der Schleuse | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Biblis | Am Wadowski See | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |
| Biblis | Bei den Münchäckern | Haus 60 abgelehnt. |
| Biblis | In den Kesselwiesen | Kein passender Straßenname in den Ortslisten; kein neuer belegter Alias. |

## Ergebnis und externe Klärung

15 fehlende Straßenzuordnungen, drei abgelehnte Originalhausnummern.
Kein neu belegbarer Codefix. Keine Nummern ersetzt und keine Kalender anderer
Adressen veröffentlicht. Die bereits geprüften amtlichen Straßenbelege und
Geometriegrenzen aus Schritten 20/21 gelten weiterhin. Für einen weiteren Fix
wird eine belastbare ZAKB-Zuordnung benötigt: Originaladresse → Anbieterort,
Anbieterstraße und Hausnummer, gegebenenfalls mit Nachweis einer Umnummerierung.
Bei einem anderen Haus muss außerdem dessen eigene Position belegt sein.
Eine ausdrückliche Bestätigung, dass kein öffentlicher Kalender vorgesehen ist,
wäre ebenfalls verwertbar; aus einer Ablehnung allein folgt dies nicht.

Es wurde keine Anfrage an Dritte versendet. Der bestehende gemeinsame
[Anfrageentwurf für zwei Fälle](quellen-bereinigung-schritt-21-zakb-zwei-adressfaelle.md)
bleibt verfügbar; die Tabelle oben beschreibt den gesamten offenen Umfang.

## Prüfung und Veröffentlichung

Nachweise: erfolgreicher SSH-Containerabruf; read-only-Abgleich der gespeicherten
Inventar-/Kalenderdatensätze; frische öffentliche ZAKB-Formulare für sechs
Anbieterorte und exakte Originalnummern bei allen drei angebotenen Namen.
Keine Checkpoints oder öffentlichen Datensätze durch die Probe geschrieben.
Nur dieser Prüfbericht wurde im Repository geändert. Kein Anwendungsbuild nötig,
keine Frontend-/VPS-CI durch die Dokumentationspfade vorgesehen, kein Deployment
und keine GHCR-Veröffentlichung.
