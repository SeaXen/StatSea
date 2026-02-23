import psutil
import time
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
import numpy as np
from sklearn.linear_model import LinearRegression

from ..models import models
from ..schemas import defaults

def get_active_processes(limit=5):
    """Get a list of top processes by CPU usage."""
    procs = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            procs.append(proc.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    # Sort by CPU percent and take top N
    procs.sort(key=lambda x: x['cpu_percent'], reverse=True)
    return procs[:limit]

def get_live_metrics():
    """Get real-time CPU, RAM, and Disk metrics."""
    cpu_pct = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    return {
        "cpu_pct": cpu_pct,
        "ram_used_gb": round(ram.used / (1024**3), 2),
        "ram_total_gb": round(ram.total / (1024**3), 2),
        "disk_used_gb": round(disk.used / (1024**3), 2),
        "disk_total_gb": round(disk.total / (1024**3), 2),
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "top_processes": get_active_processes()
    }

def record_system_metrics(db: Session):
    """Record current system metrics to history."""
    metrics = get_live_metrics()
    
    history_entry = models.OSMetricHistory(
        cpu_pct=metrics["cpu_pct"],
        ram_used_gb=metrics["ram_used_gb"],
        ram_total_gb=metrics["ram_total_gb"],
        disk_used_gb=metrics["disk_used_gb"],
        disk_total_gb=metrics["disk_total_gb"]
    )
    
    db.add(history_entry)
    db.commit()

def calculate_forecast(db: Session) -> defaults.SystemForecast:
    """Predict when RAM or Disk will hit 100% capacity using linear regression."""
    # Get last 30 days of data
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    history = db.query(models.OSMetricHistory).filter(
        models.OSMetricHistory.timestamp >= cutoff
    ).order_by(models.OSMetricHistory.timestamp.asc()).all()
    
    if len(history) < 5:
        return defaults.SystemForecast(
            ram_days_remaining=None,
            disk_days_remaining=None,
            ram_trend="stable",
            disk_trend="stable"
        )
    
    # Prepare data for regression
    timestamps = np.array([(h.timestamp.timestamp()) for h in history]).reshape(-1, 1)
    ram_vals = np.array([h.ram_used_gb for h in history])
    disk_vals = np.array([h.disk_used_gb for h in history])
    
    ram_total = history[-1].ram_total_gb
    disk_total = history[-1].disk_total_gb
    
    # RAM Forecast
    model_ram = LinearRegression().fit(timestamps, ram_vals)
    ram_slope = model_ram.coef_[0] # GB per second
    
    # Disk Forecast
    model_disk = LinearRegression().fit(timestamps, disk_vals)
    disk_slope = model_disk.coef_[0] # GB per second
    
    def days_remaining(slope, current, total):
        if slope <= 0:
            return None
        seconds_left = (total - current) / slope
        return round(max(0, seconds_left / (24 * 3600)), 1)

    ram_days = days_remaining(ram_slope, ram_vals[-1], ram_total)
    disk_days = days_remaining(disk_slope, disk_vals[-1], disk_total)
    
    def get_trend(slope):
        if slope > 0.0000001: # Small threshold
            return "worsening"
        if slope < -0.0000001:
            return "improving"
        return "stable"

    return defaults.SystemForecast(
        ram_days_remaining=ram_days,
        disk_days_remaining=disk_days,
        ram_trend=get_trend(ram_slope),
        disk_trend=get_trend(disk_slope)
    )
