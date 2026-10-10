# Autobahn-Rastplätze und LKW-Belegung

Die Kartenkategorie „Parken“ lädt `/api/autobahn-rest-areas`. Der Endpunkt liest die bereits dauerhaft gespeicherten Autobahn-Inventare für A67, A5 und A6. Datenabruf, Rohdatenarchiv und Inventarhistorie bleiben beim vorhandenen VPS-Collector. Es entsteht keine zweite Belegungsdatenbank.

## Zuordnung und Darstellung

Das Anbieterfeld `providerId` entspricht der DATEX-Kennung. Die vorhandenen rast-monitor-Sensoren verwenden `rast-{datex_id.lower()}`. Nur diese exakte Kennung wird verbunden. Mehrdeutige Treffer oder Standorte mit mehr als 0,005° Breiten- bzw. 0,008° Längenabweichung werden abgewiesen. Nähe und Name allein reichen nicht; gegenüberliegende Fahrbahnen bleiben getrennt.

Am 10.10.2026 hatten alle 26 Inventareinträge einen entsprechenden Sensor im öffentlichen Kartenbestand: A67 9/9, A5 14/14, A6 3/3. Das ist eine Bestandsaufnahme, keine garantierte künftige Abdeckung. Fehlende Zuordnung bedeutet keine Aussage über die Existenz von Belegungsdaten außerhalb des geladenen Bestands.

Bei eindeutig zugeordneten Standorten bleibt ausschließlich der vorhandene lila Belegungsmarker sichtbar. Inventare ohne passenden geladenen Belegungsmarker verwenden denselben lila Parkplatzstil und einen zentrierten Anker. Die zugängliche Inventarliste enthält weiterhin beide Quellen, Kennung, Richtung soweit bekannt, PKW-/LKW-Inventarkapazitäten und rast-monitor-LKW-Kapazität; Popups der ergänzenden Marker ebenso. Kapazitätsabweichungen werden angezeigt. Beispiel Lorsch West: Autobahn 32 LKW, rast-monitor 42 LKW. Werte werden weder addiert noch zur Neuberechnung der freien Plätze verwendet.

Freie LKW-Plätze stammen ausschließlich aus `parking_free`, einschließlich echter Nullwerte. Die Daten dürfen höchstens 30 Minuten alt sein; ungültige oder zukünftige Zeitstempel werden ausgeschlossen. Die rast-monitor-Daten können modellbasiert sein. Der bestehende Collector verwendet `fetched_at` und bei fehlendem Datum seine aktuelle Zeit: Die Anzeige nennt deshalb „Datenzeit“, keine bestätigte Messzeit. Für PKW wird keine Belegung erfunden.

Inventare verfallen nach 72 Stunden, auch in einer geöffneten Karte. Abrufzeit ist keine Anbieteraktualisierung. Fehler einzelner Straßen erscheinen als Teilverfügbarkeit; vollständiger Ausfall liefert HTTP 503, gültige leere Bestände HTTP 200. Die Karte aktualisiert das Inventar alle fünf Minuten und die Altersprüfung alle 30 Sekunden. Schließen der Parkkategorie beendet den Abruf.

## Prüfung

Automatisierte Tests prüfen Identität statt Nähe, Gegenrichtung, Mehrdeutigkeit, Koordinatenkonflikte, Nullwerte, Kapazitätsabweichungen, Ablauf und Teilverfügbarkeit. Frontend-Typprüfung und Produktionsbuild ergänzen die Kartentests.
