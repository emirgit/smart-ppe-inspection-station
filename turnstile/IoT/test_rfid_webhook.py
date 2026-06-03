import sys
import time
import os

# Prototip test betiğinde projeyi modül arama yoluna ekle
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.iot_core.hardware.rfid_http_server import HttpRfidReader

def run_test():
    print("========================================")
    print("🔵 RFID Webhook Sunucu Testi Başlıyor...")
    print("========================================")
    
    reader = HttpRfidReader()
    
    # 1. Sunucuyu başlat (0.0.0.0:8000)
    success = reader.init()
    if not success:
        print("❌ Sunucu başlatılamadı. Port 8000 kullanımda olabilir mi?")
        return
        
    print("✅ Webhook sunucusu 8000 portunda dinliyor.")
    print("👉 ESP32 üzerinden kart okutun VEYA başka bir terminalden şu komutu girin:")
    print("   curl -X POST http://localhost:8000/rfid -H \"Content-Type: application/json\" -d '{\"uid\":\"TEST_KART_123\"}'")
    print("----------------------------------------\n")
    
    # 2. Döngü içinde kart okumayı bekle
    try:
        for i in range(1, 6):  # 5 defa test edelim
            print(f"⏳ [{i}/5] Kart bekleniyor... (Timeout: 60 saniye)")
            
            # 60 saniye boyunca kuyrukta yeni bir UID bekler
            uid = reader.read_card(timeout_ms=60000)
            
            if uid:
                print(f"🎉 BAŞARILI! Okunan Kart UID'si: ➔ {uid}\n")
            else:
                print("⏱️ Zaman aşımı: 60 saniye içinde kart okutulmadı.\n")
                
    except KeyboardInterrupt:
        print("\n🛑 Test kullanıcı tarafından durduruldu (Ctrl+C).")
    
    print("========================================")
    print("🏁 Test tamamlandı.")
    print("========================================")

if __name__ == "__main__":
    run_test()