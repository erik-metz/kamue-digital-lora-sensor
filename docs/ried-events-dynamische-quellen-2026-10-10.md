# Dynamische Ried-Veranstaltungsquellen, 10.10.2026

## Umsetzung

Die Quellenprüfung vom 09.10.2026 ist für alle aufgeführten Importformate umgesetzt.
Der Social-Bestand umfasst nun 27 aktive Quellen mit einem Abrufintervall von sechs
Stunden. Der räumliche Umfang bleibt Bürstadt, Lampertheim, Biblis und Groß-Rohrheim
mit ihren Ortsteilen.

- SG Hüttenfeld: Veranstaltungsseiten werden aus dem aktuellen Events-Menü entdeckt;
  neue Unterseiten benötigen keinen Eintrag in einer festen URL-Liste.
- HCV: Alle öffentlichen Einträge der veröffentlichten Kampagnenliste werden als
  Daten gelesen; keine Ausführung von JavaScript, keine feste Titel- oder Jahresliste.
- Stadtmarketing Lampertheim: Weihnachtsmärkte, veröffentlichte Jahre, einzelne
  Öffnungstage und Uhrzeiten werden dynamisch gelesen. Neue Ortsteilabschnitte
  werden unterstützt. Geänderte zukünftige Quelltermine ersetzen alte Einträge.
- Spargelwanderung, Spargelfest, Howwemer Kerb und Lambada Kerwe: Explizite
  Jahresangaben und Datumsbereiche ersetzen eingefrorene Absätze und Termine.
- Groß-Rohrheim: Langfristige Termine akzeptieren weitere explizite Jahre;
  Arbeitsgruppen weitere veröffentlichte Treffen. Ein neuer RSS-Import entdeckt
  Gemeindemitteilungen und öffentliche Einladungen mit ausdrücklich genanntem
  Datum und Veranstaltungsort. Bereits gesondert importierte Mitteilungen werden
  ausgenommen. Artikel, die aus dem RSS-Feed herausfallen, verlieren dadurch nicht
  ihre zuvor veröffentlichten zukünftigen Termine.
- Rompin Stompin, TV Groß-Rohrheim Gymnastik und Lauftreff, TV Bürstadt Lauftreff,
  TV Lampertheim Triathlon: Angebote und Zeiten werden aus den aktuellen
  Kurs-/Trainingsabschnitten gelesen; keine vollständigen Seiten- oder Kurs-Hashes.
  Anmeldung, Saisonbedingungen und Häufigkeit bleiben im Beschreibungstext erhalten.
- Kommunale und Vereinskalender: Der gemeinsame Abrufhorizont umfasst fünf
  Kalenderjahre, einschließlich des laufenden Jahres, statt zuvor zwei. Bei
  Lampertheim werden widersprüchliche Listenzeiträume nur mit einem gültigen,
  ausdrücklich datierten Detailzeitraum berichtigt.
- Jede erfolgreiche Social-Verarbeitung veröffentlicht Annahme-/Rückstellungszahlen,
  begrenzte Diagnosebeispiele und HTTP-Abrufzahlen unter
  `social/source-diagnostics/<source-id>`. Die Annahmezahl steht auch im Abrufstatus.
  Rückstellungen zählen protokollierte Entscheidungen, nicht zwingend eindeutige Termine.
- HTTP 429 berücksichtigt zusätzlich ein als HTTP-Datum geliefertes Retry-After;
  die Triathlonquelle erhält längere begrenzte Wiederholungsabstände.

Bestehende Cross7- und Tribe-Paginierung bleibt erhalten. Daten werden erst nach
vollständigem erfolgreichem Quellenabruf veröffentlicht. Fehlerhafte Strukturen
führen nicht zur Veröffentlichung einer unvollständig gelesenen Ersatzliste.

## Grenzen

Eine Quelle muss Datum/Jahr und den tatsächlichen Veranstaltungsort veröffentlichen.
Fehlende Jahre werden nicht aus Abrufdatum oder Nachrichtendatum geraten;
Veranstalteranschriften werden nicht als Veranstaltungsorte übernommen.
Unklare Trainingsvarianten werden zurückgestellt. Regelmäßige Angebote bleiben
von einzelnen datierten Veranstaltungen getrennt. Bildplakate werden nicht
allgemein per OCR interpretiert; der bestehende geprüfte TC74-Plakattermin bleibt
als eigener Import erhalten. Eine vollständige Erfassung jeder bildbasierten oder
unvollständig beschriebenen Ankündigung wird daher nicht behauptet.

## Prüfung

Die abschließende vollständige isolierte Registry-/Timescale-Prüfung ergibt
458 bestandene Tests. Regressionstests decken den erweiterten Horizont und das
Ersetzen verschobener Artikeltermine ab. Ruff besteht für alle eigenen geänderten Python-Dateien.
20 geänderte HTML-/RSS-/Vereinsquellen wurden zusätzlich live ohne Produktionsschreibzugriff
erfolgreich gelesen. Dabei werden zehn Tanz-, sieben Gymnastik- und vier
Triathlonangebote erkannt, zuvor acht, vier und drei. Der neue RSS-Import erkennt
einen zusätzlichen künftigen Nikolausmarkt; die zwei bereits separat importierten
Gemeindetreffen werden nicht erneut aufgenommen. Der Produktionsstand wird nach
Veröffentlichung ergänzt.
