#include <RadioLib.h>
#include <TinyGPS++.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "secrets.h"

// ============================================================================
// HELTEC WIRELESS TRACKER V1.1 PINOUT & HARDWARE DEFINITIONS
// ============================================================================
#define VEXT_PIN        36   // Active LOW: Powers OLED Display & Peripherals
#define GNSS_PWR_PIN    3    // Active HIGH: Core Power Rail for UC6580 GNSS (V1.1)
#define GNSS_RST_PIN    5    // Active LOW: Hardware Reset for UC6580 GNSS
#define OLED_RST        21   // OLED Reset Pin
#define I2C_SDA         17   
#define I2C_SCL         18   

#define BAT_ADC_PIN     1    // Battery Voltage Divider ADC
#define BAT_CTRL_PIN    37   // Active LOW: Battery Measurement Enable
#define BOARD_LED       35   // Onboard LED Pin

#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64

// SX1262 LoRa Radio Pins & SPI Mapping for Heltec V1.1
#define SPI_SCK         9
#define SPI_MISO        11
#define SPI_MOSI        10
#define LORA_CS         8
#define LORA_DIO1       14
#define LORA_RST        12
#define LORA_BUSY       13

// UC6580 GNSS Serial Pins
#define GPS_RX          33   // ESP32 RX33 <- UC6580 TX
#define GPS_TX          34   // ESP32 TX34 -> UC6580 RX
#define GPS_BAUD        115200

#define DEVICE_NAME     "TRACKER-V1.1"
#define FIRMWARE_VER    "1.1.0"
#define TX_INTERVAL_MS  30000 

// ============================================================================
// GLOBAL OBJECTS & STATE
// ============================================================================
SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RST);
HardwareSerial gpsSerial(1);
TinyGPSPlus gps;

// LoRaWAN Node
LoRaWANNode node(&radio, &EU868);

// Telemetry & Diagnostics Counters
uint32_t packetsSent = 0;
uint32_t packetsFailed = 0;
uint32_t joinAttempts = 0;
uint32_t rawGpsBytes = 0;
uint32_t sentencesParsed = 0;
float lastRSSI = 0.0;
float lastSNR = 0.0;
int lastRadioErr = 0;
float lastBatAdcMv = 0.0;
bool radioReady = false;
bool isLoRaJoined = false;
bool gnssWarningTriggered = false;

// 1-Character UX Spinner
const char spinnerChars[] = {'|', '/', '-', '\\'};
uint8_t spinnerIdx = 0;

// ============================================================================
// AI DIAGNOSTIC HELPER FUNCTIONS
// ============================================================================
String getResetReasonString() {
  esp_reset_reason_t reason = esp_reset_reason();
  switch (reason) {
    case ESP_RST_POWERON:   return "POWERON (Normal power-on reset)";
    case ESP_RST_EXT:       return "EXT (Reset from external pin)";
    case ESP_RST_SW:        return "SW (Software reset via esp_restart)";
    case ESP_RST_PANIC:     return "PANIC (Software reset due to exception/panic)";
    case ESP_RST_INT_WDT:   return "INT_WDT (Interrupt watchdog reset)";
    case ESP_RST_TASK_WDT:  return "TASK_WDT (Task watchdog reset)";
    case ESP_RST_WDT:       return "WDT (Other watchdog reset)";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP (Reset after exiting deep sleep)";
    case ESP_RST_BROWNOUT:  return "BROWNOUT (Low voltage brownout reset!)";
    case ESP_RST_SDIO:      return "SDIO (Reset over SDIO)";
    default:                return "UNKNOWN (" + String(reason) + ")";
  }
}

