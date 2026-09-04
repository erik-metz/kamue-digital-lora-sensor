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
#define GNSS_PWR_PIN    3    // Active HIGH: Core Power Rail for UC6580 GNSS
#define GNSS_RST_PIN    5    // Active LOW: Hardware Reset for UC6580 GNSS
#define OLED_RST        21   // OLED Reset Pin
#define I2C_SDA         17   
#define I2C_SCL         18   

#define BAT_ADC_PIN     1    // Battery Voltage Divider ADC
#define BAT_CTRL_PIN    37   // Active LOW: Battery Measurement Enable
#define BOARD_LED       35   // Onboard LED Pin

#define SCREEN_WIDTH    128
#define SCREEN_HEIGHT   64

// SX1262 LoRa Radio Pins
#define LORA_CS         8
#define LORA_DIO1       14
#define LORA_RST        12
#define LORA_BUSY       13

// UC6580 GNSS Serial Pins
#define GPS_RX          33   // ESP32 RX33 <- UC6580 TX
#define GPS_TX          34   // ESP32 TX34 -> UC6580 RX
#define GPS_BAUD        115200

#define DEVICE_NAME     "TRACKER-V1.1"
#define TX_INTERVAL_MS  15000 

// ============================================================================
// GLOBAL OBJECTS & STATE
// ============================================================================
SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RST);
HardwareSerial gpsSerial(1);
TinyGPSPlus gps;

LoRaWANNode node(&radio, &EU868);

// Telemetry & Diagnostics Counters
uint32_t packetsSent = 0;
uint32_t packetsFailed = 0;
uint32_t rawGpsBytes = 0;
uint32_t sentencesParsed = 0;
float lastRSSI = 0.0;
float lastSNR = 0.0;
int lastRadioErr = 0;
bool radioReady = false;
bool isLoRaJoined = false;

// 1-Character UX Spinner
const char spinnerChars[] = {'|', '/', '-', '\\'};
uint8_t spinnerIdx = 0;

// ============================================================================
// BATTERY MEASUREMENT
// ============================================================================
float readBatteryVoltage() {
  pinMode(BAT_CTRL_PIN, OUTPUT);
  digitalWrite(BAT_CTRL_PIN, LOW); // Enable measurement divider
  delay(5);
  
  uint32_t rawADC = 0;
  for (int i = 0; i < 10; i++) {
    rawADC += analogRead(BAT_ADC_PIN);
    delay(2);
  }
  rawADC /= 10;
  
  digitalWrite(BAT_CTRL_PIN, HIGH); // Disable divider to conserve power
  return (rawADC / 4095.0) * 3.3 * 4.9;
}

int getBatteryPercentage(float v) {
  if (v >= 4.15) return 100;
  if (v >= 4.00) return 90;
  if (v >= 3.90) return 75;
  if (v >= 3.80) return 55;
  if (v >= 3.70) return 35;
  if (v >= 3.50) return 15;
  if (v >= 3.30) return 5;
  return 0;
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
  Serial.print("[GNSS] State: ");
  Serial.print(getGpsFixType());
  Serial.print(" | Sats: ");
  Serial.print(gps.satellites.value());
  Serial.print(" | HDOP: ");
  Serial.print(gps.hdop.isValid() ? String(gps.hdop.hdop(), 1) : "N/A");
  Serial.print(" | RX Bytes: ");
  Serial.print(rawGpsBytes);
  Serial.print(" | Parsed NMEA: ");
  Serial.print(sentencesParsed);
  
  Serial.print(" || [LoRaWAN] Joined: ");
  Serial.print(isLoRaJoined ? "YES" : "NO");
  Serial.print(" | TX OK: ");
  Serial.print(packetsSent);
  Serial.print(" | TX Fail: ");
  Serial.print(packetsFailed);
  Serial.print(" | Last Err: ");
  Serial.print(lastRadioErr);
  Serial.print(" | RSSI: ");
  Serial.print(lastRSSI);
  Serial.print(" dBm | SNR: ");
  Serial.print(lastSNR);
  Serial.println(" dB");
}

void updateDisplay(String statusMsg, bool isLoading = false) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  float batVolts = readBatteryVoltage();
  int batPct = getBatteryPercentage(batVolts);

  // --- HEADER ROW (Includes Compact 1-Char Spinner) ---
  display.setCursor(0, 0);
  display.print(DEVICE_NAME);
  
  display.setCursor(62, 0);
  if (isLoading) {
    display.print(spinnerChars[spinnerIdx]);
    spinnerIdx = (spinnerIdx + 1) % 4;
  } else {
    display.print(" ");
  }
  display.print(String(batVolts, 1) + "V " + String(batPct) + "%");
  
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
  display.print(isLoRaJoined ? "JOINED" : "JOINING...");

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
  Serial.println("[GNSS] Powering rail & resetting UC6580...");

  // Power GNSS VCC Rail (GPIO 3)
  pinMode(GNSS_PWR_PIN, OUTPUT);
  digitalWrite(GNSS_PWR_PIN, HIGH);
  delay(100);

  // Proper Active-LOW Reset Pulse for UC6580 Pin 5
  pinMode(GNSS_RST_PIN, OUTPUT);
  digitalWrite(GNSS_RST_PIN, HIGH);
  delay(10);
  digitalWrite(GNSS_RST_PIN, LOW);   // Active reset state
  delay(100);
  digitalWrite(GNSS_RST_PIN, HIGH);  // Release reset line
  delay(500);

  // Hardware Serial 1 for UC6580 GNSS
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX, GPS_TX);
}

