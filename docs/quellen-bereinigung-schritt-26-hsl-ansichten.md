# Schritt 26: HSL-Tabellen in den Themenansichten

Die sechs HSL-Datensätze werden bereits vom Registry-Worker veröffentlicht.
Demografie, Wirtschaft, Haushalt, Bauen/Wohnen und Umwelt verwenden die
amtliche Tabellenansicht bereits. Auf `/statistik` fehlte `statistics/social`.
Dieser Datensatz wird jetzt parallel zu den bestehenden Angeboten geladen und
zusätzlich angezeigt. Die Titel benennen Straßenverkehrsunfälle und kommunales
Personal; daraus werden keine Gesundheits-, Recycling- oder Sozialindikatoren
abgeleitet. Veranstaltungen und andere vorhandene Bereiche bleiben erhalten.

Die gemeinsame Tabellenansicht enthält keine fest eingetragenen Jahreszahlen,
Stichtage oder aus unvollständigen Feldern berechneten regionalen Summen mehr.
Bezugszeiträume und Einheiten werden aus den Originaltiteln und Kennzahlen
angezeigt. Amtliche Fehlwertzeichen bleiben in Einzelansicht und Vergleich
sichtbar; ein echter Nullwert bleibt 0. Veröffentlichung und Bezugszeitraum
werden ausdrücklich unterschieden.

Prüfung: zwei Render-Regressionstests (Einzelansicht und vier Kommunen,
Fehlwertzeichen, Nullwerte, abweichende Bezugsjahre), sechs Regionaltests,
ESLint ohne Warnungen für die geänderten Komponenten und Next.js-Produktionsbuild.
Reine Frontendänderung; keine VPS-Änderung oder GHCR-Veröffentlichung erforderlich.
Die öffentlich ausgelieferte Frontendversion ist damit noch nicht separat nachgewiesen.