String getRadioLibErrorStr(int err) {
  switch (err) {
    case RADIOLIB_ERR_NONE:                     return "NONE (0: Success)";
    case RADIOLIB_ERR_UNKNOWN:                  return "UNKNOWN (-1)";
    case RADIOLIB_ERR_CHIP_NOT_FOUND:           return "CHIP_NOT_FOUND (-2: Check SPI pins CS/SCK/MISO/MOSI & hardware power)";
    case RADIOLIB_ERR_PACKET_TOO_LONG:          return "PACKET_TOO_LONG (-3)";
    case RADIOLIB_ERR_TX_TIMEOUT:               return "TX_TIMEOUT (-5: Transmit timed out)";
    case RADIOLIB_ERR_RX_TIMEOUT:               return "RX_TIMEOUT (-6: Receive timed out / No response)";
    case RADIOLIB_ERR_CRC_MISMATCH:             return "CRC_MISMATCH (-7)";
    case RADIOLIB_ERR_INVALID_BANDWIDTH:        return "INVALID_BW (-8)";
    case RADIOLIB_ERR_INVALID_SPREADING_FACTOR: return "INVALID_SF (-9)";
    case RADIOLIB_ERR_INVALID_CODING_RATE:      return "INVALID_CR (-10)";
    case RADIOLIB_ERR_JOIN_NONCE_FULL:          return "JOIN_NONCE_FULL (-1107: DevNonce limit reached)";
    case RADIOLIB_ERR_NO_JOIN_ACCEPT:           return "NO_JOIN_ACCEPT (-1108: No Join Accept frame received from gateway)";
    default:                                    return "ERR_CODE (" + String(err) + ")";
  }
}

String formatEUI64(uint64_t eui) {
  char buf[20];
  snprintf(buf, sizeof(buf), "%08X%08X", (uint32_t)(eui >> 32), (uint32_t)(eui & 0xFFFFFFFF));
  return String(buf);
}

void printStartupBanner() {
  Serial.println(F("\n================================================================================"));
  Serial.println(F("  HELTEC WIRELESS TRACKER V1.1 - AI-OPTIMIZED DIAGNOSTIC SYSTEM LOG"));
  Serial.println(F("================================================================================"));
  Serial.print(F("[SYS_BOOT] Firmware Version : ")); Serial.println(FIRMWARE_VER);
  Serial.print(F("[SYS_BOOT] Build Date/Time  : ")); Serial.print(__DATE__); Serial.print(F(" ")); Serial.println(__TIME__);
  Serial.print(F("[SYS_BOOT] MCU Platform     : ESP32-S3 (Xtensa LX7 @ ")); Serial.print(ESP.getCpuFreqMHz()); Serial.println(F("MHz)"));
  Serial.print(F("[SYS_BOOT] Reset Reason     : ")); Serial.println(getResetReasonString());
  Serial.print(F("[SYS_BOOT] Free Heap Memory : ")); Serial.print(ESP.getFreeHeap()); Serial.println(F(" bytes"));
  Serial.print(F("[SYS_BOOT] LoRa DevEUI      : ")); Serial.println(formatEUI64(devEUI));
  Serial.print(F("[SYS_BOOT] LoRa JoinEUI     : ")); Serial.println(formatEUI64(joinEUI));
  Serial.println(F("[SYS_BOOT] Pinouts System   : VEXT:36 | GNSS_PWR:3 | GNSS_RST:5 | OLED_RST:21"));
  Serial.println(F("[SYS_BOOT] Pinouts LoRa     : CS:8 | DIO1:14 | RST:12 | BUSY:13 | SCK:9 | MISO:11 | MOSI:10"));
  Serial.println(F("[SYS_BOOT] Pinouts GNSS     : RX:33 | TX:34 | Baud:115200"));
  Serial.println(F("[SYS_BOOT] Pinouts Battery  : ADC:1 | CTRL:37 (Scaling 4.9x)"));
  Serial.println(F("================================================================================\n"));
}

// ============================================================================
// BATTERY MEASUREMENT
// ============================================================================
float readBatteryVoltage() {
  pinMode(BAT_CTRL_PIN, OUTPUT);
  digitalWrite(BAT_CTRL_PIN, HIGH); // Active HIGH: Enable measurement divider circuit on Heltec V1.1
  delay(10); // Stabilization delay
  
  uint32_t totalMv = 0;
  const int samples = 10;
  for (int i = 0; i < samples; i++) {
    totalMv += analogReadMilliVolts(BAT_ADC_PIN);
    delay(2);
  }
  lastBatAdcMv = (float)totalMv / samples;
  
  digitalWrite(BAT_CTRL_PIN, LOW); // Disable divider circuit to conserve battery
  
  // Heltec Wireless Tracker voltage divider scaling factor (4.9x)
  return (lastBatAdcMv * 4.9f) / 1000.0f;
}

