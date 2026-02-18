import asyncio
import psutil
import time
from sqlalchemy.orm import Session
from ..models import models
from ..db import database
from .security import security_engine
import subprocess
import platform

class NetworkMonitor:
    def __init__(self):
        self.targets = ["8.8.8.8", "1.1.1.1"] # Google, Cloudflare
        self.running = False
        self.latency_history = {t: [] for t in self.targets}
        self.HISTORY_SIZE = 10

    async def ping_host(self, host: str) -> float | None:
        """
        Pings a host and returns latency in ms.
        Returns None if host is unreachable.
        """
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '1', host]
        
        try:
            # high-res timer
            start = time.perf_counter()
            process = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await process.wait()
            end = time.perf_counter()
            
            if process.returncode == 0:
                return (end - start) * 1000 # convert to ms
            return None
        except Exception as e:
            print(f"Ping error for {host}: {e}")
            return None

    def capture_bandwidth(self, db: Session):
        """
        Captures total system bandwidth usage and logs it to DB.
        """
        try:
            counters = psutil.net_io_counters()
            
            bandwidth_entry = models.BandwidthHistory(
                upload_bytes=counters.bytes_sent,
                download_bytes=counters.bytes_recv
            )
            db.add(bandwidth_entry)
            db.commit()
        except Exception as e:
            print(f"Bandwidth capture error: {e}")
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
                db, 
                event_type="NETWORK_LAG", 
                severity="LOW", 
                description=desc,
                commit=False
            )
            print(f"ANOMALY: {desc}")

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
                log = models.LatencyLog(
                    target=target,
                    latency_ms=latency
                )
                db.add(log)
                
                # Check for anomalies
                self.check_latency_anomalies(db, target, latency)

        try:
            db.commit()
        except Exception as e:
            print(f"Latency log error: {e}")
            db.rollback()

    async def _monitor_loop(self):
        db = database.SessionLocal()
        try:
            print("Network Monitor: Loop started.")
            while self.running:
                # 1. Capture latency & check anomalies
                await self.log_latency(db)

                # 3. Security Checks (every loop for now, maybe throttle later)
                security_engine.detect_port_changes(db)

                # Wait for next interval
                await asyncio.sleep(5) 
        except Exception as e:
            print(f"Monitor loop error: {e}")
        finally:
            db.close()
            print("Network Monitor: Loop ended.")

    async def start(self):
        if self.running: return
        self.running = True
        asyncio.create_task(self._monitor_loop())
        print("Network Monitor started.")

    def stop(self):
        self.running = False
        print("Network Monitor stopped.")

monitor = NetworkMonitor()
