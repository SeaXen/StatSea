import threading
import time
from datetime import datetime

import psutil
import sqlalchemy.exc

from ..db.database import SessionLocal
from ..models.models import SystemNetworkHistory
from .logging import get_logger

logger = get_logger("SystemMonitor")


class SystemMonitor:
    """
    Monitors total system network usage (vnstat-style).
    Persists data to SystemNetworkHistory.
    """

    def __init__(self):
        self.running = False
        self._thread = None
        self.interval = 60  # Snapshot every minute
        self._last_net_io = {}

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        logger.info("System Monitor started")

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=1)

    def _run(self):
        # Initial reading to establish baseline
        self._last_net_io = psutil.net_io_counters(pernic=True)

        while self.running:
            time.sleep(self.interval)
            try:
                self._capture_snapshot()
            except Exception:
                logger.exception("Unexpected error in System Monitor loop")

    def _capture_snapshot(self):
        current_net_io = psutil.net_io_counters(pernic=True)
        timestamp = datetime.now()

        db = SessionLocal()
        try:
            for interface, counters in current_net_io.items():
                if interface not in self._last_net_io:
                    self._last_net_io[interface] = counters
                    continue

                prev = self._last_net_io[interface]

                # Calculate delta
                bytes_sent = counters.bytes_sent - prev.bytes_sent
                bytes_recv = counters.bytes_recv - prev.bytes_recv
                packets_sent = counters.packets_sent - prev.packets_sent
                packets_recv = counters.packets_recv - prev.packets_recv

                # Handle counter wrap-around or reset (if delta is negative)
                if bytes_sent < 0 or bytes_recv < 0:
                    logger.warning(f"Counter reset detected on {interface}")
                    self._last_net_io[interface] = counters
                    continue

                # Only persist if there's activity
                if bytes_sent > 0 or bytes_recv > 0:
                    entry = SystemNetworkHistory(
                        interface=interface,
                        timestamp=timestamp,
                        bytes_sent=bytes_sent,
                        bytes_recv=bytes_recv,
                        packets_sent=packets_sent,
                        packets_recv=packets_recv,
                    )
                    db.add(entry)

                self._last_net_io[interface] = counters

            db.commit()
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error persisting system network stats")
            db.rollback()
        except Exception:
            logger.exception("Unexpected error persisting system network stats")
            db.rollback()
        finally:
            db.close()


# Global instance
system_monitor = SystemMonitor()
