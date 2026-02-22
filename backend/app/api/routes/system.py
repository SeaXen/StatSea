import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.core.auth_jwt import get_current_user
from app.core.system_stats import system_stats
from app.core.docker_monitor import docker_monitor
from app.core.collector import global_collector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["System"])

@router.get(
    "/info",
    summary="Get system info",
    description="Retrieve general system information.",
)
def get_system_info(current_user: models.User = Depends(get_current_user)):
    info = system_stats.get_info()
    info["active_devices"] = len(global_collector.active_devices)
    return info


@router.get(
    "/processes",
    summary="Get system processes",
    description="Retrieve top system processes and container stats.",
)
def get_system_processes(current_user: models.User = Depends(get_current_user)):
    top_procs = system_stats.get_top_processes(limit=15)
    docker_stats = docker_monitor.get_stats()
    combined = []

    for p in top_procs:
        combined.append(
            {
                "id": f"p-{p['id']}",
                "name": p["name"],
                "cpu": round(p["cpu"], 1),
                "ram": round(p["ram"] / (1024 * 1024), 1),
                "type": "Process",
                "status": "running",
            }
        )

    for c in docker_stats:
        combined.append(
            {
                "id": f"d-{c['id']}",
                "name": c["name"],
                "cpu": round(c["cpu_pct"], 1),
                "ram": round(c["mem_usage"], 1),
                "type": "Container",
                "status": c["status"],
            }
        )
    return sorted(combined, key=lambda x: (x["cpu"], x["ram"]), reverse=True)


@router.get(
    "/network/history",
    summary="Get system network history",
    description="Retrieve historical system network usage.",
)
def get_system_network_history(
    hours: int = 24,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.SystemNetworkHistory)
    if start and end:
        query = query.filter(
            models.SystemNetworkHistory.timestamp >= start,
            models.SystemNetworkHistory.timestamp <= end,
        )
    else:
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        query = query.filter(models.SystemNetworkHistory.timestamp >= since)
    history = query.order_by(models.SystemNetworkHistory.timestamp.asc()).all()
    return [
        {
            "timestamp": h.timestamp.isoformat(),
            "interface": h.interface,
            "bytes_sent": h.bytes_sent,
            "bytes_recv": h.bytes_recv,
        }
        for h in history
    ]
