import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.schemas import defaults as schemas
from app.core.auth_jwt import get_current_admin_user, get_current_user
from app.core import sanitization

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["Groups"])

@router.get(
    "",
    response_model=list[schemas.DeviceGroup],
    summary="Get groups",
    description="Retrieve a list of all device groups.",
)
def get_groups(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    return db.query(models.DeviceGroup).all()

@router.post(
    "",
    response_model=schemas.DeviceGroup,
    summary="Create group",
    description="Create a new device group.",
)
def create_group(
    group: schemas.DeviceGroupCreate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    sanitized_name = sanitization.sanitize_string(group.name, max_length=100)
    db_group = models.DeviceGroup(name=sanitized_name, color=group.color)
    db.add(db_group)
    try:
        db.commit()
        db.refresh(db_group)
        return db_group
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Group already exists")

@router.put(
    "/{group_id}",
    response_model=schemas.DeviceGroup,
    summary="Update group",
    description="Update an existing device group.",
)
def update_group(
    group_id: int,
    group_update: schemas.DeviceGroupUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    db_group = db.query(models.DeviceGroup).filter(models.DeviceGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group_update.name is not None:
        db_group.name = sanitization.sanitize_string(group_update.name, max_length=100)
    if group_update.color is not None:
        db_group.color = group_update.color
    db.commit()
    db.refresh(db_group)
    return db_group

@router.delete(
    "/{group_id}",
    summary="Delete group",
    description="Delete a device group.",
)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    db_group = db.query(models.DeviceGroup).filter(models.DeviceGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.query(models.Device).filter(models.Device.group_id == group_id).update(
        {models.Device.group_id: None}
    )
    db.delete(db_group)
    db.commit()
    return {"status": "success"}
