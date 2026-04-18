#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// ==========================================
// CONFIGURATION
// ==========================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Raspberry Pi'nin IP adresi ve dinleyeceği port (Python kodunda 8000 olarak ayarlandı)
const char* serverUrl = "http://192.168.1.100:8000/rfid"; 

// ESP32 RC522 SPI Pinleri (Varsayılan HSPI pinlerine göre)
#define SS_PIN  5   // SDA (SS) Pini
#define RST_PIN 27  // Reset Pini

MFRC522 rfid(SS_PIN, RST_PIN);

unsigned long lastReadTime = 0;
const unsigned long DEBOUNCE_DELAY = 2000; // Aynı kartın 2 saniye boyunca tekrar okunmasını engeller

void setup() {
    Serial.begin(115200);
    while (!Serial);

    // SPI ve RC522 Başlatma
    SPI.begin();
    rfid.PCD_Init();
    Serial.println("RFID Reader Initialized.");

    // WiFi Bağlantısı
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nConnected to WiFi!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
}

void loop() {
    // WiFi koptuysa yeniden bağlanma (Robustness)
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi lost. Reconnecting...");
        WiFi.disconnect();
        WiFi.reconnect();
        delay(3000);
        return;
    }

    // Yeni kart yoksa veya kart okunamadıysa döngü başına dön
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
        delay(50);
        return;
    }

    // Debounce: Kart okumayı yavaşlat (Spam engellemek için)
    if (millis() - lastReadTime < DEBOUNCE_DELAY) {
        rfid.PICC_HaltA();
        rfid.PCD_StopCrypto1();
        return;
    }

    // Kart okundu! UID formatını HEX string'e dönüştür
    String uidStr = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
        uidStr += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
        uidStr += String(rfid.uid.uidByte[i], HEX);
    }
    uidStr.toUpperCase();
    Serial.println("Card Tapped: " + uidStr);

    // Raspberry Pi'ye Webhook (HTTP POST) Fırlat
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\"uid\":\"" + uidStr + "\"}";
    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
        Serial.printf("-> RPi Response: %d\n", httpResponseCode);
    } else {
        Serial.printf("-> Error connecting to RPi: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();

    // Okuma zamanını güncelle ve RFID modülünü uyut
    lastReadTime = millis();
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
}
