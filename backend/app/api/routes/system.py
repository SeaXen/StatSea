import os
import socket
import sys
import time

import psutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...core.auth_jwt import get_current_user
from ...db.database import get_db
from ...models import models
from ...schemas import defaults
from ...services import (
    backup_service as backup_service_lib,
    health_checker as health_service,
    system_metrics as metrics_service,
)
from ..deps import check_admin

router = APIRouter(prefix="/system", tags=["System & Self-Hosting"])

# --- System Overview & Metrics ---

@router.get("/info")
def get_system_info(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns overview system stats required by dashboard widget and top row."""
    try:
        cpu_pct = psutil.cpu_percent(interval=None)
    except Exception:
        cpu_pct = 0.0

    try:
        cpu_load = psutil.getloadavg()[0] if hasattr(psutil, "getloadavg") else cpu_pct
    except Exception:
        cpu_load = cpu_pct

    try:
        ram = psutil.virtual_memory()
        ram_data = {
            "total": ram.total,
            "used": ram.used,
            "percent": ram.percent,
        }
    except Exception:
        ram_data = {"total": 0, "used": 0, "percent": 0.0}

    try:
        root_path = os.path.splitdrive(os.path.abspath('.'))[0] + '\\' if sys.platform.startswith('win') else '/'
        disk = psutil.disk_usage(root_path)
        disk_data = {
            "total": disk.total,
            "used": disk.used,
            "percent": disk.percent,
        }
    except Exception:
        disk_data = {"total": 0, "used": 0, "percent": 0.0}

    try:
        net = psutil.net_io_counters()
        net_data = {
            "sent": net.bytes_sent,
            "recv": net.bytes_recv,
        }
    except Exception:
        net_data = {"sent": 0, "recv": 0}

    try:
        device_count = db.query(models.Device).filter(models.Device.is_online == True).count()
        if device_count == 0:
            device_count = db.query(models.Device).count()
    except Exception:
        device_count = 0

    try:
        uptime_sec = int(time.time() - psutil.boot_time())
        days = uptime_sec // 86400
        hours = (uptime_sec % 86400) // 3600
        minutes = (uptime_sec % 3600) // 60
        uptime_str = f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m"
    except Exception:
        uptime_str = "1h 0m"

    return {
        "hostname": socket.gethostname(),
        "uptime": uptime_str,
        "temperature": None,
        "cpu_pct": cpu_pct,
        "cpu_load": round(cpu_load, 2),
        "ram": ram_data,
        "disk": disk_data,
        "network": net_data,
        "active_devices": device_count,
    }


@router.get("/processes")
def get_system_processes(
    limit: int = 10,
    current_user: models.User = Depends(get_current_user)
):
    """Get top processes by CPU usage."""
    return metrics_service.get_active_processes(limit=limit)


@router.get("/metrics/live")
def get_live_metrics(current_user: models.User = Depends(check_admin)):
    return metrics_service.get_live_metrics()

@router.get("/metrics/history", response_model=list[defaults.OSMetricHistory])
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

@router.get("/backups", response_model=list[defaults.BackupRecord])
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

@router.get("/health", response_model=list[defaults.HealthCheck])
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

@router.get("/health/{check_id}/logs", response_model=list[defaults.HealthCheckLog])
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
