# SolarEdge: Anlagenzugang für Schritt 5

Stand: 8. Oktober 2026. Technische Vorbereitung begonnen; keine produktive SolarEdge-Integration aktiviert.

## Aktuelle Anbieterprüfung

Die [aktuelle API-Dokumentation](https://api-docs.solaredge.com/) nennt den 1. November 2026 als Abkündigungsdatum der Monitoring-API V1. Das [Entwicklerportal](https://developer.solaredge.com/) beschreibt V2 mit OAuth 2.0, Anwendungen mit Client-ID/Secret und Freigaben für eigene bzw. autorisierte Anlagen. Die Dokumentation nennt tarifabhängige Monatskontingente und Aufrufgrenzen. Die alte PDF und deren Quote dürfen deshalb nicht als unveränderter Vertrag einer neuen Integration verwendet werden.

Für die Umsetzung ist V2 vorgesehen. Konkrete Antwortfelder, Einheiten, Zeitbezug, Berechtigungen und Quoten werden anhand der für die teilnehmende Anlage tatsächlich verfügbaren Dokumentation und Antworten festgelegt. Die öffentlich zugängliche Startseite allein genügt dafür nicht.

## Was vom Betreiber benötigt wird

1. Eine konkrete teilnehmende SolarEdge-Anlage im Ried und die Zustimmung zur öffentlichen Anzeige ihrer Erzeugungsdaten. Die Freigabe soll den Umfang, die gewünschte öffentliche Bezeichnung und die Möglichkeit zum Widerruf festhalten.
2. Die gewünschte räumliche Darstellung: zunächst Gemeindezuordnung. Eine genaue private Adresse oder Koordinate ist für den Erzeugungsimport nicht erforderlich.
3. Anlagenfreigabe und Zugang über das aktuelle Entwicklerportal. Dort ein Entwicklerkonto und eine Anwendung einrichten; das Portal beschreibt Client-ID/Secret und anschließende Anlagenautorisierung. Diese Einrichtung nimmt der Kontoinhaber vor. Bitte zunächst den verfügbaren Zugangstyp und den Stand der Freigabe nennen.
4. Für die autorisierte Anlage verfügbare API-Referenz, Zeitzone und Kontingent prüfen. Keine kostenpflichtige Tarifumstellung ist Teil dieses Schritts.

Zugangsdaten werden erst nach Klärung des OAuth-Vertrags ausschließlich serverseitig eingerichtet. Der Benutzername des Anlagenbetreibers, Verbrauchsverläufe, Geräteinventar und private Standortdetails gehören nicht zur geplanten öffentlichen Veröffentlichung.

## Bereits vorhandene Grundlage

`energy-meter-feed` ist im Quellmanifest deaktiviert und hat keinen Endpunkt. Der bestehende Energievertrag unterscheidet aktuelle Leistung in kW/MW von Tagesenergie in kWh; Kapazität ist optional und darf nicht als aktuelle Erzeugung ausgegeben werden. Das vorhandene Widget liest gespeicherte Messwerte über `/api/infrastructure/energy`.

Die SolarEdge-Integration soll nach Prüfung des Zugangs eigene freigegebene Anlagen im Kernmodell speichern. Fehlende Messwerte bleiben Datenlücken. Zeitintervalle, Tageswechsel, Zähler und Einheiten werden anhand der echten API validiert. Die Anzeige soll ausdrücklich die teilnehmenden Anlagen beschreiben, nicht die Gesamtproduktion des Rieds. Widerruf muss Abruf und Veröffentlichung beenden; historische Exporte und Caches werden dabei berücksichtigt.

## Nächster Umsetzungspunkt

Sobald Anlage, Veröffentlichungsfreigabe und V2-Zugangsart geklärt sind: API-Vertrag verifizieren, Collector und Rechteentzug implementieren, Kernmodell/API/Anzeige ergänzen und den echten Abruf samt Betreibervergleich abnehmen. Solange diese Informationen fehlen, bleibt Schritt 5 offen. Schritt 6 wird damit nicht vorgezogen.
