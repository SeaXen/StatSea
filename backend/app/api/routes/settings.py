import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import models
from app.schemas import defaults as schemas
from app.core.auth_jwt import get_current_admin_user, get_current_user
from app.core.scheduler import scheduler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get(
    "",
    response_model=list[schemas.SystemSetting],
    summary="Get settings",
    description="Retrieve all system settings.",
)
def get_settings(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    return db.query(models.SystemSettings).all()


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
