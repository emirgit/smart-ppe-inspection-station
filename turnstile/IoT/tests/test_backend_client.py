"""
Test suite for HttpBackendClient.
"""
import pytest
from unittest.mock import patch, MagicMock

from turnstile.IoT.impl.http_backend_client import HttpBackendClient
from turnstile.IoT.include.models import EntryLog, AccessDecision

@patch("requests.Session.get")
def test_get_worker_success(mock_get):
    """Geçerli bir kart okutulduğunda backend'den worker bilgilerinin döndürülmesini test eder."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "success": True,
        "data": {
            "worker": {"id": 1, "full_name": "Ahmet Yılmaz", "role_name": "Şantiye Şefi"},
            "required_ppe": [{"id": 1, "item_key": "HELMET", "display_name": "Baret"}]
        }
    }
    mock_get.return_value = mock_response

    client = HttpBackendClient(base_url="http://test")
    worker = client.get_worker("1A2B3C4D")

    assert worker is not None
    assert worker.worker_name == "Ahmet Yılmaz"
    assert worker.role == "Şantiye Şefi"
    assert len(worker.required_ppe) == 1
    assert worker.required_ppe[0].item_key == "HELMET"


@patch("requests.Session.get")
def test_get_worker_not_found(mock_get):
    """Kayıtlı olmayan bir kart (404) durumunda None dönmesini test eder."""
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_get.return_value = mock_response

    client = HttpBackendClient(base_url="http://test")
    worker = client.get_worker("UNKNOWN_CARD")

    assert worker is None


@patch("requests.Session.post")
def test_log_entry_success(mock_post):
    """Geçiş kaydının (EntryLog) backend'e başarılı şekilde iletilmesini test eder."""
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_post.return_value = mock_response

    client = HttpBackendClient(base_url="http://test")
    log = EntryLog(card_id="123", worker_id=1, decision=AccessDecision.PASS)
    success = client.log_entry(log)

    assert success is True
    mock_post.assert_called_once()
    
    # Payload'ın doğru şekillendirildiğini (isimlendirmeleri) teyit et
    sent_json = mock_post.call_args[1]["json"]
    assert sent_json["worker_id"] == 1
    assert sent_json["result"] == "PASS"