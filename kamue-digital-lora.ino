#include <RadioLib.h>
#include <TinyGPS++.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "secrets.h"

// ============================================================================
// HELTEC ESP32 LORA V4 / WIRELESS TRACKER PINOUT & HARDWARE DEFINITIONS
// ============================================================================
// Core Power Rails & Controls
#define VEXT_PIN        36   // Active LOW: Powers Display & Peripherals
#define GNSS_PWR_PIN    3    // Core Power Rail for GNSS (V1.1/V4)
#define GNSS_EN_V4      34   // Active LOW: L76K GNSS Power Enable on Heltec V4
#define GNSS_RST_PIN    5    // Hardware Reset for GNSS (V1.1)
#define GNSS_RST_V4     42   // Hardware Reset for L76K GNSS (Heltec V4)
#define GNSS_WAKE_V4    40   // Standby/Wake Pin for L76K GNSS (Heltec V4)
#define OLED_RST        21   // OLED Reset Pin
#define I2C_SDA         17   
#define I2C_SCL         18   

#define BAT_ADC_PIN     1    // Battery Voltage Divider ADC
#define BAT_CTRL_PIN    37   // Active LOW: Battery Measurement Enable
#define BOARD_LED       35   // Onboard LED Pin

#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64

// SX1262 LoRa Radio Pins & SPI Mapping for Heltec V1.1 / V4
#define SPI_SCK         9
#define SPI_MISO        11
#define SPI_MOSI        10
#define LORA_CS         8
#define LORA_DIO1       14
#define LORA_RST        12
#define LORA_BUSY       13

// GNSS Serial Pins (Quectel L76K default: 9600 baud | UC6580: 115200 baud)
#define GPS_RX          38   // ESP32 RX38 <- Quectel L76K TX (Heltec V4 default)
#define GPS_TX          39   // ESP32 TX39 -> Quectel L76K RX (Heltec V4 default)
#define GPS_BAUD        9600 // Quectel L76K Factory Default Baud Rate

#define DEVICE_NAME     "TRACKER-V4-L76K"
#define FIRMWARE_VER    "1.2.0"
#define TX_INTERVAL_MS  30000 

