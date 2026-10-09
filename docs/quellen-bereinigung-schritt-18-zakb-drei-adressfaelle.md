# Schritt 18: An den Rebenäckern, Bei den Münchäckern, Am Sportplatz

## Ergebnis der gezielten Prüfung am 9. Oktober 2026

Die drei Fälle haben unterschiedliche Ursachen. Sie werden nicht durch Ersetzen einer Hausnummer durch eine andere oder durch Übernahme benachbarter Koordinaten bereinigt. Es wurden keine Kalender in den produktiven Datenbestand übernommen und keine Collector-Dateien geändert.

| Gemeinde / Straße | Geprüfte vorhandene Inventarhausnummern | Tatsächliche ZAKB-Rückmeldung | Ursache / Folgeschritt |
| --- | --- | --- | --- |
| Biblis / An den Rebenäckern | 2, 29, 48, 50, 51, 52, 53, 54, 55, 56 | Keine Behälter für die angefragte Einzeladresse angemeldet; Auswahl anderer Hausnummern mit Zusätzen | Der Import und die Probenwahl verwerfen Buchstabenadressen. Unterstützung echter Hausnummernzusätze erforderlich. |
| Biblis / Bei den Münchäckern | 60 | Die Hausnummer liegt nicht im gewählten Straßenabschnitt. | Reale Adresse belegt, aber keine bestätigte ZAKB-Zuordnung. Kein Nachweis, dass keine reguläre Abfuhr existiert. |
| Bürstadt / Am Sportplatz | 11 | Nur ein anderer passender Standort gefunden: Hausnummer 2. | Die angebotene Adresse 2 fehlt im Inventar. Hausnummer 11 und ihre Koordinaten dürfen nicht als 2 veröffentlicht werden. |

