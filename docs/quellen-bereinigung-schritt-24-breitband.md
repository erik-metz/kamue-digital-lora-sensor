# Schritt 24: Amtliche Breitbandverfügbarkeit

Stand: 10. Oktober 2026. Neue Quelle `bnetza-broadband-households`, Adapter
`bba-households`, täglicher Abruf der amtlichen XLSX-Ausgabe Dezember 2025.
Andere Infrastruktur-Platzhalter und Deutsche-Bahn-Anbindungen unverändert.

## Daten und Bedeutung

[Originaldownload](https://data.bundesnetzagentur.de/Bundesnetzagentur/GIGA/DE/Breitbandatlas/Downloads/bba_12_2025.xlsx),
Blatt `Privathaushalte`, AGS `06431003`, `06431005`, `06431010`, `06431013`.
Sieben Festnetz-Bandbreitenklassen aller Technologien sowie FTTB/H ab 1000 Mbit/s.
Einheit: Prozent der Privathaushalte, unveränderte veröffentlichte Werte.

| Gemeinde | FTTB/H ≥ 1000 Mbit/s | Alle Technologien ≥ 1000 Mbit/s |
| --- | ---: | ---: |
| Biblis | 96,08 % | 96,08 % |
| Bürstadt | 78,90 % | 89,21 % |
| Groß-Rohrheim | 8,50 % | 89,94 % |
| Lampertheim | 37,97 % | 74,65 % |

FTTB/H umfasst Gebäude- und Wohnungsanschlüsse, keine reine FTTH-Quote,
keine Vertragsquote, gemessene Geschwindigkeit oder Baufortschritte.
Keine Betreiber, Einzeladressen oder Kartenpolygone erfunden. Fehlende Angaben
bleiben `null`; echte Nullen bleiben null Prozent. Datenstand ausdrücklich sichtbar.

[Nutzungshinweise](https://gigabitgrundbuch.bund.de/GIGA/DE/Breitbandatlas/start.html)
erlauben kostenlose kommerzielle und nichtkommerzielle Nutzung mit Quellenangabe.
„Breitbandatlas | Gigabit-Grundbuch (https://gigabitgrundbuch.bund.de)“ steht
in Metadaten und Anzeige; die Auswahl der vier Gemeinden ist dokumentiert.

## Umsetzung und Grenzen

Originaldatei vor Verarbeitung mit SHA-256 archiviert. Parser prüft Blatt,
Einheiten, Technologie-/Bandbreitenspalten, Bezugsmonat, AGS/Name, eindeutige
vollständige Gemeindeabdeckung und zulässige Prozentwerte. Unvollständige oder
fehlerhafte Updates ersetzen keine gültige Publikation. Atomare Veröffentlichung
als `infrastructure/broadband`, Vertrag `bba-households-v1`.

Widget zeigt FTTB/H-Prozentwerte, Gigabit aller Technologien und Bezugsmonat.
Erfundene Vertragsquoten-Fallbacks von 40/100 Prozent entfernt. Quellenansicht
benennt die Bundesnetzagentur als Anbieter.

Ausgabe konkret versioniert: täglicher Abruf erkennt Änderungen dieser Datei,
entdeckt aber keine neuen Ausgabedateinamen automatisch. Neue Ausgaben nach
Prüfung im Manifest aktualisieren. `source_updated_at` ist der erste Tag des
Bezugsmonats, kein behaupteter Veröffentlichungstag. Maximales Datenalter zwei
Jahre ab Bezugsmonat, nicht ab erneutem Download.

## Lokale Prüfung

- Parser/PostgreSQL-Integration: 3 Tests plus 9 Fehlerfall-Untertests erfolgreich.
- Registry-Suite: 470 Tests und 13 Untertests erfolgreich; ein bestehender
  GTFS-Migrationstest benötigt die lokal fehlende TimescaleDB-Erweiterung.
  Vorgesehene CI prüft zusätzlich mit TimescaleDB.
- Ruff für neue Python-Dateien erfolgreich; Quellenansicht: 9 Tests erfolgreich.
- Frontend-Produktionsbuild einschließlich TypeScript erfolgreich.
- Vier Originalzeilen mit Parser abgeglichen.

CI-Veröffentlichung und VPS-Nachweis werden nach Abschluss ergänzt.
