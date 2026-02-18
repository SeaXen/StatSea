import asyncio
import os
import sys

# Add parent dir to path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.monitor import monitor
from app.db import database
from app.models import models


async def main():
    print("Testing monitor...")
    db = database.SessionLocal()
    try:
        # Test ping
        latency = await monitor.ping_host("8.8.8.8")
        print(f"Ping result: {latency}")
        
        # Test bandwidth capture
        monitor.capture_bandwidth(db)
        print("Bandwidth captured.")
        
        # Test anomaly detection
        monitor.latency_history["8.8.8.8"] = [10.0] * 5
        print("Baseline latency set to 10ms. Injecting 500ms latency...")
        
        monitor.check_latency_anomalies(db, "8.8.8.8", 500.0)
        
        # Check if event was logged
        event = db.query(models.SecurityEvent).filter(models.SecurityEvent.event_type == "NETWORK_LAG").order_by(models.SecurityEvent.id.desc()).first()
        if event:
            print(f"SUCCESS: Logged event: {event.description}")
        else:
            print("FAILURE: No event logged.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
