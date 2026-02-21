import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.api.deps import get_current_org_id, get_cache_header
from app.core.auth_jwt import get_current_user
from app.services.analytics_service import AnalyticsService
from app.core.collector import global_collector
from app.core.ip_intel import get_ip_info

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/network", tags=["Network"])

@router.get(
    "/history",
    summary="Get network history",
    description="Retrieve historical network usage data.",
    dependencies=[Depends(get_cache_header(max_age=60))],
)
def get_network_history(
    skip: int = 0,
    limit: int = 60,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return AnalyticsService.get_network_history(db, limit)


@router.get(
    "/topology",
    summary="Get network topology",
    description="Retrieve network topology data.",
    dependencies=[Depends(get_cache_header(max_age=300))],
)
async def get_network_topology(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return AnalyticsService.get_topology(db, org_id)


@router.get(
    "/connections",
    summary="Get external connections",
    description="Retrieve current external connections.",
)
def get_external_connections(current_user: models.User = Depends(get_current_user)):
    return global_collector.get_external_connections()


@router.get(
    "/ip/{ip_address}",
    summary="Lookup IP",
    description="Get information about an IP address.",
)
def lookup_ip(
    ip_address: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return get_ip_info(ip_address)
