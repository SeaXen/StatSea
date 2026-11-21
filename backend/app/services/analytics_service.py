from datetime import datetime, timedelta, timezone
from typing import Any

import sqlalchemy.exc
from cachetools import TTLCache
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.logging import get_logger
from ..models import models

logger = get_logger("AnalyticsService")

# Caches
topology_cache = TTLCache(maxsize=1, ttl=30)  # 30 seconds
docker_usage_cache = TTLCache(maxsize=100, ttl=60)  # 1 minute

class AnalyticsService:
    @staticmethod
    def get_network_history(db: Session, organization_id: int | None = None, limit: int = 60) -> list[dict[str, Any]]:
        """
        Retrieves recent bandwidth history snapshots, scoped to organization.
        """
        try:
            query = db.query(models.BandwidthHistory)
            if organization_id is not None and hasattr(models.BandwidthHistory, 'organization_id'):
                query = query.filter(models.BandwidthHistory.organization_id == organization_id)
            history = (
                query
                .order_by(models.BandwidthHistory.timestamp.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "timestamp": h.timestamp.isoformat() if h.timestamp else None,
                    "upload": h.upload_bytes,
                    "download": h.download_bytes,
                }
                for h in reversed(history)
            ]
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error retrieving network history")
            return []

    @staticmethod
    def get_topology(db: Session, organization_id: int) -> dict[str, Any]:
        """
        Generates nodes and edges for the network topology graph with caching.
        """
        cache_key = f"topology_{organization_id}"
        if cache_key in topology_cache:
            return topology_cache[cache_key]

        try:
            devices = db.query(models.Device).filter(
                (models.Device.organization_id == organization_id) | (models.Device.organization_id.is_(None))
            ).all()

            router_ip = "Gateway"
            for d in devices:
                if d.ip_address and "." in d.ip_address:
                    octets = d.ip_address.split(".")
                    if len(octets) == 4:
                        router_ip = f"{octets[0]}.{octets[1]}.{octets[2]}.1"
                        break

            nodes = [
                {
                    "id": "router",
                    "label": "Main Router",
                    "type": "Router",
                    "ip": router_ip,
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
                        "ip": device.ip_address or "",
                        "group": "device",
                    }
                )
                edges.append({"from": "router", "to": str(device.id), "value": 1})

            result = {"nodes": nodes, "edges": edges}
            topology_cache[cache_key] = result
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
            since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
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
                    "timestamp": m.timestamp.isoformat() if m.timestamp else None,
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

        now = datetime.now(timezone.utc)
        periods = {
            "daily": now - timedelta(days=1),
            "monthly": now - timedelta(days=30),
            "yearly": now - timedelta(days=365),
            "all_time": datetime(2000, 1, 1, tzinfo=timezone.utc),
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

    @staticmethod
    def get_device_history(db: Session, mac: str, organization_id: int | None = None) -> dict[str, Any]:
        """Bandwidth history for one device, sourced from persisted daily/monthly/yearly summaries."""
        query = db.query(models.Device).filter(models.Device.mac_address == mac)
        if organization_id is not None:
            query = query.filter(models.Device.organization_id == organization_id)
        device = query.first()
        if not device:
            return {"hourly": [], "five_minute": [], "daily": [], "monthly": [], "yearly": []}

        # Derive short-range series from TrafficLog (no per-device 5-min/hourly
        # summary table exists); bound the scan for safety.
        traffic = (
            db.query(models.TrafficLog)
            .filter(
                models.TrafficLog.device_id == device.id,
                models.TrafficLog.timestamp.isnot(None),
            )
            .order_by(models.TrafficLog.timestamp.desc())
            .limit(10000)
            .all()
        )
        five_buckets: dict[str, dict[str, int]] = {}
        hour_buckets: dict[str, dict[str, int]] = {}
        for row in traffic:
            if not row.timestamp:
                continue
            five_key = row.timestamp.replace(
                minute=(row.timestamp.minute // 5) * 5, second=0, microsecond=0
            ).isoformat()
            hour_key = row.timestamp.replace(minute=0, second=0, microsecond=0).isoformat()
            for buckets, key in ((five_buckets, five_key), (hour_buckets, hour_key)):
                bucket = buckets.setdefault(key, {"download": 0, "upload": 0})
                bucket["download"] += row.download_bytes or 0
                bucket["upload"] += row.upload_bytes or 0
        five_minute = [
            {"time": key[11:16], **values} for key, values in sorted(five_buckets.items())
        ][-24:]
        hourly = [
            {"time": key[11:13] + ":00", **values} for key, values in sorted(hour_buckets.items())
        ][-24:]

        daily = (
            db.query(models.DeviceDailySummary)
            .filter(models.DeviceDailySummary.device_id == device.id)
            .order_by(models.DeviceDailySummary.date.asc())
            .all()
        )
        monthly = (
            db.query(models.DeviceMonthlySummary)
            .filter(models.DeviceMonthlySummary.device_id == device.id)
            .order_by(models.DeviceMonthlySummary.month.asc())
            .all()
        )
        yearly = (
            db.query(models.DeviceYearlySummary)
            .filter(models.DeviceYearlySummary.device_id == device.id)
            .order_by(models.DeviceYearlySummary.year.asc())
            .all()
        )
        return {
            "hourly": hourly,
            "five_minute": five_minute,
            "daily": [
                {"date": str(d.date), "download": d.download_bytes or 0, "upload": d.upload_bytes or 0}
                for d in daily
            ],
            "monthly": [
                {"month": m.month, "download": m.download_bytes or 0, "upload": m.upload_bytes or 0}
                for m in monthly
            ],
            "yearly": [
                {"year": str(y.year), "download": y.download_bytes or 0, "upload": y.upload_bytes or 0}
                for y in yearly
            ],
        }
