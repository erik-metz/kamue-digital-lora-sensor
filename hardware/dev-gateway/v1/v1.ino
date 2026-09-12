/*
 * Heltec WiFi LoRa 32 V4.3 - Single Channel LoRaWAN Gateway (EU868)
 * With OLED status display
 *
 * Libraries (Library Manager):
 *   - RadioLib          by Jan Gromes
 *   - ArduinoJson       by Benoit Blanchon
 *   - Heltec ESP32      (provides HT_SSD1306Wire)  OR  U8g2 / Adafruit SSD1306
 *
 * Board: Heltec WiFi LoRa 32(V3)  or  ESP32S3 Dev Module
 * USB CDC On Boot: Enabled
 */

 #include <Arduino.h>
 #include <WiFi.h>
 #include <WiFiUdp.h>
 #include <RadioLib.h>
 #include <ArduinoJson.h>
 #include <Wire.h>
 #include "secrets.h"
 
 // ---------- OLED (Heltec V3/V4) ----------
 #define OLED_SDA   17
 #define OLED_SCL   18
 #define OLED_RST   21
 #define VEXT_PIN   36          // active LOW
 
 // Prefer Heltec library if installed
 #if __has_include("HT_SSD1306Wire.h")
   #include "HT_SSD1306Wire.h"
   SSD1306Wire display(0x3c, 500000, OLED_SDA, OLED_SCL, GEOMETRY_128_64, OLED_RST);
   #define USE_HELTEC_OLED
 #else
   // Fallback: simple text-only via Wire (you can replace with Adafruit/U8g2 later)
   #define USE_SIMPLE_OLED
 #endif
 
 // ---------- LoRa pins (Heltec V4) ----------
 #define LORA_CS     8
 #define LORA_SCK    9
 #define LORA_MOSI  10
 #define LORA_MISO  11
 #define LORA_RST   12
 #define LORA_BUSY  13
 #define LORA_DIO1  14
 
 // V4.3 FEM (KCT8103L)
 #define FEM_POWER   7
 #define FEM_CSD     2
 #define FEM_CTX     5          // LOW = LNA enabled
 
 SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);
 WiFiUDP udp;
 
 uint8_t gatewayEui[8];
 uint32_t token = 0;
 volatile bool packetReceived = false;
 
 uint32_t rxCount = 0;
 int16_t  lastRssi = 0;
 float    lastSnr  = 0;
 String   statusLine = "Booting...";
 
 // ===================== Helpers =====================
 void generateGatewayEui() {
   if (strlen(GATEWAY_EUI) == 16) {
     for (int i = 0; i < 8; i++) {
       char buf[3] = {GATEWAY_EUI[i*2], GATEWAY_EUI[i*2+1], 0};
       gatewayEui[i] = strtol(buf, NULL, 16);
     }
   } else {
     uint8_t mac[6];
     WiFi.macAddress(mac);
     gatewayEui[0] = mac[0];
     gatewayEui[1] = mac[1];
     gatewayEui[2] = mac[2];
     gatewayEui[3] = 0xFF;
     gatewayEui[4] = 0xFF;
     gatewayEui[5] = mac[3];
     gatewayEui[6] = mac[4];
     gatewayEui[7] = mac[5];
   }
 }
 
 void initFEM() {
   pinMode(FEM_POWER, OUTPUT);
   pinMode(FEM_CSD, OUTPUT);
   pinMode(FEM_CTX, OUTPUT);
   digitalWrite(FEM_POWER, HIGH);
   delay(5);
   digitalWrite(FEM_CSD, HIGH);
   digitalWrite(FEM_CTX, LOW);      // LNA on
   delay(5);
 }
 
 void setRxMode()  { digitalWrite(FEM_CTX, LOW);  }
 void setTxMode()  { digitalWrite(FEM_CTX, HIGH); }
 
 void setFlag(void) { packetReceived = true; }
 
 // ---------- OLED ----------
 void oledInit() {
   pinMode(VEXT_PIN, OUTPUT);
   digitalWrite(VEXT_PIN, LOW);     // power on
   delay(50);
 
 #ifdef USE_HELTEC_OLED
   display.init();
   display.flipScreenVertically();
   display.setFont(ArialMT_Plain_10);
   display.clear();
   display.display();
 #endif
 }
 
 void oledUpdate() {
 #ifdef USE_HELTEC_OLED
   display.clear();
   display.setTextAlignment(TEXT_ALIGN_LEFT);
 
   display.drawString(0, 0, "SC-GW EU868 SF" + String(LORA_SF));
   display.drawString(0, 12, "IP: " + WiFi.localIP().toString());
 
   char euiStr[20];
   sprintf(euiStr, "%02X%02X%02X%02X%02X%02X%02X%02X",
           gatewayEui[0], gatewayEui[1], gatewayEui[2], gatewayEui[3],
           gatewayEui[4], gatewayEui[5], gatewayEui[6], gatewayEui[7]);
   display.drawString(0, 24, euiStr);
 
   display.drawString(0, 36, "RX: " + String(rxCount) + "  RSSI:" + String(lastRssi));
   display.drawString(0, 48, statusLine);
 
   display.display();
 #endif
 }
 
 // ===================== Packet Forwarder =====================
 void sendPushData(uint8_t* payload, size_t len, int16_t rssi, float snr) {
   uint8_t buf[512];
   size_t idx = 0;
 
   buf[idx++] = 0x02;
   buf[idx++] = (token >> 8) & 0xFF;
   buf[idx++] = token & 0xFF;
   token++;
   buf[idx++] = 0x00;               // PUSH_DATA
   memcpy(&buf[idx], gatewayEui, 8);
   idx += 8;
 
   StaticJsonDocument<512> doc;
   JsonArray rxpk = doc.createNestedArray("rxpk");
   JsonObject pk = rxpk.createNestedObject();
 
   pk["tmst"] = micros();
   pk["chan"] = 0;
   pk["rfch"] = 0;
   pk["freq"] = LORA_FREQUENCY;
   pk["stat"] = 1;
   pk["modu"] = "LORA";
   pk["datr"] = "SF" + String(LORA_SF) + "BW125";
   pk["codr"] = "4/5";
   pk["rssi"] = rssi;
   pk["lsnr"] = snr;
   pk["size"] = len;
 
   // simple base64
   const char* b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
   String data = "";
   int i = 0;
   while (i < (int)len) {
     uint32_t a = i < len ? payload[i++] : 0;
     uint32_t b = i < len ? payload[i++] : 0;
     uint32_t c = i < len ? payload[i++] : 0;
     uint32_t t = (a << 16) | (b << 8) | c;
     data += b64[(t >> 18) & 63];
     data += b64[(t >> 12) & 63];
     data += (i > len + 1) ? '=' : b64[(t >> 6) & 63];
     data += (i > len)     ? '=' : b64[t & 63];
   }
   pk["data"] = data;
 
   String json;
   serializeJson(doc, json);
   memcpy(&buf[idx], json.c_str(), json.length());
   idx += json.length();
 
   if (udp.beginPacket(LNS_HOST, LNS_PORT)) {
     udp.write(buf, idx);
     udp.endPacket();
     statusLine = "Pushed " + String(len) + "B";
   } else {
     statusLine = "UDP fail";
   }
 }
 
 void sendPullData() {
   uint8_t buf[12];
   buf[0] = 0x02;
   buf[1] = (token >> 8) & 0xFF;
   buf[2] = token & 0xFF;
   token++;
   buf[3] = 0x02;                   // PULL_DATA
   memcpy(&buf[4], gatewayEui, 8);
   if (udp.beginPacket(LNS_HOST, LNS_PORT)) {
     udp.write(buf, 12);
     udp.endPacket();
   }
 }
 
 // ===================== Setup =====================
 void setup() {
   Serial.begin(115200);
   delay(1000);
   Serial.println("\n=== Heltec V4.3 SC Gateway EU868 ===");
 
   initFEM();
   oledInit();
   statusLine = "WiFi...";
   oledUpdate();
 
   WiFi.mode(WIFI_STA);
   WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
   int retries = 0;
   while (WiFi.status() != WL_CONNECTED && retries++ < 40) {
     delay(500);
     Serial.print(".");
   }
   Serial.println();
 
   if (WiFi.status() != WL_CONNECTED) {
     statusLine = "WiFi FAIL";
     oledUpdate();
     delay(3000);
     ESP.restart();
   }
 
   generateGatewayEui();
   udp.begin(1700);
 
   Serial.print("IP: "); Serial.println(WiFi.localIP());
   Serial.print("EUI: ");
   for (int i = 0; i < 8; i++) {
     if (gatewayEui[i] < 16) Serial.print("0");
     Serial.print(gatewayEui[i], HEX);
   }
   Serial.println();
 
   // Radio
   SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
 
   Serial.print("SX1262 init... ");
   int state = radio.begin(LORA_FREQUENCY);
   if (state != RADIOLIB_ERR_NONE) {
     Serial.printf("fail %d\n", state);
     statusLine = "Radio FAIL";
     oledUpdate();
     while (true) delay(1000);
   }
   Serial.println("OK");
 
   radio.setSpreadingFactor(LORA_SF);
   radio.setBandwidth(LORA_BW);
   radio.setCodingRate(LORA_CR);
   radio.setPreambleLength(LORA_PREAMBLE);
   radio.setSyncWord(LORA_SYNC_WORD);
   radio.setOutputPower(LORA_POWER);
   radio.setCRC(true);
   radio.setDio2AsRfSwitch(true);
 
   radio.setPacketReceivedAction(setFlag);
 
   setRxMode();
   state = radio.startReceive();
   if (state != RADIOLIB_ERR_NONE) {
     statusLine = "RX fail";
   } else {
     statusLine = "Listening";
   }
 
   oledUpdate();
 }
 
 // ===================== Loop =====================
 void loop() {
   static uint32_t lastPull = 0;
   static uint32_t lastOled = 0;
 
   if (millis() - lastPull > 30000) {
     sendPullData();
     lastPull = millis();
   }
 
   if (packetReceived) {
     packetReceived = false;
 
     uint8_t buffer[256];
     int len = radio.readData(buffer, sizeof(buffer));
 
     if (len > 0) {
       lastRssi = radio.getRSSI();
       lastSnr  = radio.getSNR();
       rxCount++;
 
       Serial.printf("RX %d B  RSSI=%d  SNR=%.1f\n", len, lastRssi, lastSnr);
       sendPushData(buffer, len, lastRssi, lastSnr);
     }
 
     setRxMode();
     radio.startReceive();
   }
 
   // basic downlink check
   int packetSize = udp.parsePacket();
   if (packetSize) {
     uint8_t buf[256];
     int n = udp.read(buf, sizeof(buf));
     if (n >= 4 && buf[3] == 0x03) {
       statusLine = "DL received";
       // full TX implementation can be added later
     }
   }
 
   if (millis() - lastOled > 2000) {
     oledUpdate();
     lastOled = millis();
   }
 
   delay(5);
 }