from fastapi import APIRouter, WebSocket, Depends
from sqlalchemy.orm import Session
from typing import List
import json
import asyncio
import random
import time
from ..db.database import get_db
from ..models import models
from ..schemas import defaults as schemas

from ..core.collector import global_collector
from ..core.docker_monitor import docker_monitor
from ..core.docker_monitor import docker_monitor
from ..core.monitor import monitor
from ..core.system_monitor import system_monitor # Import system_monitor
from ..core.security import security_engine
from ..core.scheduler import scheduler
from ..core.speedtest_service import speedtest_service
from ..core.system_stats import system_stats # Import system_stats
from ..core.collector import global_collector # Import global_collector
from fastapi import WebSocketDisconnect

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might be dead
                pass

manager = ConnectionManager()
global_collector.set_event_callback(manager.broadcast)

@router.get("/devices/{device_id}", response_model=schemas.Device)
def get_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.get("/devices/{device_id}/history")
def get_device_history(device_id: int, days: int = 7, db: Session = Depends(get_db)):
    """Returns daily traffic history for the past N days."""
    from datetime import datetime, timedelta
    since = datetime.now().date() - timedelta(days=days)
    
    summaries = db.query(models.DeviceDailySummary).filter(
        models.DeviceDailySummary.device_id == device_id,
        models.DeviceDailySummary.date >= since
    ).order_by(models.DeviceDailySummary.date.asc()).all()
    
    return [
        {
            "date": s.date.isoformat(),
            "upload": s.upload_bytes,
            "download": s.download_bytes
        }
        for s in summaries
    ]

@router.get("/devices/{device_id}/stats")
def get_device_stats(device_id: int, db: Session = Depends(get_db)):
    # Legacy endpoint compatibility, or just redirect to history?
    # Let's keep it but return similar structure or aggregate for charts
    # For now, let's just return the history as "stats"
    return get_device_history(device_id, days=30, db=db)


@router.get("/devices", response_model=List[schemas.Device])
def get_devices(db: Session = Depends(get_db)):
    # consistent return for now
    devices = db.query(models.Device).all()
    if not devices:
        # Seed some mock devices if empty
        defaults = [
             models.Device(mac_address="AA:BB:CC:DD:EE:01", ip_address="192.168.1.10", hostname="iPhone-13", vendor="Apple", type="Mobile", is_online=True),
             models.Device(mac_address="AA:BB:CC:DD:EE:02", ip_address="192.168.1.11", hostname="Galaxy-S24", vendor="Samsung", type="Mobile", is_online=False),
             models.Device(mac_address="AA:BB:CC:DD:EE:03", ip_address="192.168.1.20", hostname="Desktop-PC", vendor="Microsoft", type="PC", is_online=True),
        ]
        db.add_all(defaults)
        db.commit()
        devices = db.query(models.Device).all()
    return devices

@router.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Get real-time stats from the collector
            stats = global_collector.get_current_stats()
            
            data = {
                "timestamp": time.time(),
                "u": stats["u"],
                "d": stats["d"],
                "active_devices": stats["active_device_count"]
            }
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        # print("Client disconnected from live stats")
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
        pass

@router.get("/network/topology")
async def get_network_topology(db: Session = Depends(get_db)):
    devices = db.query(models.Device).all()
    
    nodes = []
    edges = []
    
    # Add Router as the central node
    nodes.append({
        "id": "router",
        "label": "Main Router",
        "type": "Router",
        "ip": "192.168.1.1",
        "group": "core"
    })
    
    for device in devices:
        nodes.append({
            "id": str(device.id),
            "label": device.hostname or f"Device {device.mac_address[-5:]}",
            "type": device.type,
            "ip": device.ip_address,
            "group": "device"
        })
        
        edges.append({
            "from": "router",
            "to": str(device.id),
            "value": 1
        })
        
        
    return {"nodes": nodes, "edges": edges}

@router.websocket("/ws/events")
async def events_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@router.get("/alerts")
async def get_alerts(db: Session = Depends(get_db)):
    """Fetches security alerts."""
    return db.query(models.SecurityAlert).order_by(models.SecurityAlert.timestamp.desc()).limit(50).all()

@router.get("/docker/containers")
def get_docker_containers():
    """Returns list of running containers and their current stats."""
    return docker_monitor.get_stats()

