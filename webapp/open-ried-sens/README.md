# Open Ried Sens – Digitales Umweltsensornetzwerk Bürstadt & Lampertheim

**Open Ried Sens** ist eine private Initiative zur Digitalisierung der Städte **Bürstadt** und **Lampertheim** sowie der umliegenden Region des Hessischen Rieds. Das Projekt wird von engagierten Bürgerinnen und Bürgern in Kooperation mit dem **Kulturzentrum KAMÜ** in Bürstadt getragen.

---

## 📌 Projektkontext & Vision

Ziel der Initiative ist die Ausrichtung eines großen regionalen **Hackathons**. Um den Teilnehmerinnen und Teilnehmern des Hackathons eine fundierte Datenbasis zu bieten, benötigt die Region kontinuierliche, verlässliche und historische Umwelt- und Echtzeitdaten. Da solche digitalen Datensätze in den Städten Bürstadt und Lampertheim bislang nicht in ausreichendem Maße öffentlich zur Verfügung stehen, wurde dieses Multisensor-Projekt ins Leben gerufen.

---

## 🛰️ Phasengliederung

### Phase 1: Aufbau der ersten 5 Multisensor-Stationen (Aktuell)
In der ersten Phase werden **5 moderne Multisensor-Messstationen** auf privaten Grundstücken in Bürstadt, Lampertheim und Umgebung installiert. Diese Stationen erfassen rund um die Uhr relevante Umwelt- und Umfelddaten:

- 🌡️ **Temperatur & Luftfeuchtigkeit**
- 🌧️ **Niederschlag / Regenmenge**
- ☀️ **UV-Index & Sonneneinstrahlung**
- 💨 **Luftqualität (VOC & NOx Gase)**
- 🌫️ **Feinstaub (PM2.5 & PM10)**
- 🎙️ **Akustische Lärmklassifizierung** (Einsatz eines Mikrofons zur Klassifikation von Fahrzeuglärm, Passanten/Sprache, Wind- und Umweltgeräuschen)

### Phase 2: Aufbau der regionalen LoRaWAN-Infrastruktur
Da in der Region bislang keine flächendeckende LoRaWAN-Abdeckung existiert, umfasst das Projekt auch den schrittweisen **Aufbau von LoRaWAN-Gateways**, die an **The Things Network (TTN)** angebunden sind. Dadurch wird erstmals eine freie, energiesparsame IoT-Funkinfrastruktur für Bürger, Landwirtschaft und Umweltprojekte in Bürstadt und Lampertheim geschaffen.

### Phase 3: Mini-Hackathon mit Schulen (50–100 Sensorstationen)
Die gewonnenen Erfahrungen aus den ersten 5 Stationen dienen als Katalysator für einen **Mini-Hackathon in Zusammenarbeit mit lokalen Schulen** (z. B. der *Erich Kästner Schule* in Bürstadt). Schülerinnen und Schüler lernen dabei den Zusammenbau, die Programmierung und den Betrieb eigener LoRaWAN-Sensoren. Ziel ist die Ausweitung des Sensornetzes auf **50 bis 100 Messpunkte** in der gesamten Region.

### Phase 4: Der regionale Hackathon & Kommunale Einbindung
Nach einer mehrmonatigen Datenerfassungsphase steht der Haupt-Hackathon an. Mit den gesammelten historischen Daten können innovativste Anwendungen für Smart City, Umweltschutz, Lärmschutz und Bürgerdienste entwickelt werden. Parallel wird das Projekt in den politischen Gremien beider Städte vorgestellt, um öffentliche Förderungen und kommunale Mittel zur langfristigen Sicherung des Netzwerks einzuwerben.

---

## 🛠️ Technischer Stack der Web-Applikation

Die Web-Anwendung dient als zentrales Dashboard und Dokumentationsportal für das Netzwerk:

- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Kartendarstellung**: Leaflet & OpenStreetMap (Bürstadt / Lampertheim / Ried Region)
- **Funkstandard**: LoRaWAN OTAA über The Things Network (TTN)

---

## 🚀 Entwicklung & Start

```bash
# Abhängigkeiten installieren
npm install

# Entwicklungs-Server starten
npm run dev

# Production Build erstellen
npm run build
```

Öffne [http://localhost:3000](http://localhost:3000) im Browser.