// Set to true when a LoRaWAN gateway is nearby; set to false to pause LoRa transmissions
bool enableLoRaWAN = true; 

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
    case RADIOLIB_LORAWAN_NEW_SESSION:          return "NEW_SESSION (1: Joined TTN successfully)";
    case -1101:                                 return "NETWORK_NOT_JOINED (-1101: activateOTAA not called or session lost)";
    case RADIOLIB_ERR_JOIN_NONCE_INVALID:       return "JOIN_NONCE_INVALID (-1111: JoinNonce not higher than saved value)";
    case RADIOLIB_ERR_NO_JOIN_ACCEPT:           return "NO_JOIN_ACCEPT (-1116: No Join Accept frame received from gateway)";
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
  Serial.println(F("  HELTEC LORA V4 / WIRELESS TRACKER (QUECTEL L76K GNSS) DIAGNOSTIC LOG"));
  Serial.println(F("================================================================================"));
  Serial.print(F("[SYS_BOOT] Firmware Version : ")); Serial.println(FIRMWARE_VER);
  Serial.print(F("[SYS_BOOT] Build Date/Time  : ")); Serial.print(__DATE__); Serial.print(F(" ")); Serial.println(__TIME__);
  Serial.print(F("[SYS_BOOT] MCU Platform     : ESP32-S3 (Xtensa LX7 @ ")); Serial.print(ESP.getCpuFreqMHz()); Serial.println(F("MHz)"));
  Serial.print(F("[SYS_BOOT] Reset Reason     : ")); Serial.println(getResetReasonString());
  Serial.print(F("[SYS_BOOT] Free Heap Memory : ")); Serial.print(ESP.getFreeHeap()); Serial.println(F(" bytes"));
  Serial.print(F("[SYS_BOOT] LoRa Mode        : ")); Serial.println(enableLoRaWAN ? "ENABLED (OTAA Active)" : "PAUSED (No Gateway Nearby)");
  Serial.print(F("[SYS_BOOT] LoRa DevEUI      : ")); Serial.println(formatEUI64(devEUI));
  Serial.print(F("[SYS_BOOT] LoRa JoinEUI     : ")); Serial.println(formatEUI64(joinEUI));
  Serial.println(F("[SYS_BOOT] Pinouts System   : VEXT:36 | GNSS_PWR:3/34 | GNSS_RST:5/42 | OLED_RST:21"));
  Serial.println(F("[SYS_BOOT] Pinouts LoRa     : CS:8 | DIO1:14 | RST:12 | BUSY:13 | SCK:9 | MISO:11 | MOSI:10"));
  Serial.println(F("[SYS_BOOT] Pinouts GNSS     : RX:38 (or 33) | TX:39 (or 34) | Default Baud: 9600"));
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
  // 1. Check if GNSS serial line receives 0 bytes or 0 parsed sentences after 10 seconds of runtime
  if (millis() > 10000 && (rawGpsBytes <= 1 || sentencesParsed == 0) && !gnssWarningTriggered) {
    gnssWarningTriggered = true;
    Serial.println(F("[GNSS][WARN] 0 NMEA sentences parsed from UC6580 GNSS module on RX:33!"));
    Serial.println(F("[GNSS][WARN] Diagnostic check: Verify GPIO 3 (GNSS_PWR) is HIGH, GPIO 5 (GNSS_RST) is HIGH, and antenna has open sky view."));
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
  display.setCursor(0, 11);
  display.print("FIX: "); display.print(getGpsFixType());
  display.setCursor(80, 11);
  display.print("SAT: "); display.print(gps.satellites.value());

  if (gps.location.isValid()) {
    display.setCursor(0, 20);
    display.print("LAT: "); display.print(gps.location.lat(), 5);
    display.setCursor(0, 29);
    display.print("LNG: "); display.print(gps.location.lng(), 5);
    display.setCursor(0, 38);
    display.print("ALT: "); display.print(gps.altitude.isValid() ? String(gps.altitude.meters(), 1) + "m" : "---");
    display.setCursor(68, 38);
    display.print("SPD: "); display.print(gps.speed.isValid() ? String(gps.speed.kmph(), 1) + "k/h" : "0k/h");
  } else {
    display.setCursor(0, 23);
    display.print("SEARCHING SATELLITES...");
    display.setCursor(0, 33);
    display.print("HDOP: "); display.print(gps.hdop.isValid() ? String(gps.hdop.hdop(), 1) : "---");
    display.setCursor(68, 33);
    display.print("RX: "); display.print(rawGpsBytes);
  }

  display.drawLine(0, 47, 128, 47, SSD1306_WHITE);

  // --- LORAWAN & FOOTER STATUS ---
  display.setCursor(0, 49);
  display.print("TTN: ");
  display.print(isLoRaJoined ? "JOINED" : (radioReady ? "JOINING" : "OFF"));
  display.setCursor(72, 49);
  display.print("TX:"); display.print(packetsSent);
  display.print(" F:"); display.print(packetsFailed);

  display.setCursor(0, 57);
  display.print("ST: "); display.print(statusMsg);

  display.display();
}

// ============================================================================
// HARDWARE INITIALIZATION
// ============================================================================
void initGNSSHardware() {
  Serial.println(F("[GNSS][INIT] Powering Quectel L76K GNSS (VEXT:36 LOW, PWR:3 HIGH, EN:34 LOW, WAKE:40 HIGH)..."));

  // Power VEXT Rail (Active LOW) & GNSS Power Rails (Heltec V1.1 / V4)
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW);
  delay(50);

  pinMode(GNSS_PWR_PIN, OUTPUT);
  digitalWrite(GNSS_PWR_PIN, HIGH);

  pinMode(GNSS_EN_V4, OUTPUT);
  digitalWrite(GNSS_EN_V4, LOW);  // Active LOW power enable for L76K on V4

  pinMode(GNSS_WAKE_V4, OUTPUT);
  digitalWrite(GNSS_WAKE_V4, HIGH); // Force L76K awake
  delay(100);

  // Active-LOW Reset Pulse for GNSS Pin 5 / Pin 42
  pinMode(GNSS_RST_PIN, OUTPUT);
  digitalWrite(GNSS_RST_PIN, HIGH);
  pinMode(GNSS_RST_V4, OUTPUT);
  digitalWrite(GNSS_RST_V4, HIGH);
  delay(10);
  digitalWrite(GNSS_RST_PIN, LOW);   
  digitalWrite(GNSS_RST_V4, LOW);   // Active reset state
  delay(150);
  digitalWrite(GNSS_RST_PIN, HIGH);  
  digitalWrite(GNSS_RST_V4, HIGH);  // Release reset line
  delay(1000);

  // Hardware Serial 1 for Quectel L76K GNSS (Default: 9600 baud, RX:38, TX:39)
  gpsSerial.setRxBufferSize(2048);
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
  Serial.println(F("[GNSS][INIT] Hardware Serial 1 initialized at 9600 baud on RX:38, TX:39 (Quectel L76K Default)."));
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

