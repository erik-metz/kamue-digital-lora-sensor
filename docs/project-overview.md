# Open Ried Sens – Projektübersicht & Architektur

## 1. Zusammenfassung & Vision

**Open Ried Sens** ist eine von Bürgerinnen und Bürgern getragene Initiative, die vom [Kulturzentrum KAMÜ](https://kamue.me) unterstützt wird. Das Hauptziel ist der Aufbau eines verlässlichen Umwelt-Sensornetzwerks in den Städten **Bürstadt** und **Lampertheim** sowie der umliegenden Region des Hessischen Rieds. Die Initiative stellt freie Umweltdaten bereit, um regionale Innovationen zu fördern und die Datenbasis für einen großen regionalen Hackathon zu liefern.

---

## 2. Roadmap & Projektphasen

- **Phase 1: Aufbau der ersten 5 Messstationen (Aktuell)**
  Installation von 5 Präzisions-Multisensor-Stationen auf privaten Grundstücken.
  - _Erfasste Parameter:_ Temperatur, Luftfeuchtigkeit, Niederschlag, UV-Index, Luftqualität (VOC/NOx), Feinstaub (PM2.5/PM10) und akustische Lärmklassifizierung [Fahrzeuge, Sprache, Umweltgeräusche].
- **Phase 2: Ausbau der LoRaWAN-Infrastruktur**
  Aufbau von Gateways mit Anbindung an [The Things Network (TTN)](https://www.thethingsindustries.com), um eine freie IoT-Funkinfrastruktur für die Region zu garantieren.
- **Phase 3: Mini-Hackathons mit Schulen (50–100 Sensoren)**
  Zusammenarbeit mit lokalen Schulen, bei der Schülerinnen und Schüler eigene Sensoren bauen und programmieren, um das Netzwerk auf bis zu 100 Messpunkte zu skalieren.
- **Phase 4: Regionaler Hackathon & Kommunale Einbindung**
  Nutzung der gesammelten historischen Daten im Rahmen eines großen Hackathons für Smart-City-Anwendungen, Lärmschutz und Bürgerdienste.

---

## 3. Technische Gesamtarchitektur

[ Sensor-Knoten (v1, v2, v3) ]
│ (LoRaWAN / HTTP)
▼
[ DuckDNS Domain / Nginx Proxy ] (AWS EC2)
│
┌────────┴────────┐
▼ ▼
[ FastAPI ] [ Certbot / Watchtower ]
│
▼
[ TimescaleDB ]
▲
│ (REST API)
[ Next.js Webapp ] (Vercel)

### Subsysteme

- **Hardware-Knoten (`/hardware`)**: ESP/Arduino-basierte Sensoren mit eigener Firmware (`.ino`) aufgeteilt nach Hardware-Versionen (v1, v2, v3).

* **VPS-Dienste (`/www/vps/`)**: Gehostet auf einer AWS EC2 Instanz hinter einer DuckDNS-Adresse.
  - **Nginx**: Reverse Proxy und TLS-Verschlüsselung.
  - **Certbot**: Automatische SSL-Zertifikatsverwaltung via Let's Encrypt.
  - **FastAPI**: Erfassung und Bereitstellung der Sensordaten.
  - **TimescaleDB**: Für Zeitreihen optimierte Datenbank zur Langzeitspeicherung.
  - **Watchtower**: Automatische Aktualisierung der Docker-Container.
* **Frontend-Anwendung (`/www/open-ried-sens/`)**: Next.js (App Router, React 19, Tailwind CSS v4, Leaflet), gehostet auf Vercel.
