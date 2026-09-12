# Open Ried Sens – Bill of Materials (BOM) v1

Stückliste und Kostenaufstellung für eine Einzelstation der Sensor-Hardware (Version v1).

---

## 📊 Komponenten & Kostenübersicht

| Bauteil / Modell             | Beschreibung / Funktion                             | Kosten (Anteilig pro Station) |
| :--------------------------- | :-------------------------------------------------- | :---------------------------- |
| **SHT41**                    | Temperatur, Luftfeuchtigkeit                        | 3,06 €                        |
| **SCD41**                    | CO₂-Sensor                                          | 3,94 €                        |
| **ICS43434**                 | Mikrofon (Klassifizierung Auto, Mensch, Regen, ...) | 1,86 €                        |
| **SPS30**                    | Feinstaub (PM2.5 / PM10)                            | 13,93 €                       |
| **BME688**                   | Organische Verbindungen (VOC) + Luftdruck           | 9,56 €                        |
| **SGP41**                    | Organische Verbindungen (VOC) + Stickoxide (NOx)    | 4,88 €                        |
| **RG-11**                    | Niederschlag / Regenmenge                           | 0,95 €                        |
| **LTR390**                   | UV-Index                                            | 4,79 €                        |
| **INA226**                   | Stromverbrauchsmessung                              | 1,57 €                        |
| **USB-C Anschluss**          | Stromversorgung Buchse                              | 1,11 €                        |
| **USB-Kabel (10m)**          | Stromversorgung Zuleitung                           | 10,00 €                       |
| **Waveshare Core1262-868M**  | LoRaWAN-Modul (Funk)                                | 9,99 €                        |
| **TX868-BLG-26**             | LoRaWAN-Antenne                                     | 16,99 €                       |
| **SMA F to RF-1F**           | Antennenkabel                                       | 2,04 €                        |
| **ESP-32-S3 N16R8**          | Mikrocontroller                                     | 6,20 €                        |
| **GESAMTKOSTEN PRO STATION** |                                                     | **90,86 €**                   |

---

## 📝 Hinweise zu den Komponenten

- **Kommunikation**: Die Station nutzt das **Waveshare Core1262-868M** LoRaWAN-Modul in Verbindung mit der **TX868-BLG-26** Antenne zur Datenübertragung an _The Things Network (TTN)_.
- **Akustische Lärmanalyse**: Das **ICS43434** I²S-Mikrofon ermöglicht die lokale On-Device-Klassifizierung von Umweltgeräuschen (Fahrzeuge, Passanten, Wind).
- **Versorgung**: Der Betrieb erfolgt über ein 10m USB-Kabel mit **INA226** Chip zur Überwachung des Systemstromverbrauchs.

---

**Open Ried Sens** – Eine private Bürgerinitiative mit dem Kulturzentrum **KAMÜ** in Bürstadt.
[Dashboard](https://open-ried-sens.vercel.app/) • [API Data Portal](https://open-ried-sens.vercel.app/daten)
