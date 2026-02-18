from datetime import datetime, timedelta
from typing import Any

import sqlalchemy.exc
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.logging import get_logger
from ..models import models

from cachetools import TTLCache

logger = get_logger("AnalyticsService")

# Caches
topology_cache = TTLCache(maxsize=1, ttl=30)  # 30 seconds
docker_usage_cache = TTLCache(maxsize=100, ttl=60)  # 1 minute

class AnalyticsService:
    @staticmethod
    def get_network_history(db: Session, limit: int = 60) -> list[dict[str, Any]]:
        """
        Retrieves recent bandwidth history snapshots.
        """
        try:
            history = (
                db.query(models.BandwidthHistory)
                .order_by(models.BandwidthHistory.timestamp.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "timestamp": h.timestamp.isoformat(),
                    "upload": h.upload_bytes,
                    "download": h.download_bytes,
                }
                for h in reversed(history)
            ]
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error retrieving network history")
            return []

    @staticmethod
    def get_topology(db: Session) -> dict[str, Any]:
        """
        Generates nodes and edges for the network topology graph with caching.
        """
        if "data" in topology_cache:
            return topology_cache["data"]

        try:
            devices = db.query(models.Device).all()
            nodes = [
                {
                    "id": "router",
                    "label": "Main Router",
                    "type": "Router",
                    "ip": "192.168.1.1",
                    "group": "core",
                }
            ]
            edges = []

            for device in devices:
                nodes.append(
                    {
                        "id": str(device.id),
                        "label": device.hostname or f"Device {device.mac_address[-5:]}",
                        "type": device.type,
                        "ip": device.ip_address,
                        "group": "device",
                    }
                )
                edges.append({"from": "router", "to": str(device.id), "value": 1})

            result = {"nodes": nodes, "edges": edges}
            topology_cache["data"] = result
            return result
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error generating topology")
            return {"nodes": [], "edges": []}

    @staticmethod
    def get_docker_history(
        db: Session, container_id: str, minutes: int = 60
    ) -> list[dict[str, Any]]:
        """
        Retrieves historical performance metrics for a specific Docker container.
        """
        try:
            since = datetime.now() - timedelta(minutes=minutes)
            metrics = (
                db.query(models.DockerContainerMetric)
                .filter(
                    models.DockerContainerMetric.container_id.like(f"{container_id}%"),
                    models.DockerContainerMetric.timestamp >= since,
                )
                .order_by(models.DockerContainerMetric.timestamp.asc())
                .all()
            )

            return [
                {
                    "timestamp": m.timestamp.isoformat(),
                    "cpu_pct": m.cpu_pct,
                    "mem_usage": m.mem_usage,
                    "net_rx": m.net_rx,
                    "net_tx": m.net_tx,
                }
                for m in metrics
            ]
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception(f"Database error retrieving Docker history for {container_id}")
            return []

    @staticmethod
    def get_docker_usage(db: Session, container_id: str) -> dict[str, Any]:
        if container_id in docker_usage_cache:
            return docker_usage_cache[container_id]

        now = datetime.now()
        periods = {
            "daily": now - timedelta(days=1),
            "monthly": now - timedelta(days=30),
            "yearly": now - timedelta(days=365),
            "all_time": datetime(2000, 1, 1),
        }

        result = {}
        for period_name, since in periods.items():
            stats = (
                db.query(
                    func.min(models.DockerContainerMetric.net_rx).label("min_rx"),
                    func.max(models.DockerContainerMetric.net_rx).label("max_rx"),
                    func.min(models.DockerContainerMetric.net_tx).label("min_tx"),
                    func.max(models.DockerContainerMetric.net_tx).label("max_tx"),
                )
                .filter(
                    models.DockerContainerMetric.container_id.like(f"{container_id}%"),
                    models.DockerContainerMetric.timestamp >= since,
                )
                .first()
            )

            if stats and stats.max_rx is not None:
                result[period_name] = {
                    "rx": max(0, stats.max_rx - stats.min_rx),
                    "tx": max(0, stats.max_tx - stats.min_tx),
                }
            else:
                result[period_name] = {"rx": 0, "tx": 0}

        docker_usage_cache[container_id] = result
        return result
