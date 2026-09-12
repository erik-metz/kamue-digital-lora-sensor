# Open Ried Sens – Monorepo

[![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)](https://fastapi.tiangolo.com/)
[![TimescaleDB](https://img.shields.io/badge/Database-TimescaleDB-yellow)](https://www.timescale.com/)
[![LoRaWAN](https://img.shields.io/badge/IoT-LoRaWAN_/_TTN-blue)](https://www.thethingsnetwork.org/)

Digitales Umweltsensornetzwerk für **Bürstadt**, **Lampertheim** und das **Hessische Ried**. Dieses Repository enthält den gesamten Quellcode der Web-Applikation, die Backend-Infrastruktur, Firmware, Hardware-Baupläne und die Dokumentation des **Open Ried Sens** Projekts.

---

## 🚀 Schnellstart

### 1. Web Frontend (`/www/open-ried-sens`)

Das Web-Dashboard dient zur Visualisierung der Messwerte auf einer interaktiven Karte.

cd www/open-ried-sens
npm install
npm run dev

### 2. Backend Stack (`/www/vps`)

Der Backend-Service läuft via Docker Compose auf einer AWS EC2 Instanz unter einer DuckDNS-Domain.

cd www/vps
docker-compose up -d --build

---

## 📖 Dokumentation & Open Data API

- **Projektübersicht & Architektur**: Siehe [`docs/project-overview.md`](docs/project-overview.md).
- **Open Data API Schnittstelle**: Unter [`docs/api/open-data.md`](docs/api/) erfährst du, wie du auf die Rohdaten unseres VPS-Endpoints zugreifen kannst.
- **Hardware & Baupläne**: Detaillierte Bauanleitungen, Stücklisten (BOM) und CAD/STL-Dateien findest du unter [`hardware/`](hardware/).

---

## 🤝 Mitmachen & Community

Dieses Projekt wird ehrenamtlich betrieben und vom [Kulturzentrum KAMÜ](https://kamue.me) unterstützt. Beiträge zur Software, Hardware oder den Datenanalysen sind herzlich willkommen!

- **Lizenz**: Open-Source / Creative Commons (Hardware & Daten)
