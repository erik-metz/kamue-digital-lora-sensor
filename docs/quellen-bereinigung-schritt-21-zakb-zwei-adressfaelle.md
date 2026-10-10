# Schritt 21: Bei den Münchäckern und Am Sportplatz

Vollständige erneute Untersuchung beider Fälle am 10. Oktober 2026. Der Nutzer hat diesen gemeinsamen Schritt einschließlich produktiver Prüfung ausdrücklich freigegeben. Deutsche-Bahn-Quellen bleiben übersprungen.

## Ergebnis

| Adresse | Frische Anbieterprüfung | Ergebnis |
| --- | --- | --- |
| Biblis, Bei den Münchäckern 60 | Straßenname angeboten; Hausnummer 60 als außerhalb des gewählten Abschnitts abgelehnt. Zusätzlich angebotener Standortname Außerhalb - Kernkraftwerk mit unveränderter 60 geprüft: ebenfalls abgelehnt. | Keine bestätigte Kalenderzuordnung. Keine Umbenennung oder Nummernänderung veröffentlicht. |
| Bürstadt-Riedrode, Am Sportplatz 11 | Straßenname angeboten; reales Inventarhaus 11 abgelehnt. Anbieter bietet ausschließlich Haus 2 an. Separater lesender Abruf bestätigt tatsächlich Am Sportplatz 2, 68642 Bürstadt und liefert 17 Termine. | Kalender für 2 vorhanden, aber keine belegte eigene Geometrie im Inventar. Er wird nicht an Haus 11 oder dessen Koordinaten veröffentlicht. |

Die aktuelle Prüfung wurde mit dem produktiven Collector und ZAKB-Advisory-Lock durchgeführt, bei beiden Adressen mit erzwungenem frischem Abruf statt Checkpoint-Wiederverwendung. Ergebnis: zwei `AddressNotAccepted`, keine erfolgreichen zusätzlichen Kalender. Die Fehlernachweise wurden gespeichert und der Kalenderbestand anschließend atomar aus den frischen bestätigten Checkpoints veröffentlicht (`partial`). Insbesondere ist die frühere vorübergehende Fehlermeldung `RemoteProtocolError` für Am Sportplatz jetzt durch die erneut bestätigte fachliche Hausnummernablehnung ersetzt.

Die zusätzliche Formulardiagnose erlitt einmal einen Verbindungsabbruch. Der anschließende neue Abruf ohne wiederverwendete HTTP-Verbindung lieferte die eindeutige Rückmeldung samt Auswahl `aos[Hausnummernwahl]=2`. Daraus wird keine neue generelle Fehlerbehandlung im Collector abgeleitet.

## Adress- und Geometrienachweise

