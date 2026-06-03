"""
Integration tests for HttpBackendClient against the live backend server.
Requires an active internet connection.
"""
import pytest
import time
import os
import requests
from src.iot_core.api_clients.http_backend_client import HttpBackendClient
from src.iot_core.models import EntryLog, AccessDecision, DetectionItem

# Gerçek backend adresi
LIVE_API_URL = "https://turnstile-backend-04e771aad5b6.herokuapp.com/api"

# Internet erişimi yoksa testleri atlamak için bir kontrol
def is_backend_reachable():
    try:
        response = requests.get(f"{LIVE_API_URL}/health", timeout=5)
        return response.status_code == 200
    except requests.RequestException:
        return False

# Backend çalışmıyorsa atla
pytestmark = pytest.mark.skipif(
    not is_backend_reachable(), 
    reason="Gerçek test sunucusuna ulaşılamıyor (https://turnstile-backend-04e771aad5b6.herokuapp.com/api)"
)

@pytest.fixture
def live_client():
    """Gerçek backend'i işaret eden HttpBackendClient kopyası."""
    return HttpBackendClient(base_url=LIVE_API_URL)


def test_live_get_worker_not_found(live_client):
    """
    Geçersiz bir RFID taranırsa live backend'in beklenen 404/None
    döndürüp döndürmediği kontrol edilir.
    """
    worker = live_client.get_worker("A1B2C3D4")
    assert worker is None

def test_live_log_entry_unknown_card(live_client):
    """
    Sisteme geçersiz (UNKNOWN_CARD) durumunda bir log atarsak
    live API bunu HTTP 201 Created veya benzer bir 200 status kodu ile başarılı alır mı?
    """
    log = EntryLog(
        card_id="A1B2C3D4",
        worker_id=None,
        decision=AccessDecision.UNKNOWN_CARD,
        detected_ppe=[],
        missing_ppe=[],
        detections=[],
        timestamp_ms=int(time.time() * 1000)
    )
    
    # Gerçek API'ye log gönderiyoruz
    success = live_client.log_entry(log)
    
    # En azından success=True dönmesini bekleriz (Backend logu kaydettiyse)
    assert success is True