int getBatteryPercentage(float v) {
  if (v >= 4.18f) return 100;
  if (v <= 3.30f) return 0;
  
  int pct = 0;
  if (v >= 4.00f) {
    pct = 90 + (int)((v - 4.00f) / 0.18f * 10.0f);
  } else if (v >= 3.90f) {
    pct = 75 + (int)((v - 3.90f) / 0.10f * 15.0f);
  } else if (v >= 3.80f) {
    pct = 55 + (int)((v - 3.80f) / 0.10f * 20.0f);
  } else if (v >= 3.70f) {
    pct = 35 + (int)((v - 3.70f) / 0.10f * 20.0f);
  } else if (v >= 3.50f) {
    pct = 15 + (int)((v - 3.50f) / 0.20f * 20.0f);
  } else {
    pct = (int)((v - 3.30f) / 0.20f * 15.0f);
  }
  
  if (pct > 100) return 100;
  if (pct < 0) return 0;
  return pct;
}

// ============================================================================
// DISPLAY & DIAGNOSTICS
// ============================================================================
String getGpsFixType() {
  if (!gps.location.isValid()) return "SEARCHING";
  if (gps.satellites.value() >= 4) return "3D FIX";
  return "2D FIX";
}

void printSerialDiagnostics() {
  float batVolts = readBatteryVoltage();
  int batPct = getBatteryPercentage(batVolts);
  
  Serial.print(F("[DIAG][UPTIME: "));
  Serial.print(millis() / 1000);
  Serial.print(F("s] Heap: "));
  Serial.print(ESP.getFreeHeap());
  Serial.print(F("B | Bat: "));
  Serial.print(batVolts, 2);
  Serial.print(F("V ("));
  Serial.print(batPct);
  Serial.print(F("%, ADC: "));
  Serial.print((int)lastBatAdcMv);
  Serial.print(F("mV) | GNSS: "));
  Serial.print(getGpsFixType());
  Serial.print(F(" (Sats: "));
  Serial.print(gps.satellites.value());
  Serial.print(F(", HDOP: "));
  Serial.print(gps.hdop.isValid() ? String(gps.hdop.hdop(), 1) : "N/A");
  
  if (gps.location.isValid()) {
    Serial.print(F(", Lat: "));
    Serial.print(gps.location.lat(), 5);
    Serial.print(F(", Lng: "));
    Serial.print(gps.location.lng(), 5);
  }
  
  Serial.print(F(", RxBytes: "));
  Serial.print(rawGpsBytes);
  Serial.print(F(", Parsed: "));
  Serial.print(sentencesParsed);
  Serial.print(F(", ErrChksum: "));
  Serial.print(gps.failedChecksum());
  
  Serial.print(F(") | LoRa: "));
  Serial.print(isLoRaJoined ? "JOINED" : (radioReady ? "JOINING" : "RADIO_ERR"));
  Serial.print(F(" (Ready: "));
  Serial.print(radioReady ? "YES" : "NO");
  Serial.print(F(", Joins: "));
  Serial.print(joinAttempts);
  Serial.print(F(", TxOK: "));
  Serial.print(packetsSent);
  Serial.print(F(", TxFail: "));
  Serial.print(packetsFailed);
  Serial.print(F(", LastErr: "));
  Serial.print(getRadioLibErrorStr(lastRadioErr));
  Serial.print(F(", RSSI: "));
  Serial.print(lastRSSI, 1);
  Serial.print(F("dBm, SNR: "));
  Serial.print(lastSNR, 1);
  Serial.println(F("dB)"));
}

