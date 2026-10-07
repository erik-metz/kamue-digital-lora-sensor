# Quellenbereinigung – Schritt 4: DWD RADOLAN und MOSMIX

Stand: 7. Oktober 2026.

## Ursachen und Korrekturen

Beide Anbieterdateien waren erreichbar und auswertbar. Der Collector entpackte
jedoch `NormalizedEnvironment` in zwei Listen und suchte die zusätzlichen
Radar- und Prognosefelder anschließend auf der einfachen Wetterliste. Dadurch
wurden die normalisierten DWD-Daten nicht an die Speicherung übergeben.
Die Übergabe verwendet jetzt die Felder des vollständigen Ergebnisses.

MOSMIX zählte außerdem Prognoseobjekte als Messwerte, auch wenn der produktive
Wetter-Schreibmodus `legacy` die eigentlichen Schreiboperationen ausließ.
Prognosen werden jetzt unabhängig vom Schalter für beobachtetes Wetter in
den bereits installierten Messdatenkern geschrieben. Nur tatsächlich
abgeschlossene Wertschreiboperationen zählen zur gemeldeten Menge. Der
numerische Funktionsparameter wird ausdrücklich als PostgreSQL `numeric`
übergeben. Die Daten bleiben Modellprognosen (`basis=model`); `RR1c` ist eine
Stundensumme mit Anfang, Ende und `semantics=period_total`.

RADOLAN verwendet die Header-Zeit und die dort deklarierte Präzision. Ungültige
Header erzeugen keine künstliche aktuelle Messzeit. Die unteren zwölf Bits
enthalten den Wert; Stationsinterpolationsflags werden vom Wert getrennt.
Fehlende, negative und Clutter-Pixel werden nicht als trockene Beobachtung
veröffentlicht. Tatsächliche Nullwerte bleiben 0 mm. Das konfigurierte nationale
900×900-Raster bleibt der unterstützte Gittertyp.

Grundlage für die RADOLAN-Wertcodierung:
[DWD-Unterstützungsdokument zum Binärformat](https://opendata.dwd.de/climate_environment/CDC/help/RADOLAN/Unterstuetzungsdokumente/Unterstuetzungsdokument_fuer_Programmierer-Lesen_des_RADOLAN-Binaerformats.pdf).
Prognoseformat:
[DWD-MOSMIX-KML-Beschreibung](https://www.dwd.de/EN/ourservices/met_application_mosmix/mosmix_kml_format_description.pdf?__blob=publicationFile&v=4).

Die korrigierte Übergabe betrifft auch das zusätzliche Blitzfeld. Fehlt dessen
Download, wird kein Blitzobjekt mit einer erfundenen Nullmenge erzeugt. Der
separate HTTP-401-Zugriffsfehler bei Blitzortung bleibt ein offener Schritt.

## Lokale Nachweise

- Vollständige Umweltcollector-Suite: **64 Tests bestanden**, einschließlich
  echter PostgreSQL-Speicherprüfungen in isolierten Testschemata.
- Ruff und Prüfung auf Diff-Formatfehler erfolgreich.
- Reale HTTP-Abrufe durch den Collector mit Antwortarchivierung, Normalisierung
  und Speicherung in einer isolierten Testdatenbank erfolgreich: RADOLAN
  **1 Messwert**, MOSMIX **120 Messwerte** über **24 Prognosestunden**.
- Der Radarwert im geprüften Lauf beträgt tatsächlich 0 mm. Die MOSMIX-Werte
  verteilen sich auf Temperatur, Taupunkt, Windgeschwindigkeit,
  Niederschlagswahrscheinlichkeit und Stundenniederschlag, jeweils 24.
- Wiederholte Speicherung erzeugt keine zusätzlichen identischen Messungen.
- Auf dem produktiven VPS ist der benötigte Messdatenkern bereits installiert.

CI-/GHCR-Erfolg und die produktive Übernahme werden nach dem Push separat
geprüft. Lokale Simulationsdaten wurden nicht in die produktive Datenbank
übertragen. Die RADOLAN-Abfrage repräsentiert eine Rasterzelle am konfigurierten
Ried-Punkt; MOSMIX bezieht sich auf die konfigurierte DWD-Station 10729. Daraus
folgt keine vollständige räumliche Abdeckung des Rieds.
