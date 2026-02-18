import asyncio
import platform
import time
import socket
import psutil
import sqlalchemy.exc
from sqlalchemy.orm import Session

from ..db import database
from ..models import models
from .logging import get_logger
from .security import security_engine

logger = get_logger("NetworkMonitor")


class NetworkMonitor:
    def __init__(self):
        self.targets = ["8.8.8.8", "1.1.1.1"]  # Google, Cloudflare
        self.running = False
        self.latency_history = {t: [] for t in self.targets}
        self.HISTORY_SIZE = 10

    async def ping_host(self, host: str) -> float | None:
        """
        Pings a host and returns latency in ms.
        Returns None if host is unreachable.
        """
        param = "-n" if platform.system().lower() == "windows" else "-c"
        command = ["ping", param, "1", host]

        try:
            # high-res timer
            start = time.perf_counter()
            process = await asyncio.create_subprocess_exec(
                *command, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
            )
            await process.wait()
            end = time.perf_counter()

            if process.returncode == 0:
                return (end - start) * 1000  # convert to ms
            return None
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(f"Ping error for {host}")
            return None

    def capture_bandwidth(self, db: Session):
        """
        Captures total system bandwidth usage and logs it to DB.
        """
        try:
            counters = psutil.net_io_counters()

            bandwidth_entry = models.BandwidthHistory(
                upload_bytes=counters.bytes_sent, download_bytes=counters.bytes_recv
            )
            db.add(bandwidth_entry)
            db.commit()
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error during bandwidth capture")
            db.rollback()
        except Exception:
            logger.exception("Unexpected error during bandwidth capture")
            db.rollback()

    def check_latency_anomalies(self, db: Session, target: str, current_latency: float):
        """
        Checks if current latency is significantly higher than recent average.
        """
        history = self.latency_history[target]
        if len(history) < 5:
            history.append(current_latency)
            return

        avg = sum(history) / len(history)
        # Threshold: 2x average + 50ms buffer (to avoid alerts on low latency variations)
        threshold = (avg * 2) + 50

        if current_latency > threshold:
            desc = f"High latency detected for {target}: {current_latency:.2f}ms (Avg: {avg:.2f}ms)"
            security_engine.log_security_event(
                db, event_type="NETWORK_LAG", severity="LOW", description=desc, commit=False
            )
            logger.warning(f"ANOMALY: {desc}")

        # Update history
        history.append(current_latency)
        if len(history) > self.HISTORY_SIZE:
            history.pop(0)

    async def log_latency(self, db: Session):
        """
        Pings all targets, logs to DB, and checks for anomalies.
        """
        for target in self.targets:
            latency = await self.ping_host(target)
            if latency is not None:
                log = models.LatencyLog(target=target, latency_ms=latency)
                db.add(log)

                # Check for anomalies
                self.check_latency_anomalies(db, target, latency)

        try:
            db.commit()
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error during latency logging")
            db.rollback()
        except Exception:
            logger.exception("Unexpected error during latency logging")
            db.rollback()

    async def _monitor_loop(self):
        db = database.SessionLocal()
        try:
            logger.info("Network Monitor: Loop started")
            while self.running:
                # 1. Capture latency & check anomalies
                await self.log_latency(db)

                # 3. Security Checks (every loop for now, maybe throttle later)
                security_engine.detect_port_changes(db)

                # Wait for next interval
                await asyncio.sleep(5)
        except asyncio.CancelledError:
            logger.info("Network Monitor: Loop cancelled.")
        except Exception:
            logger.exception("Unexpected error in Network Monitor loop")
        finally:
            db.close()
            logger.info("Network Monitor: Loop ended.")

    async def start(self):
        if self.running:
            return
        self.running = True
        asyncio.create_task(self._monitor_loop())
        logger.info("Network Monitor started.")

    def stop(self):
        self.running = False
        logger.info("Network Monitor stopped.")


def wake_device(mac: str) -> bool:
    """
    Sends a Wake-on-LAN magic packet to the specified MAC address.
    """
    try:
        # Clean MAC address
        mac_clean = mac.replace(":", "").replace("-", "")
        if len(mac_clean) != 12:
            logger.error(f"Invalid MAC address for WoL: {mac}")
            return False

        # Construct Magic Packet
        data = bytes.fromhex("FF" * 6 + mac_clean * 16)

        # Send broadcast packet
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.sendto(data, ("255.255.255.255", 9))
        
        return True
    except Exception:
        logger.exception(f"Failed to send WoL packet to {mac}")
        return False

monitor = NetworkMonitor()
