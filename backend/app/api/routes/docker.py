import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.core.auth_jwt import get_current_admin_user, get_current_user
from app.core.docker_monitor import docker_monitor
from app.core.limiter import limiter
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/docker", tags=["Docker"])

@router.get(
    "/containers",
    summary="Get Docker containers",
    description="Retrieve status of all Docker containers.",
)
def get_docker_containers(current_user: models.User = Depends(get_current_user)):
    return docker_monitor.get_stats()


@router.get(
    "/{container_id}/history",
    summary="Get container history",
    description="Retrieve historical stats for a container.",
)
def get_docker_container_history(
    container_id: str,
    minutes: int = 60,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return AnalyticsService.get_docker_history(db, container_id, minutes)


@router.get(
    "/{container_id}/usage",
    summary="Get container usage",
    description="Retrieve current usage stats for a container.",
)
def get_docker_container_usage(
    container_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return AnalyticsService.get_docker_usage(db, container_id)


@router.get(
    "/containers/{container_id}/logs",
    summary="Get container logs",
    description="Retrieve logs for a specific container.",
)
async def get_container_logs(
    container_id: str, tail: int = 100, current_user: models.User = Depends(get_current_user)
):
    return {"logs": docker_monitor.get_logs(container_id, tail)}


@router.post(
    "/containers/{container_id}/action",
    summary="Container action",
    description="Perform an action (start/stop/restart) on a container.",
)
@limiter.limit("10/minute")
async def container_action(
    request: Request,
    container_id: str,
    payload: dict,
    admin_user: models.User = Depends(get_current_admin_user),
):
    action = payload.get("action")
    if action not in ["start", "stop", "restart"]:
        return {"success": False, "error": "Invalid action"}
    success = docker_monitor.perform_action(container_id, action)
    return {"success": success}


@router.post(
    "/prune",
    summary="Prune containers",
    description="Remove unused Docker containers and images.",
)
@limiter.limit("5/minute")
def prune_containers(
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return docker_monitor.prune_containers()