void initRadioHardware() {
  Serial.println("[Radio] Initializing SX1262 for Heltec V1.1...");
  
  int state = radio.begin();
  if (state == RADIOLIB_ERR_NONE) {
    // Heltec V1.1 TCXO on DIO3 and RF Switch mapping on DIO2
    radio.setTCXO(1.8);
    radio.setDio2AsRfSwitch(true);
    
    radioReady = true;
    Serial.println("[Radio] SX1262 Transceiver Ready.");
  } else {
    lastRadioErr = state;
    Serial.print("[Radio] SX1262 Init Failed, code: ");
    Serial.println(state);
  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BOARD_LED, OUTPUT);
  digitalWrite(BOARD_LED, LOW);

  // Enable VEXT Power Rail
  pinMode(VEXT_PIN, OUTPUT);
  digitalWrite(VEXT_PIN, LOW); 

  // Reset Display Hardware
  pinMode(OLED_RST, OUTPUT);
  digitalWrite(OLED_RST, LOW);
  delay(20);
  digitalWrite(OLED_RST, HIGH);
  delay(50);

  Wire.begin(I2C_SDA, I2C_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("Display Fail");
    for(;;);
  }

  updateDisplay("BOOTING...", true);

  // Initialize Transceivers
  initGNSSHardware();
  initRadioHardware();
}

// ============================================================================
// MAIN LOOP
// ============================================================================
void loop() {
  // 1. Process incoming NMEA stream from UC6580 GNSS module
  while (gpsSerial.available() > 0) {
    char c = gpsSerial.read();
    rawGpsBytes++;
    if (gps.encode(c)) {
      sentencesParsed++;
    }
  }

  bool isSearchingGPS = !gps.location.isValid();

  // 2. Attempt LoRaWAN OTAA Join if Radio is ready but not joined
  static unsigned long lastJoinAttempt = 0;
  if (radioReady && !isLoRaJoined && (millis() - lastJoinAttempt > 20000 || lastJoinAttempt == 0)) {
    lastJoinAttempt = millis();
    updateDisplay("JOINING TTN...", true);

    radio.setTCXO(1.8);
    radio.setDio2AsRfSwitch(true);

    int joinState = node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
    lastRadioErr = joinState;
    if (joinState == RADIOLIB_ERR_NONE) {
      isLoRaJoined = true;
      updateDisplay("TTN JOINED!", false);
    } else {
      updateDisplay("JOIN ERR: " + String(joinState), false);
    }
  }

  // 3. Refresh OLED Display with adaptive intervals
  static unsigned long lastUI = 0;
  unsigned long uiRefreshInterval = (isSearchingGPS || !isLoRaJoined) ? 250 : 1000;

  if (millis() - lastUI > uiRefreshInterval) {
    lastUI = millis();
    String st = isLoRaJoined ? (isSearchingGPS ? "SEARCHING GPS" : "LOCK OK") : "WAITING JOIN";
    updateDisplay(st, isSearchingGPS || !isLoRaJoined);
  }

  // 4. Log full diagnostics to PC Serial Monitor every 2 seconds
  static unsigned long lastSerialLog = 0;
  if (millis() - lastSerialLog > 2000) {
    lastSerialLog = millis();
    printSerialDiagnostics();
  }

  // 5. Transmit Telemetry over TTN
  static unsigned long lastTX = 0;
  if (isLoRaJoined && (millis() - lastTX > TX_INTERVAL_MS)) {
    lastTX = millis();
    updateDisplay("TX SENDING...", true);

    // Re-assert RF Switch configuration to eliminate -1101 timeouts
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
    } else {
      memset(payload, 0x00, sizeof(payload));
    }

    // Explicitly send on FPort 1
    int state = node.sendReceive(payload, sizeof(payload), 1);
    lastRadioErr = state;

    if (state == RADIOLIB_ERR_NONE) {
      packetsSent++;
      lastRSSI = radio.getRSSI();
      lastSNR = radio.getSNR();
      updateDisplay("TX SUCCESS", false);
    } else {
      packetsFailed++;
      updateDisplay("TX ERR: " + String(state), false);
    }
  }
}