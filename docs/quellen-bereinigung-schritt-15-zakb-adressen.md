# Schritt 15: Verbleibende ZAKB-Adressen bereinigen

## Ausgangspunkt

793 von 844 Straßenproben sind bestätigt. Die 51 offenen Straßen verteilen sich laut gespeichertem letzten Fehler auf 32 `MissingStreet`, 14 `AddressNotAccepted`, zwei `AmbiguousStreet`, zwei `AddressMismatch` und einen `RemoteProtocolError`. Das sind Adressproben, keine 51 ausgefallenen Anbieter. Die Klassifikation wird mit der aktuellen ZAKB-Auswahlliste abgeglichen.

## Belegte Namens- und Ortsteilzuordnungen

- Endständiges `Str.` wird als übliche Abkürzung für `Straße` erkannt. Das betrifft unter den offenen Proben Hermann-Löns-Straße und Zeppelinstraße in Bürstadt sowie Albert-Schweitzer-Straße und Alte Wormser Straße in Lampertheim.
- Die [amtliche Bibliser Straßenliste, Anlagen 1–3](https://www.biblis.eu/rathaus/ortsrecht/satzungen/satzung-ueber-die-erhebung-von-wiederkehrenden-strassenbeitraegen.pdf?cid=lh) führt Bachgasse im Kernort und Enggasse in Nordheim. Diese Zuordnungen lösen die zwei doppelten ZAKB-Auswahlwerte auf. Die Liste führt außerdem Neuländerpfad in Wattenheim und Friedensstraße im Kernort; die aktuellen ZAKB-Werte heißen Neuländerpfad und Friedenstraße.
- Die [amtliche Bodenrichtwertkarte Bürstadt](https://www.buerstadt.de/fileadmin/Dateien/Dateien/Rathaus_und_Politik/bodenrichtwerte_karte_buerstadt.pdf) belegt die Schreibweisen Sophienstraße und Vincenzstraße. Das Inventar führt Sofienstraße und Vinzenzstraße.
- Die [städtische Lampertheimer Planung](https://rim.ekom21.de/lampertheim/sdnetrim/UGhVM0hpd2NXNFdFcExjZZ6YwhZMraU7WSixIIV92T-JOTa6U0M7f6ifZs6OycPm/Beschlussvorlage_2009-11.pdf) nennt Wilhelm-von-Ketteler-Straße. Der aktuelle ZAKB-Wert lautet Wilhelm-v.-Ketteler-Straße.

Diese historischen amtlichen Dokumente werden mit den aktuellen Provider-Auswahlwerten abgeglichen. Es gibt ausschließlich die oben einzeln geprüften gemeindespezifischen Zuordnungen. Eine direkte Übereinstimmung hat Vorrang vor einem Alias. Kein automatischer unscharfer Namensvergleich wird für die Adressauswahl verwendet. ZAKB muss anschließend den tatsächlich gesendeten Straßenwert, die echte Inventarhausnummer und den gewählten Ort genau bestätigen; andernfalls werden keine Kalender veröffentlicht.

## Fortschritt bei Hausnummernproben

Bisher waren auch spätere Läufe auf dieselben drei kleinsten Hausnummern beschränkt. Jetzt wird jede tatsächlich abgelehnte Adresse mit ihrer eigenen Fehlerklasse gespeichert. Noch nicht gescheiterte echte Inventaradressen haben Vorrang, danach die am längsten zurückliegenden Fehlversuche. Eine bewährte Hausnummer bleibt bevorzugt. Höchstens drei Adressen werden pro Straße und Lauf geprüft; jede behält ihre eigenen Koordinaten. Aktive Wiederholungsfristen bleiben berücksichtigt.

## Prüfung und Veröffentlichung

52 relevante lokale Datenbank-, Formular-, Vertrags- und Scheduling-Tests erfolgreich. Die Prüfungen belegen insbesondere den Fortschritt zur vierten realen Hausnummer im Folgelauf sowie den weiterhin gesperrten Download bei falscher Straßenbestätigung, auch nach Namens- oder Ortsteilzuordnung. Ruff für die eigenen Python-Dateien und `git diff --check` erfolgreich. CI, GHCR und Live-Ergebnisse werden nach Abschluss ergänzt.

Deutsche-Bahn-Quellen bleiben übersprungen.
