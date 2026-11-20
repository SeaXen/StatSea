import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.auth_jwt import get_current_admin_user
from app.core.scheduler import scheduler
from app.db.database import get_db
from app.models import models
from app.schemas import defaults as schemas

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get(
    "",
    response_model=list[schemas.SystemSetting],
    summary="Get settings",
    description="Retrieve all system settings.",
)
def get_settings(
    db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)
):
    return db.query(models.SystemSettings).all()


@router.get(
    "/export",
    summary="Export settings",
    description="Download all system settings as a JSON snapshot.",
)
def export_settings(
    db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)
):
    settings = db.query(models.SystemSettings).order_by(models.SystemSettings.key).all()
    payload = [
        {
            "key": s.key,
            "value": s.value,
            "type": s.type,
            "description": s.description,
        }
        for s in settings
    ]
    filename = f"statsea_settings_{datetime.now().strftime('%Y%m%d')}.json"
    return Response(
        content=json.dumps(payload, indent=2, default=str),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post(
    "",
    summary="Update setting",
    description="Update a specific system setting.",
)
def update_setting(
    setting: schemas.SystemSettingBase,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    db_setting = (
        db.query(models.SystemSettings).filter(models.SystemSettings.key == setting.key).first()
    )
    if db_setting:
        db_setting.value = setting.value
        db_setting.type = setting.type
        db_setting.description = setting.description
    else:
        db_setting = models.SystemSettings(**setting.model_dump())
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    if setting.key == "speedtest_interval":
        try:
            scheduler.schedule_speedtest(float(setting.value))
        except ValueError:
            pass
    return db_setting
