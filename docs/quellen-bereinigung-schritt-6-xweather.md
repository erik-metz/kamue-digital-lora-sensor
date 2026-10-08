# Schritt 6: Vaisala Xweather als Blitzdatenquelle

Xweather wird separat als `environment-xweather` ausgewiesen. Aktivierung über
`ENABLE_XWEATHER`, `XWEATHER_CLIENT_ID` und `XWEATHER_CLIENT_SECRET`; Zugangsdaten
gehören ausschließlich in die geschützte VPS-Konfiguration. Für den bisherigen
Blitzortung-Zugang wird `ENABLE_BLITZORTUNG=false` gesetzt.

Der Collector fragt ein explizites UTC-Fünf-Minuten-Fenster im bestehenden
25-km-Radius um 49.6425/8.4552 ab. Eine bestätigte leere Antwort erzeugt eine
Nullmessung und einen erfolgreichen Verarbeitungsnachweis. API-Fehler, unbekannte
Warnungen, ungültige Ereignisse und Antworten am 1000-Einträge-Limit werden
abgewiesen, damit unvollständige Daten nicht als vollständige Zählung erscheinen.
Es werden Blitzimpulse (Wolken- und Erdblitze) gezählt, nicht eindeutig getrennte
Blitzentladungen. Stromstärken werden von Ampere in kA umgerechnet. Quellen-ID,
Anbieter und tatsächlicher Fünf-Minuten-Zeitraum werden im Messkern gespeichert.

Die HTTP-URL im öffentlichen Quellenstatus enthält keine Zugangsdaten.
HTTPX-Request-Logging wird beim authentifizierten Abruf unterdrückt; eventuell
vom Anbieter zurückgespiegelte Zugangsdaten werden vor der Archivierung entfernt.
Keine Zugangsdaten sind Bestandteil dieses Repositories.

Lokaler Testzugang: HTTP 200, success=true, warn_no_data für einen gültigen
regionalen Abruf. Das belegt Zugang, aber noch keine produktive Speicherung.
Produktionsnachweis und CI-Ergebnis werden nach Veröffentlichung ergänzt.
