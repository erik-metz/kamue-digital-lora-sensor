# ENTSO-E-Marktintervalle

Der optionale Adapter archiviert unabhängig voneinander Day-ahead-Preise
(A44, Gebotszone Deutschland–Luxemburg), veröffentlichte tatsächliche Last
(A65/A16, Deutschland) und Erzeugung nach Produktionstyp (A75/A16, Deutschland).
Die Oberfläche `/energie/markt` zeigt Gebiet, Einheit, Datenalter und Quellenbeleg.
Diese Gebietsreihen liefern keine lokale Erzeugungs- oder Verbrauchsmessung.
Veröffentlichte tatsächliche Leistungen können Schätzungen des Anbieters enthalten.

## Aktivierung

Zuerst den skalaren Messvertrag mit `python measurement_migration.py install`
im API-Verzeichnis installieren. Auf dem Server `ENABLE_ENTSOE=true`,
`ENTSOE_API_TOKEN` als Secret und optional `ENTSOE_POLL_SECONDS` setzen
(Mindestwert und Standard: 3600). Compose reicht diese Werte an den bestehenden
Environment Collector weiter. Ohne Aktivierung bleibt der Adapter deaktiviert.
Secrets nicht ins Repository oder in Chatnachrichten schreiben.

Der Token wird im dokumentierten `SECURITY_TOKEN`-Header übertragen, nicht
in der URL. Konfigurationsdarstellung, gespeicherte Anfrageparameter und
Fehlertexte enthalten ihn nicht. Antworten mit einem zurückgespiegelten Token
werden verworfen. Jeder Produktabruf hat eine eigene Fehlergrenze; vorhandene
Wetterdaten und erfolgreiche andere Produkte bleiben erhalten.

## Speicherung und Darstellung

Das Anfragefenster umfasst gestern, heute und morgen als 72 Stunden ab
UTC-Mitternacht. Die Quellintervalle bleiben erhalten; Tagesgrenzen der Quelle
werden auf vollständig im Fenster liegende Intervalle begrenzt. Unterstützt
werden 15, 30 und 60 Minuten. UTC-Speicherung und Anzeige mit Zeitzone halten
Sommerzeitwechsel unterscheidbar. Preise bleiben EUR/MWh, Leistungen MW;
negative Preise sind gültig. Es erfolgt keine Umrechnung in Energiemengen.

Original-XML und Abrufbeleg werden vor dem Parsen archiviert. Gebiete, Dokument-
und Geschäftsarten, Einheiten, Revisionen und Zeitfenster werden geprüft.
A01-Lücken bleiben fehlend; A03-Änderungsblöcke gelten bis zum nächsten Block.
Fehlende Werte werden niemals als Null ausgegeben. Erzeugung und Verbrauch
bleiben getrennt, ebenso Quellserien; unvollständige Serien werden nicht summiert.

Jeder Antwort-Hash bildet einen unveränderlichen Snapshot. Wiederholungen
bleiben idempotent, Änderungen erhalten neue Snapshots. Die API
`/environment/measurements/energy?product=price|load|generation&limit=100&offset=0`
liefert pro Produkt den letzten erfolgreich importierten Snapshot, paginiert
und unter Beachtung der Sichtbarkeit des Messvertrags. Fehlerhafte neue
Antworten ersetzen keine gültigen alten Daten. Die Oberfläche kennzeichnet
Daten über drei Stunden als veraltet. Dokument-ID, Revision, Veröffentlichungs-
zeit, Serienkennung, Auflösung und Abrufzeit bleiben nachvollziehbar.

## Prüfung und Grenzen

Die XML-Fixtures stammen unverändert aus den offiziellen ENTSO-E-Beispielen.
Tests passen Gebiete, Daten und den täglichen Preisvertrag ausdrücklich an;
diese synthetischen Antworten sind kein Nachweis eines authentifizierten
Live-Abrufs. Geprüft werden unter anderem negative Preise, Null und Lücken,
A01/A03, Sommerzeit, Archivintegrität, Korrekturen, Paging, Tokenbehandlung
und unabhängige Produktfehler mit PostgreSQL.

Bei der Implementierung war kein ENTSO-E-Token verfügbar. Der authentifizierte
Live-Abruf und eine Produktionsaktivierung sind deshalb noch nicht verifiziert.

## Offizielle Grundlagen

- [Aktuelle REST-Dokumentation](https://documenter.getpostman.com/view/7009892/2s93JtP3F6)
- [XML-Beispiele](https://gitlab.entsoe.eu/transparency/xml-examples)
- [Gebiete und EIC](https://transparencyplatform.zendesk.com/hc/en-us/articles/15885757676308-Area-List-with-Energy-Identification-Code-EIC)
- [Token-Zugang](https://transparencyplatform.zendesk.com/hc/en-us/articles/12845911031188-How-to-get-security-token)
- [Nutzungsbedingungen](https://transparencyplatform.zendesk.com/hc/en-us/articles/40921911218961-Legal-Terms-and-Conditions)

Die integrierten Reihen werden mit ENTSO-E-Attribution und CC-BY-4.0-Verweis
geführt. Weitere Gebiete oder Produkte erfordern eine erneute Prüfung der
jeweiligen Datenfreigabe.