Zusätzlich wurde die [amtlich erwähnte Hausnummer 3 in An den Rebenäckern](https://www.biblis.eu/rathaus/aktuelles/pressemitteilungen/erneuerung-der-gasleitungen-in-den-strassen-an-den-rebenaeckern-und-pfarrkesselweg/) geprüft. Auch sie führt zur Auswahl von Adressen mit Zusätzen. Sie wurde nicht als angeblich vorhandene Inventaradresse ausgegeben.

## An den Rebenäckern: bestätigter Fehler im eigenen Adressfilter

Das ZAKB-Formular bietet nach einer erfolglosen Anfrage die Auswahl `aos[Hausnummernwahl]` mit den Werten `2 a`, `8 a`, `9 c`, `9 d`, `11 a`, `11 d`, `18 C`, `27 c` an. Das sind konkrete Vorschläge des Providers, kein Nachweis für die ursprünglich angefragte Hausnummer ohne Zusatz.

Der aktuelle [OpenStreetMap-Kartenausschnitt](https://api.openstreetmap.org/api/0.6/map?bbox=8.430,49.679,8.438,49.688) enthält 98 Adressobjekte für An den Rebenäckern. Mehrere angebotene Adressen sind darin tatsächlich vorhanden, unter anderem 8A, 9C, 9D, 11A, 11D, 18C und 27c. Das gespeicherte Inventar enthält dagegen nur zehn rein numerische Adressen. Die Ursache ist in `osm_addresses.py::tags_for` belegt: `addr:housenumber` wird nur bei `.isdigit()` übernommen. `zakb.py::import_zakb` filtert ebenfalls auf `.isdigit()` und sortiert mit `int(house_number)`. Auch die Bestätigungsprüfung akzeptiert bislang keine Buchstaben. Es genügt deshalb nicht, nur den HTTP-Request anzupassen.

Eine gesonderte rein lesende Provider-Prüfung der tatsächlich kartierten Adresse [An den Rebenäckern 8A, OSM-Way 1106765386](https://www.openstreetmap.org/way/1106765386) war erfolgreich:

- Gesendet: `aos[Hausnummer]=8`, `aos[Hausnummerzusatz]=A`, Gemeinde Biblis und exakter Straßenwert.
- Zurückbestätigt: `An den Rebenäckern 8 a, 68647 Biblis`.
- Heruntergeladener Kalender: **15 Termine**, SHA-256 `c2ed6658e96880ac68decd0a4cd51f5eb1e1d6c8803b572a887f3ca4f21a1608`.

Dieser Diagnosenachweis wurde nicht als produktiver Kalender veröffentlicht: Die produktive Import- und Validierungskette muss die echte Adresse samt eigenen Geometriedaten erst vollständig unterstützen. Insbesondere darf die bereits gespeicherte Hausnummer 2 nicht zu 2a umbenannt werden; sie ist ein anderes OSM-Objekt.

## Bei den Münchäckern: Adresse belegt, Zuordnung offen

[RWE nennt Bei den Münchäckern 60 als Anschrift der Rückbauanlage Biblis](https://www.rwe.com/-/media/RWE/documents/anfahrtsskizzen/kraftwerke/anfahrtsskizze-rueckbauanlage-biblis.pdf). Die [Gemeindevertretung hat den Straßennamen 2021 beschlossen](https://rim.ekom21.de/biblis/webservice/oparl/v1.1/body/1/files/UGhVM0hpd2NXNFdFcExjZVRtFcJP7akaFadZSh6Z8Rvi3mFjmzGBcfcwe-0DIu5x/Oeffentliche_Niederschrift_Gemeindevertretung_29.09.2021.pdf). Die Inventaradresse ist somit nicht allein wegen der Ablehnung falsch.

ZAKB bietet den Straßennamen aktuell an, weist aber Hausnummer 60 als außerhalb des gewählten Abschnitts zurück. Die Liste enthält daneben einen Sammelwert `Außerhalb - Kernkraftwerk`; dessen konkrete Hausnummernzuordnung ist nicht belegt. Aus dem ähnlichen Standortbezug wird kein automatischer Alias abgeleitet. Insbesondere werden weder die Zahl 60 entfernt noch eine andere Zahl oder ein anderer Standort erfunden. Eine abschließende Aussage zur regulären Behälterabfuhr ist aus dieser Kalenderantwort nicht möglich.

## Am Sportplatz: fehlende bestätigte Geometrie für Hausnummer 2

Die [amtliche Bodenrichtwertkarte Riedrode, Stichtag 2020](https://www.buerstadt.de/fileadmin/Dateien/Dateien/Wirtschaft_und_Infrastruktur/Bodenrichtwerte/431005_Riedrode_A3q_Internet.pdf) führt die Straße Am Sportplatz im Ortsteil Riedrode. Die aktuelle ZAKB-Antwort auf Hausnummer 11 bietet ausschließlich Hausnummer 2 an.

Sowohl im gespeicherten Inventar als auch im untersuchten [aktuellen OSM-Kartenausschnitt](https://api.openstreetmap.org/api/0.6/map?bbox=8.495,49.647,8.500,49.652) ist für diese Straße nur Hausnummer 11 mit vollständigen Adresstags vorhanden. Damit fehlt hier die benötigte eindeutige Geometrie für die angebotene Hausnummer 2. Die Ablehnung allein widerlegt die kartierte Hausnummer 11 nicht. Ein Nachweis für Hausnummer 2 müsste mit ihrer eigenen Position ergänzt werden; eine Übernahme der Position von 11 wäre fachlich falsch.

## Nächster begrenzter Umsetzungsschritt

Für An den Rebenäckern ist eine konkrete Reparatur möglich:

1. Echte numerische Hausnummern mit einem einzelnen Buchstabenzusatz aus der OSM-Quelle übernehmen; Bereiche, Mehrfachangaben und unklare Formate weiterhin gesondert behandeln.
2. Das Inventar mit nachvollziehbarer neuer Extraktionsversion erneuern. Zusätzliche Adressen können auch bisher fehlende Straßen sichtbar machen; die Grundgesamtheit muss dann neu gezählt werden.
3. Sortierung, Fehlersteuerung und Einzeladress-Checkpoints für Zusätze ergänzen. ZAKB-Hausnummer und Zusatz getrennt senden; nur orthografische Unterschiede wie `8A` gegenüber `8 a` normalisieren. Andere Hausnummern oder Zusätze bleiben gesperrt.
4. Den vollständigen Import, Kalenderabruf und die öffentliche Veröffentlichung mit der eigenen Geometrie einer tatsächlich vorhandenen Adresse prüfen.

Bei den Münchäckern und Am Sportplatz bleiben unabhängig davon fachliche Zuordnungs- bzw. Geometriedaten offen. Die Diagnose ist dokumentiert, eine erfolgreiche produktive Bereinigung dieser Fälle wird nicht behauptet.

Reine Diagnose und Dokumentation: keine neuen Tests oder Container-Builds erforderlich; für die Dokumentation ist wegen der Workflow-Pfadfilter kein CI-Lauf vorgesehen. Deutsche-Bahn-Quellen bleiben übersprungen.

## Aktueller Abdeckungsstand

Der abschließende Inventar-/Kalenderabgleich bestätigt weiterhin **821 von 844 Straßenproben**, **14.807 veröffentlichte Termine** und **23 unbestätigte Straßen**. Der erfolgreiche Diagnosedownload für 8A ist darin noch nicht enthalten.

Wichtig für die Zählerinterpretation: Der zuletzt geprüfte reguläre Lauf (Snapshot `2026-10-09T12:56:21Z`) meldet `remaining_streets=13` sowie zehn fehlgeschlagene Straßen. `remaining_streets` zählt dort nur die im Lauf nicht verarbeiteten Proben, nicht alle unbestätigten Straßen. Zusammen mit den zehn Fehlversuchen ergeben sich weiterhin 23 offene Straßen; eine Verbesserung auf nur 13 offene Straßen wird nicht behauptet.