// Helper function to calculate exponential backoff interval for LoRaWAN OTAA Join retries
unsigned long getJoinBackoffIntervalMs(uint32_t attempts) {
  if (attempts <= 1) return 10000;   // 10 sec
  if (attempts == 2) return 30000;   // 30 sec
  if (attempts == 3) return 60000;   // 1 min
  if (attempts == 4) return 120000;  // 2 min
  return 300000;                     // 5 min (prevents TTN rate limiting & duty cycle exhaustion)
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  // 1. GNSS Auto-Probing: Cycle baud rates, RX/TX pins & enable levels whenever 0 valid NMEA sentences are parsed
  static uint8_t probeIndex = 0;
  static unsigned long lastProbeTime = 0;
  
  if (millis() > 5000 && sentencesParsed == 0 && (millis() - lastProbeTime > 5000)) {
    lastProbeTime = millis();
    // Config 1: L76K Default (9600 Baud, RX:38, TX:39, EN:LOW)
    // Config 2: L76K EN HIGH  (9600 Baud, RX:38, TX:39, EN:HIGH)
    // Config 3: L76K Pinout   (9600 Baud, RX:33, TX:34, EN:LOW)
    // Config 4: UC6580        (115200 Baud, RX:33, TX:34, EN:LOW)
    // Config 5: Swapped 39/38 (9600 Baud, RX:39, TX:38, EN:LOW)
    // Config 6: Swapped 34/33 (9600 Baud, RX:34, TX:33, EN:LOW)
    // Config 7: Alt Header    (9600 Baud, RX:44, TX:43, EN:LOW)
    // Config 8: Alt Header    (9600 Baud, RX:17, TX:18, EN:LOW)
    uint32_t probeBauds[] = { 9600, 9600, 9600, 115200, 9600, 9600, 9600, 9600 };
    int probeRX[]         = { 38,   38,   33,   33,     39,   34,   44,   17 };
    int probeTX[]         = { 39,   39,   34,   34,     38,   33,   43,   18 };
    int probeEnState[]    = { LOW,  HIGH, LOW,  LOW,    LOW,  LOW,  LOW,  LOW };

    probeIndex = (probeIndex + 1) % (sizeof(probeBauds) / sizeof(probeBauds[0]));

    Serial.print(F("[GNSS][AUTO_PROBE] No valid NMEA sentences parsed yet (RxBytes: "));
    Serial.print(rawGpsBytes);
    Serial.print(F("). Probing configuration #"));
    Serial.print(probeIndex + 1);
    Serial.print(F(": Baud="));
    Serial.print(probeBauds[probeIndex]);
    Serial.print(F(" | RX:"));
    Serial.print(probeRX[probeIndex]);
    Serial.print(F(" | TX:"));
    Serial.print(probeTX[probeIndex]);
    Serial.print(F(" | EN(34):"));
    Serial.println(probeEnState[probeIndex] == LOW ? "LOW" : "HIGH");

    // End previous serial session to release pins from UART matrix before modifying GPIO modes
    gpsSerial.end();
    delay(50);

    // Re-assert GPIO OUTPUT modes on power enable and wake pins
    pinMode(GNSS_EN_V4, OUTPUT);
    pinMode(GNSS_PWR_PIN, OUTPUT);
    pinMode(VEXT_PIN, OUTPUT);
    pinMode(GNSS_WAKE_V4, OUTPUT);

    // Drive power enable pins according to probe configuration
    digitalWrite(GNSS_EN_V4, probeEnState[probeIndex]);
    digitalWrite(GNSS_PWR_PIN, HIGH);
    digitalWrite(VEXT_PIN, LOW);
    digitalWrite(GNSS_WAKE_V4, HIGH);
    delay(150);

    // Electrical line diagnostic: sample Candidate RX Pin voltage state (UART idle = 3.3V HIGH)
    pinMode(probeRX[probeIndex], INPUT);
    delay(5);
    int rxVoltageState = digitalRead(probeRX[probeIndex]);
    Serial.print(F("[GNSS][PIN_DIAG] RX GPIO"));
    Serial.print(probeRX[probeIndex]);
    if (rxVoltageState == HIGH) {
      Serial.println(F(" level: HIGH (3.3V) [Signal active/powered]"));
    } else {
      Serial.println(F(" level: LOW (0V) [No active 3.3V UART signal - Check VCC, GND, or TX-RX swap]"));
    }

    gpsSerial.setRxBufferSize(2048);
    gpsSerial.begin(probeBauds[probeIndex], SERIAL_8N1, probeRX[probeIndex], probeTX[probeIndex]);
    delay(50);

    // Transmit Quectel L76K PMTK Wakeup & Test commands over TX line to wake chip from standby
    gpsSerial.println(F("$PMTK000*32"));    // PMTK TEST Command
    gpsSerial.println(F("$PMTK225,0*2B"));  // Force Exit Standby/Backup Mode
  }

  // Process incoming NMEA stream from Quectel L76K / UC6580 GNSS module
  static bool previousFixState = false;
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    rawGpsBytes++;

    // Print raw bytes to Serial with hex formatting for binary noise verification
    if (rawGpsBytes <= 200) {
      if (c >= 32 && c <= 126) {
        Serial.print(c);
      } else if (c == '\r' || c == '\n') {
        Serial.print(c);
      } else {
        Serial.print(F("[0x"));
        if ((uint8_t)c < 16) Serial.print(F("0"));
        Serial.print((uint8_t)c, HEX);
        Serial.print(F("]"));
      }
      if (rawGpsBytes == 200) Serial.println(F("\n[GNSS][STREAM] Raw NMEA stream buffer monitoring complete."));
    }

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

  // 2. Attempt LoRaWAN OTAA Join if enabled & gateway present
  if (enableLoRaWAN) {
    static unsigned long lastJoinAttempt = 0;
    unsigned long currentJoinInterval = getJoinBackoffIntervalMs(joinAttempts);

    if (radioReady && !isLoRaJoined && (millis() - lastJoinAttempt > currentJoinInterval || lastJoinAttempt == 0)) {
      lastJoinAttempt = millis();
      joinAttempts++;
      updateDisplay("JOINING TTN...", true);
      
      Serial.print(F("[EVENT][LORA] Attempting LoRaWAN OTAA Join #"));
      Serial.print(joinAttempts);
      Serial.print(F(" (DevEUI: "));
      Serial.print(formatEUI64(devEUI));
      Serial.print(F(" | Retry in "));
      Serial.print(currentJoinInterval / 1000);
      Serial.println(F("s)..."));

      radio.setTCXO(1.6);
      radio.setDio2AsRfSwitch(true);

      node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
      int joinState = node.activateOTAA();
      lastRadioErr = joinState;
      if (joinState == RADIOLIB_LORAWAN_NEW_SESSION || joinState == RADIOLIB_ERR_NONE || joinState > 0) {
        isLoRaJoined = true;
        Serial.println(F("[EVENT][LORA] OTAA Join SUCCESS! Network joined on TTN."));
        updateDisplay("TTN JOINED!", false);
      } else {
        isLoRaJoined = false;
        Serial.print(F("[EVENT][LORA] OTAA Join FAILED. Error: "));
        Serial.println(getRadioLibErrorStr(joinState));
        updateDisplay("JOIN ERR: " + String(joinState), false);
      }
    }
  }

  // 3. Refresh OLED Display with adaptive intervals
  static unsigned long lastUI = 0;
  unsigned long uiRefreshInterval = (isSearchingGPS || !isLoRaJoined) ? 250 : 1000;

  if (millis() - lastUI > uiRefreshInterval) {
    lastUI = millis();
    String st;
    if (!enableLoRaWAN) {
      st = isSearchingGPS ? "SEARCHING GPS" : "LOCK OK";
    } else {
      st = isLoRaJoined ? (isSearchingGPS ? "SEARCHING GPS" : "LOCK OK") : (radioReady ? "WAITING JOIN" : "RADIO ERR");
    }
    updateDisplay(st, isSearchingGPS || (!isLoRaJoined && enableLoRaWAN));
  }

  // 4. Log full diagnostics to PC Serial Monitor every 2 seconds & check warnings
  static unsigned long lastSerialLog = 0;
  if (millis() - lastSerialLog > 2000) {
    lastSerialLog = millis();
    printSerialDiagnostics();
    checkSystemWarnings();
  }

  // 5. Transmit Telemetry over TTN (if enabled & joined)
  if (enableLoRaWAN && isLoRaJoined) {
    static unsigned long lastTX = 0;
    if (millis() - lastTX > TX_INTERVAL_MS) {
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
        if (state == -1101 || state == RADIOLIB_ERR_NETWORK_NOT_JOINED) {
          isLoRaJoined = false; // Force re-join on next iteration
        }
        Serial.print(F("[EVENT][LORA] TX Uplink FAILED! Error: "));
        Serial.println(getRadioLibErrorStr(state));
        updateDisplay("TX ERR: " + String(state), false);
      }
    }
  }
}

