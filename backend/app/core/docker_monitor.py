import os
import threading
import time

try:
    import docker

    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False

from datetime import datetime, timezone

import sqlalchemy.exc

from ..core.logging import get_logger
from ..db.database import SessionLocal
from ..models.models import DockerContainerMetric

logger = get_logger("DockerMonitor")


class DockerMonitor:
    """
    Monitors Docker containers and their resource usage.
    Supports real Docker API and Mock data for development.
    """

    def __init__(self, use_mock: bool = False):
        self.use_mock = use_mock or not DOCKER_AVAILABLE or os.name == "nt"
        self.client = None
        self.containers_stats: dict[str, dict] = {}
        self.running = False
        self._thread = None
        self.lock = threading.Lock()

        if not self.use_mock:
            try:
                self.client = docker.from_env()
                logger.info("Docker monitor initialized with real Docker API")
            except docker.errors.DockerException as e:
                logger.warning(
                    f"Could not connect to Docker daemon: {e}. Falling back to mock data."
                )
                self.use_mock = True
            except Exception:
                logger.exception("Unexpected error connecting to Docker daemon")
                self.use_mock = True

        if self.use_mock:
            logger.info("Docker monitor disabled (Docker not available)")

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
                    pass
                else:
                    self._update_real_stats()
            except Exception:
                # Catches docker.errors.DockerException (when docker is available)
                # and any other unexpected errors safely
                logger.exception("Error in Docker monitor loop")

            # Persist stats every 60 seconds
            if time.time() - self.last_persist_time >= 60:
                self._persist_stats()
                self.last_persist_time = time.time()

            time.sleep(2)  # Update every 2 seconds

    def _persist_stats(self):
        """Writes current container stats to DB."""
        if not self.containers_stats:
            return

        db = SessionLocal()
        try:
            timestamp = datetime.now(timezone.utc)
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
                    net_tx=stats.get("net_tx", 0),
                )
                db.add(metric)
            db.commit()
            # logger.info(f"Persisted metrics for {len(stats_copy)} containers")
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error persisting Docker stats")
        except Exception:
            logger.exception("Unexpected error persisting Docker stats")
        finally:
            db.close()



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
                            "image": container.image.tags[0] if container.image and getattr(container.image, "tags", None) else "unknown",
                            "image_id": container.image.id if container.image and getattr(container.image, "id", None) else "",
                            "status": container.status,
                            "cpu_pct": 0,
                            "mem_usage": 0,
                            "net_rx": 0,
                            "net_tx": 0,
                            "history": {"cpu": [0] * 20, "mem": [0] * 20},
                        }
                        continue

                    # Get stats (one-shot)
                    stats_obj = container.stats(stream=False)

                    # CPU Calculation
                    cpu_delta = (
                        stats_obj["cpu_stats"]["cpu_usage"]["total_usage"]
                        - stats_obj["precpu_stats"]["cpu_usage"]["total_usage"]
                    )
                    system_delta = (
                        stats_obj["cpu_stats"]["system_cpu_usage"]
                        - stats_obj["precpu_stats"]["system_cpu_usage"]
                    )
                    cpu_pct = 0.0
                    if system_delta > 0 and cpu_delta > 0:
                        cpu_pct = (
                            (cpu_delta / system_delta)
                            * len(stats_obj["cpu_stats"]["cpu_usage"]["percpu_usage"])
                            * 100.0
                        )

                    # Memory
                    mem_usage = stats_obj["memory_stats"].get("usage", 0) / (1024 * 1024)  # MB

                    # Network
                    networks = stats_obj.get("networks", {})
                    rx = sum(v.get("rx_bytes", 0) for v in networks.values())
                    tx = sum(v.get("tx_bytes", 0) for v in networks.values())

                    if cid not in self.containers_stats:
                        self.containers_stats[cid] = {"history": {"cpu": [], "mem": []}}

                    stats = self.containers_stats[cid]
                    stats.update(
                        {
                            "id": cid,
                            "name": container.name,
                            "image": (
                                container.image.tags[0]
                                if container.image and getattr(container.image, "tags", None)
                                else "unknown"
                            ),
                            "image_id": container.image.id if container.image and getattr(container.image, "id", None) else "",
                            "status": container.status,
                            "cpu_pct": round(cpu_pct, 2),
                            "mem_usage": int(mem_usage),
                            "net_rx": rx,
                            "net_tx": tx,
                        }
                    )

                    stats["history"]["cpu"].append(stats["cpu_pct"])
                    stats["history"]["mem"].append(stats["mem_usage"])
                    if len(stats["history"]["cpu"]) > 20:
                        stats["history"]["cpu"].pop(0)
                        stats["history"]["mem"].pop(0)

                # Cleanup old containers
                for cid in list(self.containers_stats.keys()):
                    if cid not in current_ids:
                        del self.containers_stats[cid]

        except docker.errors.DockerException:
            logger.exception("Error fetching real Docker stats")
        except Exception:
            logger.exception("Unexpected error fetching real Docker stats")

    def get_stats(self) -> list[dict]:
        """Returns all container stats."""
        with self.lock:
            return list(self.containers_stats.values())

    def get_logs(self, container_id: str, tail: int = 100) -> str:
        """Fetches recent logs for a container."""
        if self.use_mock:
            return "Docker unavailable. Cannot fetch logs.\n"

        if not self.client:
            return "Docker client not available"

        try:
            # Find container by short ID if needed
            container = self.client.containers.get(container_id)
            return container.logs(tail=tail).decode("utf-8")
        except docker.errors.DockerException as e:
            return f"Docker error fetching logs: {e}"
        except Exception:
            logger.exception(f"Unexpected error fetching logs for {container_id}")
            return "Internal error fetching logs"

    def perform_action(self, container_id: str, action: str) -> bool:
        """Performs an action (start/stop/restart) on a container."""
        if self.use_mock:
            logger.error(f"Cannot perform {action} on {container_id}: Docker unavailable.")
            return False

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
        except docker.errors.DockerException as e:
            logger.error(f"Docker error performing {action} on {container_id}: {e}")
            return False
        except Exception:
            logger.exception(f"Unexpected error performing {action} on {container_id}")
            return False

    def prune_containers(self) -> dict:
        """Prunes stopped containers."""
        if self.use_mock:
            return {"error": "Docker unavailable"}

        if not self.client:
            return {"error": "Docker client not available"}

        try:
            return self.client.containers.prune()
        except docker.errors.DockerException as e:
            logger.error(f"Docker error pruning containers: {e}")
            return {"error": str(e)}
        except Exception:
            logger.exception("Unexpected error pruning containers")
            return {"error": "Internal error during prune"}


# Global monitor instance
docker_monitor = DockerMonitor()
