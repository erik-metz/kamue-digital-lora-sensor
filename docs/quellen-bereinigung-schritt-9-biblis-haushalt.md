# Schritt 9: Bibliser Haushaltsplan – erneute Prüfung am 8. Oktober 2026

## Ergebnis

Der Datenabruf funktioniert. Die öffentliche Status-API meldet HTTP 200 und `partial` mit `ordinary_totals_do_not_reconcile`. Eine Veröffentlichung als Prüfbericht ist vorhanden. Der Fehler stammt aus widersprüchlichen amtlichen Angaben, nicht aus einer fehlgeschlagenen Verbindung oder Texterkennung. Der Prüfstatus bleibt bestehen, bis die Angaben durch eine maßgebliche korrigierte Veröffentlichung geklärt sind.

## Aktuelle Nachweise

Die [offizielle Haushaltsseite](https://www.biblis.eu/rathaus/ortsrecht/haushaltsplan/) verlinkt weiterhin [Haushaltsplan 2026](https://www.biblis.eu/rathaus/ortsrecht/haushaltsplan/haushaltsplan-2026.pdf?cid=ha1). Die Datei wurde erneut vollständig heruntergeladen: 45.257.365 Bytes, 302 Seiten. Seite 4 wurde gerendert und visuell mit der Parserausgabe verglichen.

Die am 11. Februar 2026 beschlossene Haushaltssatzung enthält:

- Ordentliche Erträge: 24.166.774 EUR.
- Ordentliche Aufwendungen: 26.800.450 EUR.
- Gedruckter ordentlicher Saldo: -2.572.977 EUR.
- Rechnerischer Saldo: -2.633.676 EUR; Abweichung 60.699 EUR.
- Außerordentliches Ergebnis: 600.000 EUR; gedruckter Gesamtfehlbedarf 1.972.977 EUR.

Der von der Gemeinde verlinkte [digitale Haushalt 2026](https://biblis.haushaltsdaten.de/2026/zahlen-und-fakten) nennt dagegen ordentliche Erträge von 24.628.078 EUR und Aufwendungen von 27.201.055 EUR. Diese ergeben den dort ausgewiesenen Fehlbetrag von 2.572.977 EUR. Rechnerische Stimmigkeit dieses anderen Zahlenpaars behebt den Widerspruch zur veröffentlichten Satzung nicht. Es wurde deshalb kein Zahlenpaar stillschweigend durch ein anderes ersetzt.

## Prüfungen und Entscheidung

- Aktueller PDF-Parser reproduziert exakt die gedruckten sieben Werte und die bekannte Rechenabweichung.
- Sieben vorhandene Budgettests erfolgreich, einschließlich Schutz vor Veröffentlichung widersprüchlicher Werte als abgestimmter Haushalt.
- Produktionsstatus vom 8. Oktober 2026: letzter Abruf 11:25:36 UTC, Verarbeitung 11:25:38 UTC, HTTP 200, ein veröffentlichter Prüfbericht, Status `partial`.
- Keine Änderung an Collector, Datenbeständen oder Deployment erforderlich. Nur dieser Prüfbericht wird committed und gepusht; für `docs/` ist kein CI-/GHCR-Lauf vorgesehen.
- Für eine Freigabe ist eine korrigierte maßgebliche Quelle oder eine eindeutige amtliche Erklärung der unterschiedlichen Summen erforderlich. Es wurde keine Nachricht an die Gemeinde gesendet.

Deutsche-Bahn-Quellen bleiben übersprungen. Als verbleibende aktive Quelle mit Teilstatus ist der ZAKB-Kalender zu prüfen. Blitzortung wurde zuvor durch Xweather ersetzt und ist deaktiviert; sein historischer Fehler ist kein neuer aktiver Abrufausfall.
