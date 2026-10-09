# Schritt 16: ZAKB-Außenbereiche und fehlende Auswahlwerte

## Umfang und Befunde

Ausgangspunkt: 810 von 844 repräsentativen Straßenproben bestätigt, 34 offen. Untersucht werden die 25 im gezielten Lauf von Schritt 15 als `MissingStreet` gemeldeten Straßen. Die aktuellen Provider-Auswahllisten wurden erneut abgerufen und Ortsteile mit einbezogen. 21 dieser Namen fehlen unverändert als exakter Auswahlwert; für drei bestehen belegte alternative Bezeichnungen. Finkenstraße ist vorhanden: Die vorige Fehlermeldung ließ sich in einer frischen Sitzung nicht bestätigen. Ihre Ursache ist bisher nicht reproduziert, deshalb wird kein vermuteter Sitzungsfehler als behoben ausgegeben.

## Belegte Zuordnungen

- `Wildbahn` → `Außerhalb Wildbahn`: [HessenForst nennt die Adresse Außerhalb Wildbahn 2](https://hessen-forst.de/unsere-39-forstaemter/forstamt-lampertheim); das [Landesamt für Denkmalpflege über die Deutsche Digitale Bibliothek](https://www.deutsche-digitale-bibliothek.de/item/XULWYW2IZ56NPDKFWX7E6INUCETM3ZS3) belegt außerdem Hausnummer 1. ZAKB bietet den Namen an und bestätigt die realen Inventarhausnummern 2 und 3 exakt; 1 wird abgelehnt.
- `Am Küblinger Damm` → `Außerhalb Am Küblinger Damm`: Die [städtischen Planungsunterlagen](https://rim.ekom21.de/lampertheim/sdnetrim/UGhVM0hpd2NXNFdFcExjZbfMlNl2ZgGfZFalfAnVU4BZjWJfZBVOsznPoe-STmyoFvlFgg_BIrrd3KrbbdCHGA/Gesamtes_Sitzungspaket.pdf) führen den Wohnplatz Am Küblinger Damm. ZAKB bietet die ergänzte Außenbereichsbezeichnung an und bestätigt Inventarhausnummer 5 exakt.
- `Außerhalb Ost` → `Außerhalb-Ost`: Die [Hochwassergefahrenkarte des HLNUG](https://www.hlnug.de/fileadmin/dokumente/wasser/hochwasser/hwrmp/Weschnitz/g-karten/HWGK_Weschnitz_G-06.pdf) führt Außerhalb-Ost. ZAKB bestätigt Inventarhausnummer 24 exakt; 41 wird abgelehnt.

Diese drei Zuordnungen gelten ausschließlich für Lampertheim. Die direkte Namensübereinstimmung hat weiterhin Vorrang. Auch nach Zuordnung muss ZAKB Straße, reale Hausnummer und Gemeinde exakt zurückbestätigen; andernfalls erfolgt kein Kalenderdownload. Koordinaten und veröffentlichter Inventarname bleiben bei der tatsächlich geprüften Inventaradresse.

Finkenstraße 1, 3, 5, 6 und 7 werden abgelehnt, 8 wird exakt bestätigt. Der Nachweis betrifft die Formularantwort; Veröffentlichung und Kalenderabruf werden separat nach dem Deployment geprüft.

## Weiterhin ohne sichere Zuordnung

| Gemeinde | Inventarstraße | Befund |
| --- | --- | --- |
| Biblis | Am Tambourinsee | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | Am Wadowski See | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | An der Schleuse | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | Außerhalb | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | Außerhalb (Nordheim) | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | Außerhalb (Wattenheim) | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | Dungauer Weg | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | Eichenweg | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Biblis | In den Kesselwiesen | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Bürstadt | Am Fischweiher | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Bürstadt | Außerhalb | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Bürstadt | Kirchgasse | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Bürstadt | Kleine Gewerbestraße | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Ausserhalb Brunnengewännchen | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Außerhalb | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Außerhalb-Brunnengewännchen | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Außerhalb-Große Lache | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Außerhalb-In der Bildgewann | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Bahnhaus | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Seebuckel | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |
| Lampertheim | Seehof | Kein exakter aktueller Auswahlwert; keine belegte eindeutige Zuordnung |

Die [amtliche Bürstädter Planung](https://www.buerstadt.de/de/rathaus-politik/politik/buergerinformationssystem/wicket/resource/org.apache.wicket.Application/doc160796.pdf) belegt Kleine Gewerbestraße als eigenständige Straße. Eine Gleichsetzung mit Gewerbestraße wurde daher nicht übernommen. Generische Inventarwerte wie Außerhalb sowie Provider-Sammelwerte wie „2x Wohngebäude“ benötigen einen hausnummernbezogenen Ortsnachweis; ein Straßenalias wäre zu weit gefasst. Es werden weder Fantasieadressen noch lediglich ähnlich klingende Namen ergänzt.

## Validierung und Veröffentlichung

29 Formular- und Adressvertragsprüfungen erfolgreich, darunter sechs neue Fälle für die drei Außenbereichszuordnungen mit korrekter und absichtlich falscher Bestätigung. Ruff für die beiden eigenen Python-Dateien und `git diff --check` erfolgreich. Der bestehende Ablauf für Cache, Adressauswahl, Wiederholungsfristen und Veröffentlichung bleibt unverändert. CI, GHCR und tatsächliche Live-Veröffentlichung werden nach Abschluss ergänzt.

Deutsche-Bahn-Quellen bleiben übersprungen.
