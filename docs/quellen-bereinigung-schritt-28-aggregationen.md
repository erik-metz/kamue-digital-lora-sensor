# Schritt 28: Demografie- und Wohnen-Aggregationen

## Berechnungsregeln

Die Regionsansicht umfasst exakt Bürstadt, Lampertheim, Biblis und Groß-Rohrheim.
Zusätzliche Orte und Ortsteile werden nicht mitgezählt. Pro Kommune muss genau
ein passender Datensatz vorliegen. Fehlende oder doppelte Kommunen sowie
abweichende oder unbekannte Bezugsjahre verhindern eine regionale Berechnung.
Fehlende Einzelwerte bleiben null und beeinflussen nicht die unabhängig
vollständigen Kennzahlen. Nullwerte bleiben echte Nullwerte.

Demografie: Summen nur für vollständige, gleichjährige Angaben. Dichte aus
Gesamtbevölkerung / Gesamtfläche, keine Mittelung kommunaler Dichten.
Ausländeranteil nach Bevölkerung gewichtet und als Näherungswert bezeichnet,
da die kommunalen Prozentwerte gerundet sein können. Keine durchschnittliche
Haushaltsgröße ohne Haushaltszahlen. Kein fremder Datensatz bei unbekannter
Kommunenauswahl; Wanderungssalden mit korrektem Vorzeichen.

Altersstruktur: Der Vertrag enthält keine Bezugsjahre. Keine regionale Summe;
Einzelkommunen bleiben auswählbar. Feste Altersanteile entfernt. Prozentbalken
zeigen die tatsächlichen Anteile statt einer vergrößerten Darstellung.
Pendlerbeziehungen bleiben Einzelbeziehungen mit ihrem jeweiligen Berichtsjahr.
Keine über Jahre und Kommunen addierte vermeintliche Zahl einzigartiger Personen.

Wohnungszusammenfassungen: Ohne Bezugsjahre und Preisstichproben keine regionalen
Summen, Mieten oder Kaufpreise. Feste Kaufpreise, Wohnflächen, Preisspannen und
Landesvergleiche entfernt. Ein einzelner Marktbenchmark wird nur bei eindeutiger
Kommunenauswahl verwendet, nicht als vermeintlicher Regionspreis.

Gebäudebestand: Gleichjährige, vollständige kommunale Gesamtbestände werden
addiert; Ortsteile nicht. Wohnfläche je Wohnung wird mit der Wohnungszahl
gewichtet, Leerstandsquote aus Leerstand / Gesamtwohnungen berechnet.
Fehlende Baualters-/Gebäudetypklassen bleiben offen. Heizungsprozente werden
regional nicht gewichtet, weil der Vertrag ihre Bezugsgröße nicht benennt.
Einzelkommunen behalten die Originalangaben und deren Bezugsjahr. Unbekannte
Kommunen erhalten keine Regionswerte als Ersatz. Fehlende Werte haben keine
positive Mindestbalkenbreite.

## Prüfung und verbleibende Grenzen

Acht Berechnungstests: ungleiche Gewichte, Flächen, Teilabdeckung, doppelte
Kommunen, verschiedene Jahre, fehlende Werte, Nullwerte, ungültige Zahlen,
fehlende Klassen und Abgrenzung von Ortsteilen. Drei Renderprüfungen gegen
falsche Ersatzwerte, NaN/Infinity, feste Jahreszahlen und falsche Vorzeichen.
Die Tests laufen zusammen mit den Regionaltests in Frontend CI.
ESLint der beiden Komponenten und des neuen Berechnungsmoduls sowie
Next.js-Produktionsbuild sind Teil der Prüfung.

Der Schritt korrigiert die älteren Dashboardkomponenten. Er stellt keine neuen
Detaildatensätze bereit; bei fehlenden Detaildaten bleiben die vorhandenen
amtlichen HSL-Tabellen der angezeigte Ersatz. Keine Änderungen an Datenbank,
VPS oder Datenquellen, keine GHCR-Veröffentlichung erforderlich. Die öffentlich
ausgelieferte Frontendversion ist nicht unabhängig verifiziert.