- [RWE: Rückbauanlage Biblis, Anfahrt und Anschrift](https://www.rwe.com/-/media/RWE/documents/anfahrtsskizzen/kraftwerke/anfahrtsskizze-rueckbauanlage-biblis.pdf) und [BGZ: Standort Biblis](https://zwischenlager.info/standort/biblis/) bestätigen Bei den Münchäckern 60. Die Adresse ist nicht allein wegen der Kalenderablehnung falsch. Die RWE-Navigationsposition ist eine Zufahrtsposition und ersetzt nicht automatisch die Geometrie des Inventargebäudes.
- Inventarobjekt Bei den Münchäckern 60: [OSM-Weg 1392206264](https://www.openstreetmap.org/way/1392206264), Mittelpunkt 49.70758375 / 8.41150585.
- [Amtliche Bodenrichtwertkarte Riedrode](https://www.buerstadt.de/fileadmin/Dateien/Dateien/Wirtschaft_und_Infrastruktur/Bodenrichtwerte/431005_Riedrode_A3q_Internet.pdf) belegt die Straße, aber keine eindeutige Zuordnung des angebotenen Hauses 2 zu einem Gebäude.
- Frisch gelesener [OSM-Kartenausschnitt Riedrode](https://api.openstreetmap.org/api/0.6/map?bbox=8.495,49.647,8.500,49.652): weiterhin nur ein vollständiges Adressobjekt für Am Sportplatz, [Weg 1106040860](https://www.openstreetmap.org/way/1106040860), Nummer 11, Ortsteil Riedrode, Mittelpunkt 49.64914615 / 8.4975065. Das Originalobjekt enthält zudem `fixme=check addresss`. Das ist ein Hinweis auf ungeklärte Kartierungsdaten, kein Beweis, dass 11 in 2 umnummeriert werden darf.
- Kalenderdiagnose für Am Sportplatz 2: 17 Termine, SHA-256 `13e7b65fe9883b1dbeced43bbd7423822df2c3430e760dc72edc4741667dda3c`. Exakte Anbieterbestätigung von Straße, Nummer und Gemeinde geprüft. Rein lesender Nachweis; keine Checkpoints und keine Veröffentlichung für diese nicht im Inventar vorhandene Adresse.

Es wurde weder fehlende Behälterabfuhr behauptet noch ein Kalender von einem anderen Haus übernommen. Eine erfolgreiche technische Verbindung oder ein angebotenes anderes Haus ist kein Nachweis für die angefragte reale Adresse.

## Konkrete externe Klärung

Für diese zwei Fälle ist jetzt kein weiterer belegter Codefix vorhanden. Benötigt werden folgende Angaben; erst danach lässt sich gezielt ergänzen und erneut produktiv prüfen:

1. ZAKB: Welcher öffentlich abrufbare Standort einschließlich Anbieterort, Anbieterstraße und unveränderter Hausnummer ist Bei den Münchäckern 60 zugeordnet? Falls kein öffentlicher Kalender vorgesehen ist, ist eine ausdrückliche Bestätigung dieses Umstands erforderlich; die aktuelle Ablehnung allein genügt nicht.
2. Stadt Bürstadt bzw. ZAKB: Welches konkrete Gebäude/Flurstück oder welche eindeutige Position gehört zu Am Sportplatz 2 in Riedrode? Ist die kartierte Hausnummer 11 korrekt, veraltet oder ein Kartierungsfehler? Ein belegter eigener Adresspunkt für 2 kann ergänzt werden; vorhandene Koordinaten von 11 dürfen nicht ohne Nachweis übernommen werden.

### Vorbereiteter gemeinsamer Anfrageentwurf, nicht versendet

> Guten Tag, wir prüfen zwei Adresszuordnungen im öffentlichen ZAKB-Abfallkalender. Bei den Münchäckern 60, 68647 Biblis, wird unter diesem Straßennamen und auch unter Außerhalb - Kernkraftwerk mit Nummer 60 abgelehnt. Bitte nennen Sie die korrekte öffentliche Kalenderzuordnung oder bestätigen Sie, falls für diese Adresse kein öffentlicher Kalender vorgesehen ist. Für Am Sportplatz 11, 68642 Bürstadt-Riedrode, wird ausschließlich Hausnummer 2 angeboten. Hausnummer 2 liefert einen bestätigten Kalender, benötigt aber einen eigenen eindeutigen Gebäude-/Adresspunkt. Bitte teilen Sie uns dessen genaue Lage und die Beziehung zur kartierten Hausnummer 11 mit. Vielen Dank.

Es wurde keine Nachricht an ZAKB, Stadt, RWE oder BGZ versendet.

## Abschlussprüfung

Unabhängiger Inventarabgleich und öffentliche API bestätigen weiterhin **827 von 845 Straßen**, **14.922 Termine**, **18 unbestätigte Straßen**. Beide bearbeiteten Fälle bleiben korrekt unbestätigt; die fünf in Schritt 20 hinzugekommenen Kalender samt eigenen Koordinaten sind weiterhin vorhanden. Quellenstatus ZAKB `partial`, OSM `success`.

Keine Collector-, API-, Frontend- oder Workflow-Datei wurde in diesem Schritt geändert. Daher keine neuen Tests, Container-Builds oder GHCR-Veröffentlichungen erforderlich. Der Dokumentationspfad löst die konfigurierten CI-Workflows nicht aus. Fremde parallele Änderungen bleiben unberührt.
