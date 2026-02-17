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
from ..core.monitor import monitor
from ..core.security import security_engine

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

@router.get("/devices/{device_id}/stats")
def get_device_stats(device_id: int, db: Session = Depends(get_db)):
    # Mock historical data for the chart
    import time
    now = time.time()
    stats = []
    for i in range(20):
        stats.append({
            "timestamp": now - (20 - i) * 60,
            "u": random.randint(10, 1000),
            "d": random.randint(100, 10000)
        })
    return stats

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
    except Exception:
        manager.disconnect(websocket)

@router.get("/alerts")
async def get_alerts(db: Session = Depends(get_db)):
    """Fetches security alerts."""
    return db.query(models.SecurityAlert).order_by(models.SecurityAlert.timestamp.desc()).limit(50).all()

@router.get("/docker/containers")
async def get_docker_containers():
    """Returns real-time Docker container stats."""
    return docker_monitor.get_stats()

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

@router.post("/settings", response_model=schemas.SystemSetting)
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
    return db_setting
