import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas import defaults as schemas
from app.services.device_service import DeviceService
from app.api.deps import get_current_org_id
from app.core.auth_jwt import get_current_user
from app.models import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/devices", tags=["Devices"])

@router.get(
    "",
    response_model=schemas.CursorPage[schemas.Device],
    summary="List all devices",
)
def list_devices(
    cursor: int | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.get_devices(db, org_id, cursor, limit)


@router.get(
    "/{device_id}",
    response_model=schemas.Device,
    summary="Get device details",
)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.get_device(db, device_id, org_id)


@router.put(
    "/{device_id}",
    response_model=schemas.Device,
    summary="Update device",
)
def update_device(
    device_id: int,
    device_update: schemas.DeviceUpdate,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
    current_user: models.User = Depends(get_current_user),
):
    return DeviceService.update_device(db, device_id, org_id, device_update, actor_id=current_user.id)


@router.post(
    "/{mac}/wake",
    summary="Wake on LAN",
)
async def wake_host(
    mac: str,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
    current_user: models.User = Depends(get_current_user),
):
    DeviceService.wake_host(db, mac, org_id, actor_id=current_user.id)
    return {"status": "success", "message": f"Magic packet sent to {mac}"}

# --- Quotas ---

@router.get(
    "/{device_id}/quotas",
    response_model=schemas.BandwidthQuota,
    summary="Get device quota",
)
def get_device_quota(
    device_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.get_quota(db, device_id, org_id)


@router.put(
    "/{device_id}/quotas",
    response_model=schemas.BandwidthQuota,
    summary="Set device quota",
)
def set_device_quota(
    device_id: int,
    quota_data: schemas.BandwidthQuotaBase,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
    current_user: models.User = Depends(get_current_user),
):
    return DeviceService.set_quota(db, device_id, org_id, quota_data, actor_id=current_user.id)


@router.delete(
    "/{device_id}/quotas",
    summary="Delete device quota",
)
def delete_device_quota(
    device_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
    current_user: models.User = Depends(get_current_user),
):
    DeviceService.delete_quota(db, device_id, org_id, actor_id=current_user.id)
    return {"status": "success"}