@router.get("/docker/{container_id}/history")
def get_docker_container_history(container_id: str, minutes: int = 60, db: Session = Depends(get_db)):
    """Returns historical stats for a container."""
    from datetime import datetime, timedelta
    since = datetime.now() - timedelta(minutes=minutes)
    
    metrics = db.query(models.DockerContainerMetric).filter(
        models.DockerContainerMetric.container_id.like(f"{container_id}%"), # match short or long id
        models.DockerContainerMetric.timestamp >= since
    ).order_by(models.DockerContainerMetric.timestamp.asc()).all()
    
    return [
        {
            "timestamp": m.timestamp.isoformat(),
            "cpu_pct": m.cpu_pct,
            "mem_usage": m.mem_usage,
            "net_rx": m.net_rx,
            "net_tx": m.net_tx
        }
        for m in metrics
    ]

@router.get("/docker/{container_id}/usage")
def get_docker_container_usage(container_id: str, db: Session = Depends(get_db)):
    """Returns aggregated usage statistics (Daily, Monthly, Yearly, All-time)."""
    from datetime import datetime, timedelta
    from sqlalchemy import func
    
    now = datetime.now()
    periods = {
        "daily": now - timedelta(days=1),
        "monthly": now - timedelta(days=30),
        "yearly": now - timedelta(days=365),
        "all_time": datetime(2000, 1, 1) # way back
    }
    
    result = {}
    for period_name, since in periods.items():
        # Get min and max RX/TX for calculate the delta (since these are cumulative counters)
        stats = db.query(
            func.min(models.DockerContainerMetric.net_rx).label("min_rx"),
            func.max(models.DockerContainerMetric.net_rx).label("max_rx"),
            func.min(models.DockerContainerMetric.net_tx).label("min_tx"),
            func.max(models.DockerContainerMetric.net_tx).label("max_tx")
        ).filter(
            models.DockerContainerMetric.container_id.like(f"{container_id}%"),
            models.DockerContainerMetric.timestamp >= since
        ).first()
        
        if stats and stats.max_rx is not None:
            result[period_name] = {
                "rx": (stats.max_rx - stats.min_rx) if stats.max_rx >= stats.min_rx else 0,
                "tx": (stats.max_tx - stats.min_tx) if stats.max_tx >= stats.min_tx else 0
            }
        else:
            result[period_name] = {"rx": 0, "tx": 0}
            
    return result

@router.get("/system/network/history")
def get_system_network_history(hours: int = 24, db: Session = Depends(get_db)):
    """Returns total system network usage history (vnstat-like)."""
    from datetime import datetime, timedelta
    since = datetime.now() - timedelta(hours=hours)

    # We might want to aggregate by hour if the data is too dense
    # For now, return all data points
    history = db.query(models.SystemNetworkHistory).filter(
        models.SystemNetworkHistory.timestamp >= since
    ).order_by(models.SystemNetworkHistory.timestamp.asc()).all()

    return [
        {
            "timestamp": h.timestamp.isoformat(),
            "interface": h.interface,
            "bytes_sent": h.bytes_sent,
            "bytes_recv": h.bytes_recv
        }
        for h in history
    ]


@router.get("/system/info")
def get_system_info():
    """Returns host-level metrics for the dashboard."""
    info = system_stats.get_info()
    info["active_devices"] = len(global_collector.active_devices)
    return info

@router.get("/system/processes")
def get_system_processes():
    """Returns top resource consuming processes (Host + Docker)."""
    # 1. Get host processes
    top_procs = system_stats.get_top_processes(limit=15)
    
    # 2. Get docker stats
    docker_stats = docker_monitor.get_stats()
    
    # 3. Combine and normalize
    # RAM in system_stats is bytes (RSS), in docker it's MB.
    # We'll normalize to MB for the UI.
    combined = []
    
    for p in top_procs:
        combined.append({
            "id": f"p-{p['id']}",
            "name": p['name'],
            "cpu": round(p['cpu'], 1),
            "ram": round(p['ram'] / (1024 * 1024), 1),
            "type": "Process",
            "status": "running"
        })
        
    for c in docker_stats:
        combined.append({
            "id": f"d-{c['id']}",
            "name": c['name'],
            "cpu": round(c['cpu_pct'], 1),
            "ram": round(c['mem_usage'], 1),
            "type": "Container",
            "status": c['status']
        })
        
    # Sort the final combined list by CPU then RAM
    return sorted(combined, key=lambda x: (x['cpu'], x['ram']), reverse=True)


