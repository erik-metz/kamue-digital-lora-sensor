# LoRaWAN GPS Tracker V1 (Heltec Wireless Tracker)

A high-performance, low-power LoRaWAN GPS tracking node built on the **Heltec Wireless Tracker V1.1** board (ESP32-S3 + Semtech SX1262 + Unicore UC6580 GNSS + 0.96" SSD1306 OLED Display).

This project captures high-accuracy satellite coordinates using the UC6580 GNSS receiver, encodes the position into an efficient binary payload, transmits telemetry over **The Things Network (TTN)** via LoRaWAN OTAA, and renders detailed real-time diagnostic information on the onboard OLED display.

---

## Table of Contents
- [Hardware Overview](#hardware-overview)
- [Hardware Pinout Matrix](#hardware-pinout-matrix)
- [Key Features & Firmware Architecture](#key-features--firmware-architecture)
- [The Things Network (TTN) Setup](#the-things-network-ttn-setup)
- [TTN Payload Decoder (JavaScript)](#ttn-payload-decoder-javascript)
- [Building & Flashing](#building--flashing)
- [Project Roadmap & Architecture Ideas](#project-roadmap--architecture-ideas)

---

## Hardware Overview

- **Main Board**: Heltec Wireless Tracker V1.1 (ESP32-S3 Dual-Core Xtensa LX7 @ 240MHz, 8MB Flash)
- **LoRa Transceiver**: Semtech SX1262 (EU868 / US915 / AU915, SPI, DIO2 RF Switch control, 1.8V TCXO)
- **GNSS Module**: Unicore UC6580 Dual-frequency (GPS / BDS / GLONASS / Galileo) connected via Hardware Serial
- **Display**: 0.96-inch OLED (SSD1306 I2C @ `0x3C`, 128x64 monochrome)
- **Power Management**: Onboard LiPo battery charger, active-low ADC voltage divider, and `VEXT` peripheral power switch line

---

## Hardware Pinout Matrix

| Peripheral Component | Function | ESP32-S3 GPIO Pin | Hardware Notes |
| :--- | :--- | :--- | :--- |
| **Power Control** | `VEXT_PIN` | `GPIO 36` | Active LOW: Powers OLED & peripherals |
| **GNSS Power** | `GNSS_PWR_PIN` | `GPIO 3` | Active HIGH: VCC rail for UC6580 |
| **GNSS Reset** | `GNSS_RST_PIN` | `GPIO 5` | Active LOW: Hardware reset line |
| **GNSS Serial RX** | `GPS_RX` | `GPIO 33` | ESP32 RX <- UC6580 TX (115200 baud) |
| **GNSS Serial TX** | `GPS_TX` | `GPIO 34` | ESP32 TX -> UC6580 RX |
| **LoRa CS** | `LORA_CS` | `GPIO 8` | SX1262 SPI Chip Select |
| **LoRa DIO1** | `LORA_DIO1` | `GPIO 14` | SX1262 Interrupt Line |
| **LoRa Reset** | `LORA_RST` | `GPIO 12` | SX1262 Hardware Reset |
| **LoRa BUSY** | `LORA_BUSY` | `GPIO 13` | SX1262 Busy State Line |
| **Display SDA** | `I2C_SDA` | `GPIO 17` | SSD1306 OLED I2C Data |
| **Display SCL** | `I2C_SCL` | `GPIO 18` | SSD1306 OLED I2C Clock |
| **Display Reset** | `OLED_RST` | `GPIO 21` | SSD1306 Reset Pin |
| **Battery ADC** | `BAT_ADC_PIN` | `GPIO 1` | Voltage Divider Analog Input |
| **Battery Control** | `BAT_CTRL_PIN` | `GPIO 37` | Active LOW: Measurement divider enable |
| **Status LED** | `BOARD_LED` | `GPIO 35` | Onboard User LED |

---

## Key Features & Firmware Architecture

1. **Non-blocking GNSS Streaming**: Continuously reads raw NMEA sentences from UC6580 via HardwareSerial 1 at 115200 baud using `TinyGPS++`.
2. **LoRaWAN OTAA Stack**: Powered by `RadioLib`, implementing proper 1.8V TCXO setup and DIO2 RF switch control required by the Heltec V1.1 hardware layout.
3. **Compact 8-Byte Binary Payload**:
   - Bytes 0-3: Latitude ($int32\_t = latitude \times 1,000,000$)
   - Bytes 4-7: Longitude ($int32\_t = longitude \times 1,000,000$)
4. **Rich Onboard OLED UI**:
   - Header bar with dynamic spinner icon, battery voltage (V), and battery percentage (%).
   - Satellite count, Fix status (`SEARCHING`, `2D FIX`, `3D FIX`), HDOP precision index, and RX byte counter.
   - TTN Join status, successful packet count (`TX`), failed packet count (`F`), and last RSSI (`dBm`).
   - Bottom status line showing real-time operations (`JOINING TTN`, `TX SUCCESS`, `TX ERR`, etc.).
5. **Adaptive UI Refresh Rate**: 250ms refresh when searching for GPS fix / joining TTN; 1000ms during normal tracking mode.

---

## The Things Network (TTN) Setup

1. Log into your **The Things Network Console** (e.g., EU1 / US1).
2. Create an Application and register an End Device using **OTAA (Over-The-Air Activation)**.
3. Set the LoRaWAN version to `MAC V1.0.3` or `MAC V1.0.4` with Regional Parameters `PHY V1.0.3 REV A`.
4. Copy your **DevEUI**, **JoinEUI** (AppEUI), and **AppKey** into [`lora-tracker.ino`](file:///Users/alpha/Github/lora/lora-gps-tracker-v1/lora-tracker.ino):

```cpp
uint64_t joinEUI = 0x0000000000000000;
uint64_t devEUI  = 0x70B3D57ED0078F16; 
uint8_t appKey[] = { 0x44, 0x40, ..., 0xAD };
uint8_t nwkKey[] = { 0x44, 0x40, ..., 0xAD };
```

---

## TTN Payload Decoder (JavaScript)

Paste this JavaScript payload formatter into **TTN Console -> Application -> Payload Formatters -> Uplink**:

```javascript
function decodeUplink(input) {
  var bytes = input.bytes;
  
  // Verify expected payload length (8 bytes)
  if (bytes.length < 8) {
    return {
      errors: ["Invalid payload length"]
    };
  }

  // Parse 32-bit signed integers (Big-Endian)
  var rawLat = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  var rawLng = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];

  var latitude = rawLat / 1000000.0;
  var longitude = rawLng / 1000000.0;

  return {
    data: {
      latitude: latitude,
      longitude: longitude,
      valid_fix: (rawLat !== 0 || rawLng !== 0)
    }
  };
}
```

---

## Building & Flashing

### Recommended Environment
- **Arduino IDE** (v2.x) or **PlatformIO** (VS Code)

### Required Libraries
1. `RadioLib` (by Jan Gromeš)
2. `TinyGPS++` (by Mikal Hart)
3. `Adafruit SSD1306` & `Adafruit GFX Library`

### Arduino IDE Board Settings
- **Board**: `Heltec Wireless Tracker` or `ESP32S3 Dev Module`
- **USB CDC On Boot**: `Enabled`
- **CPU Frequency**: `240MHz (WiFi/BT)`
- **Core Debug Level**: `None` or `Info`
- **Port**: Select the corresponding USB Serial Port (`/dev/tty.usbmodem...`)

---

## Project Roadmap & Architecture Ideas

Beyond the core tracking functionality in `lora-tracker.ino`, here is a comprehensive roadmap for expanding this project into a full-scale end-to-end IoT Tracking Solution:

### 1. Smart Power Management & Deep Sleep
- **ESP32 Deep Sleep Cycles**: Configure the ESP32-S3 to enter deep sleep between transmissions (e.g., every 30 seconds or 5 minutes).
- **GNSS Hot Start**: Keep GNSS VCC supplied or use UC6580 backup power line to retain satellite almanac/ephemeris data for rapid 1-2 second GPS fix upon waking up.
- **Motion-Based Adaptive Transmission**: Use the ESP32-S3 built-in sensors or an external accelerometer (e.g., MPU6050 or LIS3DH) to increase transmission frequency to every 10s when moving and sleep for 5–15 minutes when stationary.

### 2. Expanded Telemetry Payload (11-Byte Compact Encoding)
Optimize the binary payload format (e.g., using Cayenne LPP or a custom bitmask) to transmit additional telemetry without exceeding LoRaWAN Data Rate duty cycles:
- **Latitude & Longitude**: 8 bytes ($10^{-6}$ precision)
- **Altitude**: 2 bytes (signed integer in meters, range $-1000m$ to $+5000m$)
- **Battery Level & HDOP**: 1 byte (packed bitmask for voltage % and GPS accuracy)
- **Satellite Count & Speed**: 1 byte

### 3. Display UI Polish & Enhancements
- **Graphical Icons**: Add bitmap icons for Battery (charging, 25%, 50%, 75%, 100%), Satellite dish signal strength, and LoRa antenna status.
- **Multi-Screen Navigation**: Use the onboard PRG button (`GPIO 0`) to cycle through display pages:
  - *Page 1*: Live Tracking (Lat, Lng, Alt, Satellites)
  - *Page 2*: Network & Signal Quality (RSSI, SNR, Frame Counters, Gateway info)
  - *Page 3*: System Info & Battery Statistics (Voltage graph, uptime, memory)
- **Display Sleep Timeout**: Turn off OLED screen after 30 seconds of inactivity to maximize battery life.

### 4. Backend Cloud Architecture & Database
```
[Heltec Tracker] ---> (LoRaWAN) ---> [TTN Gateway / Cloud]
                                           |
                                      (HTTP Webhook)
                                           v
                                  [API Integration Server]
                                           |
                                           v
                                [Time-Series Database]
                                  (PostgreSQL / PostGIS)
                                           |
                                           v
                               [Web Dashboard & Map UI]
```
- **TTN Webhook Integration**: Configure TTN HTTP Integration to send uplink payloads to a custom REST API (Node.js/Express, Python FastAPI, or Go).
- **Database Storage**:
  - **PostgreSQL + PostGIS**: Store telemetry with geospatial extensions for spatial queries (geofencing, total distance calculations, speed alerts).
  - **InfluxDB / TimescaleDB**: Optimized for high-throughput time-series analytics.

### 5. Interactive Web Application Dashboard
- **Frontend Stack**: Built with Next.js / Vite, React, and TailwindCSS.
- **Mapping Engine**: **Leaflet.js**, **Mapbox GL**, or **Deck.gl** for rendering interactive maps.
- **Dashboard Features**:
  - Real-time tracker pin marker with live update socket (WebSocket / Server-Sent Events).
  - Breadcrumb trail path visualizing recent routes with color-coded speed indicators.
  - Interactive charts for Speed, Altitude, RSSI/SNR signal quality, and Battery drain over time.
  - Custom Geofencing boundaries with instant notifications (Telegram / Email / Web Push) when the tracker leaves designated safe zones.

### 6. Offline Data Logging & Buffering
- Use ESP32 SPIFFS / LittleFS flash storage to record GPS coordinates when out of LoRaWAN coverage area (e.g. inside tunnels or dead zones).
- Batch-transmit stored waypoints once LoRaWAN connection is re-established.