void checkSystemWarnings() {
  // 1. Check if GNSS serial line receives 0 bytes after 10 seconds of runtime
  if (millis() > 10000 && rawGpsBytes == 0 && !gnssWarningTriggered) {
    gnssWarningTriggered = true;
    Serial.println(F("[GNSS][WARN] 0 bytes received from UC6580 GNSS module on RX:33!"));
    Serial.println(F("[GNSS][WARN] Diagnostic check: Verify GPIO 3 (GNSS_PWR) is HIGH, GPIO 5 (GNSS_RST) is HIGH, and TX/RX lines are connected."));
  }
  
  // 2. Warn on high NMEA checksum errors
  if (gps.failedChecksum() > 5) {
    Serial.print(F("[GNSS][WARN] NMEA Checksum Errors detected: "));
    Serial.print(gps.failedChecksum());
    Serial.println(F(". Check baud rate (115200) or serial wiring noise."));
  }

  // 3. Warn on low battery
  float batV = readBatteryVoltage();
  if (batV < 3.30f && batV > 1.0f) { // Ignore near 0V when running purely on USB without battery connected
    Serial.print(F("[BAT][WARN] Low battery voltage detected: "));
    Serial.print(batV, 2);
    Serial.println(F("V (<3.30V threshold)! Charge battery to avoid brownout reset."));
  }
}

void updateDisplay(String statusMsg, bool isLoading = false) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  float batVolts = readBatteryVoltage();
  int batPct = getBatteryPercentage(batVolts);

  // --- HEADER ROW (Includes Compact 1-Char Spinner & Battery Status) ---
  display.setCursor(0, 0);
  display.print("TRACKER");
  
  String batStr = String(batVolts, 1) + "V " + String(batPct) + "%";
  if (batVolts >= 4.18f) {
    batStr += " CHG";
  }
  
  int totalHeaderRightLen = batStr.length() + (isLoading ? 1 : 0);
  int startX = 128 - (totalHeaderRightLen * 6);
  if (startX < 46) startX = 46;
  
  display.setCursor(startX, 0);
  if (isLoading) {
    display.print(spinnerChars[spinnerIdx]);
    spinnerIdx = (spinnerIdx + 1) % 4;
  }
  display.print(batStr);
  
  display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

  // --- GNSS TELEMETRY ---
  display.setCursor(0, 12);
  display.print("FIX: "); display.print(getGpsFixType());
  display.setCursor(80, 12);
  display.print("SAT:"); display.print(gps.satellites.value());

  display.setCursor(0, 22);
  display.print("HDOP:");
  display.print(gps.hdop.isValid() ? String(gps.hdop.hdop(), 1) : "---");
  display.setCursor(65, 22);
  display.print("RX B:"); display.print(rawGpsBytes);

  display.drawLine(0, 31, 128, 31, SSD1306_WHITE);

  // --- LORAWAN TELEMETRY ---
  display.setCursor(0, 34);
  display.print("TTN: ");
  display.print(isLoRaJoined ? "JOINED" : (radioReady ? "JOINING..." : "RADIO ERR"));

  display.setCursor(0, 44);
  display.print("TX:"); display.print(packetsSent);
  display.print(" F:"); display.print(packetsFailed);
  display.setCursor(68, 44);
  display.print("RSSI:"); display.print((int)lastRSSI);

  display.drawLine(0, 53, 128, 53, SSD1306_WHITE);

  // --- FOOTER STATUS BAR ---
  display.setCursor(0, 56);
  display.print("ST: "); display.print(statusMsg);

  display.display();
}

// ============================================================================
// HARDWARE INITIALIZATION
// ============================================================================
void initGNSSHardware() {
  Serial.println(F("[GNSS][INIT] Powering rail (GPIO 3 HIGH) & toggling reset (GPIO 5)..."));

  // Power GNSS VCC Rail (GPIO 3 Active HIGH on Heltec V1.1)
  pinMode(GNSS_PWR_PIN, OUTPUT);
  digitalWrite(GNSS_PWR_PIN, HIGH);
  delay(100);

  // Active-LOW Reset Pulse for UC6580 Pin 5
  pinMode(GNSS_RST_PIN, OUTPUT);
  digitalWrite(GNSS_RST_PIN, HIGH);
  delay(10);
  digitalWrite(GNSS_RST_PIN, LOW);   // Active reset state
  delay(100);
  digitalWrite(GNSS_RST_PIN, HIGH);  // Release reset line
  delay(500);

  // Hardware Serial 1 for UC6580 GNSS
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println(F("[GNSS][INIT] Hardware Serial 1 initialized at 115200 baud on RX:33, TX:34."));
}