@router.get("/docker/containers/{container_id}/logs")
async def get_container_logs(container_id: str, tail: int = 100):
    """Returns recent logs for a specific container."""
    return {"logs": docker_monitor.get_logs(container_id, tail)}

@router.post("/docker/containers/{container_id}/action")
async def container_action(container_id: str, payload: dict):
    """Performs an action (start, stop, restart) on a container."""
    action = payload.get("action")
    if action not in ["start", "stop", "restart"]:
        return {"success": False, "error": "Invalid action"}
    
    success = docker_monitor.perform_action(container_id, action)
    return {"success": success}

@router.patch("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(models.SecurityAlert).filter(models.SecurityAlert.id == alert_id).first()
    if alert:
        alert.is_resolved = True
        db.commit()
    return {"status": "success"}

@router.get("/network/connections")
def get_external_connections():
    """Returns geo-located external connections for the 3D globe."""
    return global_collector.get_external_connections()

@router.get("/network/history")
async def get_network_history(timeframe: str = "1h", db: Session = Depends(get_db)):
    """Returns bandwidth and latency history."""
    # TODO: Filter by timeframe
    bandwidth = db.query(models.BandwidthHistory).order_by(models.BandwidthHistory.timestamp.desc()).limit(100).all()
    latency = db.query(models.LatencyLog).order_by(models.LatencyLog.timestamp.desc()).limit(100).all()
    return {"bandwidth": bandwidth, "latency": latency}

@router.get("/network/health")
async def get_network_health(db: Session = Depends(get_db)):
    """Returns a computed network health score (0-100)."""
    # Simple logic: High latency or recent outages lower the score
    recent_latency = db.query(models.LatencyLog).order_by(models.LatencyLog.timestamp.desc()).limit(10).all()
    
    score = 100
    if recent_latency:
        avg_latency = sum(l.latency_ms for l in recent_latency) / len(recent_latency)
        if avg_latency > 100: score -= 20
        if avg_latency > 500: score -= 40
    
    return {"score": max(0, score), "status": "Excellent" if score > 80 else "Good" if score > 50 else "Poor"}

@router.get("/security/events")
async def get_security_events(db: Session = Depends(get_db)):
    """Returns all security events."""
    return db.query(models.SecurityEvent).order_by(models.SecurityEvent.timestamp.desc()).limit(50).all()

@router.get("/analytics/summary")
async def get_analytics_summary():
    """Returns comprehensive traffic analytics data."""
    return global_collector.get_analytics_summary()

@router.get("/settings", response_model=List[schemas.SystemSetting])
def get_settings(db: Session = Depends(get_db)):
    """Returns all system settings."""
    return db.query(models.SystemSettings).all()

@router.post("/settings")
def update_setting(setting: schemas.SystemSettingBase, db: Session = Depends(get_db)):
    """Updates or creates a system setting."""
    db_setting = db.query(models.SystemSettings).filter(models.SystemSettings.key == setting.key).first()
    if db_setting:
        db_setting.value = setting.value
        db_setting.type = setting.type
        db_setting.description = setting.description
    else:
        db_setting = models.SystemSettings(**setting.dict())
        db.add(db_setting)
    
    db.commit()
    db.refresh(db_setting)

    # Trigger scheduler update if interval changed
    if setting.key == "speedtest_interval":
        try:
            val = float(setting.value)
            scheduler.schedule_speedtest(val)
        except ValueError:
            pass

    return db_setting

@router.get("/speedtest/servers")
def get_speedtest_servers():
    """Returns a list of available speedtest servers."""
    return speedtest_service.get_servers()

@router.post("/speedtest")
async def run_speedtest(server_id: int = None, provider: str = "ookla", db: Session = Depends(get_db)):
    """Triggers a new speedtest."""
    return await speedtest_service.run_speedtest(db, server_id, provider)

@router.get("/speedtest")
def get_speedtest_history(limit: int = 50, db: Session = Depends(get_db)):
    """Returns speedtest history."""
    return db.query(models.SpeedtestResult).order_by(models.SpeedtestResult.timestamp.desc()).limit(limit).all()
