import logging
import threading
import time
import random
from typing import List, Dict, Optional
import os

try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False

from ..db.database import SessionLocal
from ..models.models import DockerContainerMetric
from datetime import datetime
from sqlalchemy import func

logger = logging.getLogger("DockerMonitor")

class DockerMonitor:
    """
    Monitors Docker containers and their resource usage.
    Supports real Docker API and Mock data for development.
    """
    def __init__(self, use_mock: bool = False):
        self.use_mock = use_mock or not DOCKER_AVAILABLE or os.name == 'nt'
        self.client = None
        self.containers_stats: Dict[str, Dict] = {}
        self.running = False
        self._thread = None
        self.lock = threading.Lock()
        
        if not self.use_mock:
            try:
                self.client = docker.from_env()
                logger.info("Docker monitor initialized with real Docker API")
            except Exception as e:
                logger.warning(f"Could not connect to Docker daemon: {e}. Falling back to mock data.")
                self.use_mock = True

        if self.use_mock:
            logger.info("Docker monitor running in MOCK mode")
        
        self.last_persist_time = 0

    def start(self):
        """Starts the monitoring thread."""
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        """Stops the monitoring thread."""
        self.running = False
        if self._thread:
            self._thread.join(timeout=1)

    def _run(self):
        """Main monitoring loop."""
        while self.running:
            try:
                if self.use_mock:
                    self._update_mock_stats()
                else:
                    self._update_real_stats()
            except Exception as e:
                logger.error(f"Error in Docker monitor loop: {e}")
            
            # Persist stats every 60 seconds
            if time.time() - self.last_persist_time >= 60: 
                self._persist_stats()
                self.last_persist_time = time.time()

            time.sleep(2) # Update every 2 seconds

    def _persist_stats(self):
        """Writes current container stats to DB."""
        if not self.containers_stats:
            return

        db = SessionLocal()
        try:
            timestamp = datetime.now()
            with self.lock:
                stats_copy = list(self.containers_stats.values())

            for stats in stats_copy:
                metric = DockerContainerMetric(
                    container_id=stats.get("id"),
                    container_name=stats.get("name"),
                    timestamp=timestamp,
                    cpu_pct=stats.get("cpu_pct", 0),
                    mem_usage=stats.get("mem_usage", 0),
                    net_rx=stats.get("net_rx", 0),
                    net_tx=stats.get("net_tx", 0)
                )
                db.add(metric)
            db.commit()
            # logger.info(f"Persisted metrics for {len(stats_copy)} containers")
        except Exception as e:
            logger.error(f"Error persisting Docker stats: {e}")
        finally:
            db.close()


    def _update_mock_stats(self):
        """Generates mock container data."""
        mock_containers = [
            {"id": "c1", "name": "statsea-backend", "image": "statsea-api:latest", "status": "running"},
            {"id": "c2", "name": "statsea-frontend", "image": "statsea-web:latest", "status": "running"},
            {"id": "c3", "name": "postgres-db", "image": "postgres:15-alpine", "status": "running"},
            {"id": "c4", "name": "redis-cache", "image": "redis:7-alpine", "status": "running"},
            {"id": "c5", "name": "pihole", "image": "pihole/pihole:latest", "status": "running"},
            {"id": "c6", "name": "home-assistant", "image": "ghcr.io/home-assistant/home-assistant:stable", "status": "restarting"},
        ]

        with self.lock:
            for c in mock_containers:
                cid = c["id"]
                # Initialize trend if not exists
                if cid not in self.containers_stats:
                    self.containers_stats[cid] = {
                        **c,
                        "cpu_pct": random.uniform(0.1, 5.0),
                        "mem_usage": random.randint(50, 200), # MB
                        "net_rx": 0,
                        "net_tx": 0,
                        "uptime": "2d 4h",
                        "history": {"cpu": [], "mem": []}
                    }
                
                # Update with random variations
                stats = self.containers_stats[cid]
                stats["cpu_pct"] = max(0.1, min(100.0, stats["cpu_pct"] + random.uniform(-0.5, 0.5)))
                stats["mem_usage"] = max(10, stats["mem_usage"] + random.randint(-5, 5))
                stats["net_rx"] += random.randint(10, 1000)
                stats["net_tx"] += random.randint(5, 500)
                
                # Keep history for sparklines
                stats["history"]["cpu"].append(stats["cpu_pct"])
                stats["history"]["mem"].append(stats["mem_usage"])
                if len(stats["history"]["cpu"]) > 20:
                    stats["history"]["cpu"].pop(0)
                    stats["history"]["mem"].pop(0)

    def _update_real_stats(self):
        """Updates stats from real Docker API."""
        if not self.client:
            return
            
        try:
            containers = self.client.containers.list(all=True)
            current_ids = set()
            
            with self.lock:
                for container in containers:
                    cid = container.short_id
                    current_ids.add(cid)
                    
                    if container.status != "running":
                        self.containers_stats[cid] = {
                            "id": cid,
                            "name": container.name,
                            "image": container.image.tags[0] if container.image.tags else "unknown",
                            "status": container.status,
                            "cpu_pct": 0,
                            "mem_usage": 0,
                            "net_rx": 0,
                            "net_tx": 0,
                            "history": {"cpu": [0]*20, "mem": [0]*20}
                        }
                        continue

                    # Get stats (one-shot)
                    stats_obj = container.stats(stream=False)
                    
                    # CPU Calculation
                    cpu_delta = stats_obj["cpu_stats"]["cpu_usage"]["total_usage"] - stats_obj["precpu_stats"]["cpu_usage"]["total_usage"]
                    system_delta = stats_obj["cpu_stats"]["system_cpu_usage"] - stats_obj["precpu_stats"]["system_cpu_usage"]
                    cpu_pct = 0.0
                    if system_delta > 0 and cpu_delta > 0:
                        cpu_pct = (cpu_delta / system_delta) * len(stats_obj["cpu_stats"]["cpu_usage"]["percpu_usage"]) * 100.0
                    
                    # Memory
                    mem_usage = stats_obj["memory_stats"].get("usage", 0) / (1024 * 1024) # MB
                    
                    # Network
                    networks = stats_obj.get("networks", {})
                    rx = sum(v.get("rx_bytes", 0) for v in networks.values())
                    tx = sum(v.get("tx_bytes", 0) for v in networks.values())

                    if cid not in self.containers_stats:
                        self.containers_stats[cid] = {
                            "history": {"cpu": [], "mem": []}
                        }
                    
                    stats = self.containers_stats[cid]
                    stats.update({
                        "id": cid,
                        "name": container.name,
                        "image": (container.image.tags[0] if container.image and container.image.tags else "unknown"),
                        "status": container.status,
                        "cpu_pct": round(cpu_pct, 2),
                        "mem_usage": int(mem_usage),
                        "net_rx": rx,
                        "net_tx": tx
                    })
                    
                    stats["history"]["cpu"].append(stats["cpu_pct"])
                    stats["history"]["mem"].append(stats["mem_usage"])
                    if len(stats["history"]["cpu"]) > 20:
                        stats["history"]["cpu"].pop(0)
                        stats["history"]["mem"].pop(0)

                # Cleanup old containers
                for cid in list(self.containers_stats.keys()):
                    if cid not in current_ids:
                        del self.containers_stats[cid]
                        
        except Exception as e:
            logger.error(f"Error fetching real Docker stats: {e}")

    def get_stats(self) -> List[Dict]:
        """Returns all container stats."""
        with self.lock:
            return list(self.containers_stats.values())

    def get_logs(self, container_id: str, tail: int = 100) -> str:
        """Fetches recent logs for a container."""
        if self.use_mock:
            return f"Mock logs for {container_id}...\n[INFO] Service started\n[DEBUG] Heartbeat sent\n[INFO] Processing request #42\n[ERROR] Failed to find consensus on block 1024 (Mock Error)"
        
        if not self.client:
            return "Docker client not available"
            
        try:
            # Find container by short ID if needed
            container = self.client.containers.get(container_id)
            return container.logs(tail=tail).decode('utf-8')
        except Exception as e:
            return f"Error fetching logs: {e}"

    def perform_action(self, container_id: str, action: str) -> bool:
        """Performs an action (start/stop/restart) on a container."""
        if self.use_mock:
            logger.info(f"MOCK: Performing {action} on {container_id}")
            with self.lock:
                if container_id in self.containers_stats:
                    if action == "stop":
                        self.containers_stats[container_id]["status"] = "exited"
                    elif action == "start":
                        self.containers_stats[container_id]["status"] = "running"
                    elif action == "restart":
                        self.containers_stats[container_id]["status"] = "running"
            return True

        if not self.client:
            return False

        try:
            container = self.client.containers.get(container_id)
            if action == "start":
                container.start()
            elif action == "stop":
                container.stop()
            elif action == "restart":
                container.restart()
            return True
        except Exception as e:
            logger.error(f"Error performing {action} on {container_id}: {e}")
            return False

    def prune_containers(self) -> Dict:
        """Prunes stopped containers."""
        if self.use_mock:
            logger.info("MOCK: Pruning stopped containers")
            return {"ContainersDeleted": ["mock-c1", "mock-c2"], "SpaceReclaimed": 1024}
        
        if not self.client:
             return {"error": "Docker client not available"}

        try:
            return self.client.containers.prune()
        except Exception as e:
            logger.error(f"Error pruning containers: {e}")
            return {"error": str(e)}

# Global monitor instance
docker_monitor = DockerMonitor()
