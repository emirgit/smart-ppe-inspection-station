import os
import sys
import time
import logging

# Add the main directory to the python path to locate src and ai_vision modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.iot_core.orchestrator import IoTOrchestrator
from src.iot_core.interfaces.iot_module import IoTConfig

# Import necessary components (verify class names match your files)
from src.iot_core.hardware.gate_control import GateController
from src.iot_core.api_clients.http_backend_client import HttpBackendClient
from src.iot_core.api_clients.ws_display_client import WebSocketDisplayNotifier

# Uncomment this if you are using an SPI sensor directly connected to the Raspberry Pi:
# from src.iot_core.hardware.rfid_spi import RfidSpiReader
# Uncomment this if you are using Wi-Fi RFID reading via ESP32:
from src.iot_core.hardware.rfid_http_server import HttpRfidReader

from ai_vision.include.module_ai_vision import AIVisionModule

# Logging configuration (to see what is happening in the terminal)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("MAIN")

def main():
    logger.info("Initializing Smart PPE Inspection Station...")

    # 1. Configure settings
    # If using the .env library (python-dotenv), you can call load_dotenv() here
    config = IoTConfig()
    
    # 2. Initialize sub-components
    backend = HttpBackendClient(base_url="http://localhost:3000/api") # Backend IP
    display = WebSocketDisplayNotifier(ws_url="ws://localhost:8080")  # Display IP
    
    # Select your RFID hardware (Mock or actual physical device)
    # rfid = RfidSpiReader()
    rfid = HttpRfidReader() # Will automatically start the server on port 8000 based on its internal init
    
    gate = GateController() # Pass GPIO pin number as parameter if necessary
    ai = AIVisionModule()

    # 3. Wire components to the Orchestrator
    orchestrator = IoTOrchestrator(
        rfid=rfid,
        backend=backend,
        display=display,
        gate=gate,
        ai=ai,
        camera_device=0  # 0 or 1 (Camera index)
    )

    # 4. Start the system
    if not orchestrator.init(config):
        logger.error("Failed to initialize components. Shutting down...")
        sys.exit(1)

    try:
        logger.info("System entering main control loop (IDLE)...")
        orchestrator.run() # This loop runs continuously
    except KeyboardInterrupt:
        logger.info("Stopped by user (Ctrl+C). Shutting down...")
    finally:
        orchestrator.stop()
        logger.info("Shutdown routine completed.")

if __name__ == "__main__":
    main()