void initRadioHardware() {
  Serial.println(F("[LORA][INIT] Initializing SPI bus (SCK:9, MISO:11, MOSI:10, CS:8)..."));
  
  // Explicitly initialize SPI with Heltec Wireless Tracker pin mapping
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, LORA_CS);

  Serial.println(F("[LORA][INIT] Initializing SX1262 transceiver..."));
  int state = radio.begin();
  if (state == RADIOLIB_ERR_NONE) {
    // Heltec V1.1 TCXO on DIO3 (1.6V / 1.8V) and RF Switch mapping on DIO2
    radio.setTCXO(1.6);
    radio.setDio2AsRfSwitch(true);
    
    radioReady = true;
    Serial.println(F("[LORA][INIT] SX1262 Transceiver Initialized Successfully (TCXO 1.6V & DIO2 RF Switch Enabled)."));
  } else {
    lastRadioErr = state;
    Serial.print(F("[LORA][ERR] SX1262 Init Failed with code: "));
    Serial.println(getRadioLibErrorStr(state));
  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  printStartupBanner();

  pinMode(BOARD_LED, OUTPUT);
  digitalWrite(BOARD_LED, LOW);

  // Enable VEXT Power Rail (Active LOW)
  Serial.println(F("[SYS][INIT] Enabling VEXT power rail (GPIO 36 LOW)..."));
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW); 

  // Reset Display Hardware
  Serial.println(F("[SYS][INIT] Resetting SSD1306 display (GPIO 21)..."));
  pinMode(OLED_RST, OUTPUT);
  digitalWrite(OLED_RST, LOW);
  delay(20);
  digitalWrite(OLED_RST, HIGH);
  delay(50);

  Wire.begin(I2C_SDA, I2C_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[SYS][ERR] SSD1306 OLED Display Initialization Failed! Check I2C SDA:17 / SCL:18 & VEXT power line."));
    for(;;);
  }
  Serial.println(F("[SYS][INIT] SSD1306 OLED Display Initialized Successfully on I2C 0x3C."));

  updateDisplay("BOOTING...", true);

  // Initialize Transceivers
  initGNSSHardware();
  initRadioHardware();
  
  Serial.println(F("[SYS][INIT] Setup complete. Entering main loop...\n"));
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  // 1. Process incoming NMEA stream from UC6580 GNSS module
  static bool previousFixState = false;
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    rawGpsBytes++;
    if (gps.encode(c)) {
      sentencesParsed++;
    }
  }

  bool isSearchingGPS = !gps.location.isValid();
  
  // Log GNSS fix state transition
  if (gps.location.isValid() && !previousFixState) {
    previousFixState = true;
    Serial.print(F("[EVENT][GNSS] Location Fix Acquired! Lat: "));
    Serial.print(gps.location.lat(), 6);
    Serial.print(F(" | Lng: "));
    Serial.print(gps.location.lng(), 6);
    Serial.print(F(" | Alt: "));
    Serial.print(gps.altitude.meters(), 1);
    Serial.print(F("m | Sats: "));
    Serial.print(gps.satellites.value());
    Serial.print(F(" | HDOP: "));
    Serial.println(gps.hdop.hdop(), 1);
  } else if (!gps.location.isValid() && previousFixState) {
    previousFixState = false;
    Serial.println(F("[EVENT][GNSS] Location Fix Lost. Re-searching satellites..."));
  }

  // 2. Attempt LoRaWAN OTAA Join if Radio is ready but not joined
  static unsigned long lastJoinAttempt = 0;
  if (radioReady && !isLoRaJoined && (millis() - lastJoinAttempt > 20000 || lastJoinAttempt == 0)) {
    lastJoinAttempt = millis();
    joinAttempts++;
    updateDisplay("JOINING TTN...", true);
    
    Serial.print(F("[EVENT][LORA] Attempting LoRaWAN OTAA Join #"));
    Serial.print(joinAttempts);
    Serial.print(F(" (DevEUI: "));
    Serial.print(formatEUI64(devEUI));
    Serial.println(F(")..."));

    radio.setTCXO(1.6);
    radio.setDio2AsRfSwitch(true);

    int joinState = node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
    lastRadioErr = joinState;
    if (joinState == RADIOLIB_ERR_NONE) {
      isLoRaJoined = true;
      Serial.println(F("[EVENT][LORA] OTAA Join SUCCESS! Network joined on TTN."));
      updateDisplay("TTN JOINED!", false);
    } else {
      Serial.print(F("[EVENT][LORA] OTAA Join FAILED. Error: "));
      Serial.println(getRadioLibErrorStr(joinState));
      updateDisplay("JOIN ERR: " + String(joinState), false);
    }
  }

  // 3. Refresh OLED Display with adaptive intervals
  static unsigned long lastUI = 0;
  unsigned long uiRefreshInterval = (isSearchingGPS || !isLoRaJoined) ? 250 : 1000;

  if (millis() - lastUI > uiRefreshInterval) {
    lastUI = millis();
    String st = isLoRaJoined ? (isSearchingGPS ? "SEARCHING GPS" : "LOCK OK") : (radioReady ? "WAITING JOIN" : "RADIO ERR");
    updateDisplay(st, isSearchingGPS || !isLoRaJoined);
  }

  // 4. Log full diagnostics to PC Serial Monitor every 2 seconds & check warnings
  static unsigned long lastSerialLog = 0;
  if (millis() - lastSerialLog > 2000) {
    lastSerialLog = millis();
    printSerialDiagnostics();
    checkSystemWarnings();
  }

  // 5. Transmit Telemetry over TTN
  static unsigned long lastTX = 0;
  if (isLoRaJoined && (millis() - lastTX > TX_INTERVAL_MS)) {
    lastTX = millis();
    updateDisplay("TX SENDING...", true);

    Serial.println(F("[EVENT][LORA] Constructing 8-byte telemetry payload & initiating TX..."));
    radio.setDio2AsRfSwitch(true);

    uint8_t payload[8];
    if (gps.location.isValid()) {
      int32_t lat_int = gps.location.lat() * 1000000;
      int32_t lng_int = gps.location.lng() * 1000000;
      payload[0] = lat_int >> 24; 
      payload[1] = lat_int >> 16;
      payload[2] = lat_int >> 8;  
      payload[3] = lat_int;
      payload[4] = lng_int >> 24; 
      payload[5] = lng_int >> 16;
      payload[6] = lng_int >> 8;  
      payload[7] = lng_int;
      Serial.print(F("[EVENT][LORA] Payload coordinates: Lat="));
      Serial.print(gps.location.lat(), 6);
      Serial.print(F(" Lng="));
      Serial.println(gps.location.lng(), 6);
    } else {
      memset(payload, 0x00, sizeof(payload));
      Serial.println(F("[EVENT][LORA] Payload coordinates: [0,0] (No GPS fix)"));
    }

    int state = node.sendReceive(payload, sizeof(payload), 1);
    lastRadioErr = state;

    if (state == RADIOLIB_ERR_NONE) {
      packetsSent++;
      lastRSSI = radio.getRSSI();
      lastSNR = radio.getSNR();
      Serial.print(F("[EVENT][LORA] TX Uplink SUCCESS! RSSI: "));
      Serial.print(lastRSSI, 1);
      Serial.print(F(" dBm | SNR: "));
      Serial.print(lastSNR, 1);
      Serial.println(F(" dB"));
      updateDisplay("TX SUCCESS", false);
    } else {
      packetsFailed++;
      Serial.print(F("[EVENT][LORA] TX Uplink FAILED! Error: "));
      Serial.println(getRadioLibErrorStr(state));
      updateDisplay("TX ERR: " + String(state), false);
    }
  }
}

