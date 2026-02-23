from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import os

from ...db.database import get_db
from ...models import models
from ...schemas import defaults
from ...services import system_metrics as metrics_service
from ...services import backup_service as backup_service_lib
from ...services import health_checker as health_service
from ..deps import get_current_active_user, check_admin

router = APIRouter(prefix="/system", tags=["System & Self-Hosting"])

# --- System Metrics ---

@router.get("/metrics/live")
def get_live_metrics(current_user: models.User = Depends(check_admin)):
    return metrics_service.get_live_metrics()

@router.get("/metrics/history", response_model=List[defaults.OSMetricHistory])
def get_metrics_history(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    return db.query(models.OSMetricHistory).order_by(models.OSMetricHistory.timestamp.desc()).limit(limit).all()

@router.get("/forecast", response_model=defaults.SystemForecast)
def get_system_forecast(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    return metrics_service.calculate_forecast(db)

# --- Backups ---

@router.get("/backups", response_model=List[defaults.BackupRecord])
def list_backups(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    return backup_service_lib.list_backups(db)

@router.post("/backups", response_model=defaults.BackupRecord)
def create_manual_backup(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    return backup_service_lib.create_backup(db, is_manual=True)

@router.delete("/backups/{backup_id}")
def delete_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    success = backup_service_lib.delete_backup(db, backup_id)
    if not success:
        raise HTTPException(status_code=404, detail="Backup not found")
    return {"status": "success"}

# --- Health Checks ---

@router.get("/health", response_model=List[defaults.HealthCheck])
def list_health_checks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    return db.query(models.HealthCheck).all()

@router.post("/health", response_model=defaults.HealthCheck)
def create_health_check(
    check_in: defaults.HealthCheckCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    check = models.HealthCheck(**check_in.model_dump())
    db.add(check)
    db.commit()
    db.refresh(check)
    return check

@router.put("/health/{check_id}", response_model=defaults.HealthCheck)
def update_health_check(
    check_id: int,
    check_in: defaults.HealthCheckUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    check = db.query(models.HealthCheck).filter(models.HealthCheck.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Health check not found")
    
    update_data = check_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(check, field, value)
    
    db.commit()
    db.refresh(check)
    return check

@router.delete("/health/{check_id}")
def delete_health_check(
    check_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    check = db.query(models.HealthCheck).filter(models.HealthCheck.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Health check not found")
    
    db.delete(check)
    db.commit()
    return {"status": "success"}

@router.get("/health/{check_id}/logs", response_model=List[defaults.HealthCheckLog])
def get_health_check_logs(
    check_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    return db.query(models.HealthCheckLog).filter(
        models.HealthCheckLog.check_id == check_id
    ).order_by(models.HealthCheckLog.timestamp.desc()).limit(limit).all()

@router.post("/health/{check_id}/run")
async def trigger_health_check(
    check_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    check = db.query(models.HealthCheck).filter(models.HealthCheck.id == check_id).first()
    if not check:
        raise HTTPException(status_code=404, detail="Health check not found")
    
    is_up = await health_service.ping_url(check, db)
    return {"status": "success", "is_up": is_up}
