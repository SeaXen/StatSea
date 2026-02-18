from fastapi import APIRouter, WebSocket, Depends, Security, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
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
from ..core.system_monitor import system_monitor # Import system_monitor
from ..core.security import security_engine
from ..core.scheduler import scheduler
from ..core.speedtest_service import speedtest_service
from ..core.system_stats import system_stats # Import system_stats
from fastapi import WebSocketDisconnect
from ..core.limiter import limiter
from ..core.wol import wake_device
from ..core.ip_intel import get_ip_info
from ..core.ai_predictor import ai_predictor
from ..core.auth_jwt import create_access_token, get_current_user, get_current_admin_user
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
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
def get_device(device_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.put("/devices/{device_id}", response_model=schemas.Device)
def update_device(device_id: int, device_update: schemas.DeviceUpdate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Updates device details (nickname, notes, type)."""
    db_device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if device_update.nickname is not None:
        db_device.nickname = device_update.nickname
    if device_update.notes is not None:
        db_device.notes = device_update.notes
    if device_update.type is not None:
        db_device.type = device_update.type
    if device_update.tags is not None:
        db_device.tags = json.dumps(device_update.tags)
    if device_update.group_id is not None:
        db_device.group_id = device_update.group_id
        
    db.commit()
    db.refresh(db_device)
    return db_device

@router.get("/devices/{device_id}/uptime", response_model=List[schemas.DeviceStatusLog])
def get_device_uptime(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns uptime history (status logs) for a device."""
    query = db.query(models.DeviceStatusLog).filter(
        models.DeviceStatusLog.device_id == device_id
    )
    
    if start:
        query = query.filter(models.DeviceStatusLog.timestamp >= start)
    if end:
        query = query.filter(models.DeviceStatusLog.timestamp <= end)

    logs = query.order_by(models.DeviceStatusLog.timestamp.desc()).limit(limit).all()
    
    return logs

@router.post("/devices/{mac}/wake")
async def wake_host(mac: str, admin_user: models.User = Depends(get_current_admin_user)):
    """Sends a Wake-on-LAN magic packet to the device."""
    success = wake_device(mac)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send WoL packet")
    return {"status": "success", "message": f"Magic packet sent to {mac}"}

@router.get("/quotas/{device_id}", response_model=schemas.BandwidthQuota)
def get_device_quota(device_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns the bandwidth quota for a device."""
    quota = db.query(models.BandwidthQuota).filter(models.BandwidthQuota.device_id == device_id).first()
    if not quota:
        raise HTTPException(status_code=404, detail="Quota not found")
    return quota

@router.put("/quotas/{device_id}", response_model=schemas.BandwidthQuota)
def set_device_quota(device_id: int, quota_data: schemas.BandwidthQuotaBase, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Sets or updates the bandwidth quota for a device."""
    # Ensure device exists
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    quota = db.query(models.BandwidthQuota).filter(models.BandwidthQuota.device_id == device_id).first()
    if not quota:
        quota = models.BandwidthQuota(device_id=device_id)
        db.add(quota)
    
    quota.daily_limit_bytes = quota_data.daily_limit_bytes
    quota.monthly_limit_bytes = quota_data.monthly_limit_bytes
    
    db.commit()
    db.refresh(quota)
    return quota

@router.delete("/quotas/{device_id}")
def delete_device_quota(device_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Removes the bandwidth quota for a device."""
    quota = db.query(models.BandwidthQuota).filter(models.BandwidthQuota.device_id == device_id).first()
    if not quota:
        raise HTTPException(status_code=404, detail="Quota not found")
    
    db.delete(quota)
    db.commit()
    return {"status": "success"}

@router.get("/devices/{device_id}/history")
def get_device_history(device_id: int, days: int = 7, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
def get_device_stats(device_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Legacy endpoint compatibility, or just redirect to history?
    # For now, let's just return the history as "stats"
    return get_device_history(device_id, days=30, db=db)

@router.get("/network/history")
def get_network_history(limit: int = 60, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns bandwidth history for sparklines."""
    history = db.query(models.BandwidthHistory).order_by(models.BandwidthHistory.timestamp.desc()).limit(limit).all()
    return [
        {
            "timestamp": h.timestamp.isoformat(),
            "upload": h.upload_bytes,
            "download": h.download_bytes
        }
        for h in reversed(history)
    ]

@router.get("/settings/export")
def export_data(db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Exports all database data as JSON."""
    from datetime import date, datetime, timedelta
    
    # helper for json serialization
    def json_serial(obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        raise TypeError (f"Type {type(obj)} not serializable")

    def model_to_dict(obj):
        return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}

    # Fetch data from all tables
    data = {
        "devices": [model_to_dict(d) for d in db.query(models.Device).all()],
        "device_daily_summaries": [model_to_dict(s) for s in db.query(models.DeviceDailySummary).all()],
        "bandwidth_history": [model_to_dict(h) for h in db.query(models.BandwidthHistory).all()],
        "latency_logs": [model_to_dict(l) for l in db.query(models.LatencyLog).all()],
        "security_events": [model_to_dict(e) for e in db.query(models.SecurityEvent).all()],
        "security_alerts": [model_to_dict(a) for a in db.query(models.SecurityAlert).all()],
        "traffic_logs": [model_to_dict(t) for t in db.query(models.TrafficLog).all()],
        "speedtest_results": [model_to_dict(s) for s in db.query(models.SpeedtestResult).all()],
        "docker_metrics": [model_to_dict(m) for m in db.query(models.DockerContainerMetric).all()],
        "system_network_history": [model_to_dict(h) for h in db.query(models.SystemNetworkHistory).all()],
        "system_settings": [model_to_dict(s) for s in db.query(models.SystemSettings).all()],
        "export_metadata": {
            "version": "1.0",
            "timestamp": datetime.now().isoformat()
        }
    }
    
    from fastapi.responses import JSONResponse
    filename = f"statsea-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    
    return JSONResponse(
        content=json.loads(json.dumps(data, default=json_serial)),
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/devices", response_model=List[schemas.Device])
def get_devices(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
async def get_network_topology(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
async def get_alerts(severity: str = None, timeframe: str = None, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Fetches security alerts with optional filtering."""
    from datetime import datetime, timedelta
    
    query = db.query(models.SecurityAlert)
    
    if severity:
        # Allow comma-separated severities ?severity=HIGH,CRITICAL
        severities = severity.upper().split(',')
        query = query.filter(models.SecurityAlert.severity.in_(severities))
        
    if timeframe:
        since = datetime.now()
        if timeframe == "1h":
            since -= timedelta(hours=1)
        elif timeframe == "24h":
            since -= timedelta(hours=24)
        elif timeframe == "7d":
            since -= timedelta(days=7)
        elif timeframe == "30d":
            since -= timedelta(days=30)
        query = query.filter(models.SecurityAlert.timestamp >= since)
        
    return query.order_by(models.SecurityAlert.timestamp.desc()).limit(100).all()

@router.get("/docker/containers")
def get_docker_containers(current_user: models.User = Depends(get_current_user)):
    """Returns list of running containers and their current stats."""
    return docker_monitor.get_stats()

@router.get("/docker/{container_id}/history")
def get_docker_container_history(container_id: str, minutes: int = 60, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
def get_docker_container_usage(container_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
def get_system_network_history(
    hours: int = 24, 
    start: Optional[datetime] = None, 
    end: Optional[datetime] = None, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns total system network usage history (vnstat-like)."""
    from datetime import datetime, timedelta

    query = db.query(models.SystemNetworkHistory)

    if start and end:
        query = query.filter(
            models.SystemNetworkHistory.timestamp >= start,
            models.SystemNetworkHistory.timestamp <= end
        )
    else:
        since = datetime.now() - timedelta(hours=hours)
        query = query.filter(models.SystemNetworkHistory.timestamp >= since)

    history = query.order_by(models.SystemNetworkHistory.timestamp.asc()).all()

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
def get_system_info(current_user: models.User = Depends(get_current_user)):
    """Returns host-level metrics for the dashboard."""
    info = system_stats.get_info()
    info["active_devices"] = len(global_collector.active_devices)
    return info

@router.get("/system/processes")
def get_system_processes(current_user: models.User = Depends(get_current_user)):
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
async def get_container_logs(container_id: str, tail: int = 100, current_user: models.User = Depends(get_current_user)):
    """Returns recent logs for a specific container."""
    return {"logs": docker_monitor.get_logs(container_id, tail)}

@router.post("/docker/containers/{container_id}/action")
@limiter.limit("10/minute")
async def container_action(request: Request, container_id: str, payload: dict, admin_user: models.User = Depends(get_current_admin_user)):
    """Performs an action (start, stop, restart) on a container."""
    action = payload.get("action")
    if action not in ["start", "stop", "restart"]:
        return {"success": False, "error": "Invalid action"}
    
    success = docker_monitor.perform_action(container_id, action)
    return {"success": success}

@router.post("/docker/prune")
@limiter.limit("5/minute")
def prune_containers(request: Request, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Prunes stopped containers."""
    return docker_monitor.prune_containers()

@router.patch("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    alert = db.query(models.SecurityAlert).filter(models.SecurityAlert.id == alert_id).first()
    if alert:
        alert.is_resolved = True
        db.commit()
    return {"status": "success"}

@router.get("/network/connections")
def get_external_connections(current_user: models.User = Depends(get_current_user)):
    """Returns geo-located external connections for the 3D globe."""
    return global_collector.get_external_connections()

@router.get("/network/ip/{ip_address}")
def lookup_ip(ip_address: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns WHOIS and location info for an IP."""
    return get_ip_info(ip_address)

@router.get("/network/history")
async def get_network_history(timeframe: str = "1h", db: Session = Depends(get_db)):
    """Returns bandwidth and latency history."""
    start_time = datetime.now() - timedelta(hours=24) # Default
    if timeframe == "1h":
        start_time = datetime.now() - timedelta(hours=1)
    elif timeframe == "24h":
        start_time = datetime.now() - timedelta(hours=24)
    elif timeframe == "7d":
        start_time = datetime.now() - timedelta(days=7)
    elif timeframe == "30d":
        start_time = datetime.now() - timedelta(days=30)
    
    bandwidth = db.query(models.BandwidthHistory).filter(models.BandwidthHistory.timestamp >= start_time).order_by(models.BandwidthHistory.timestamp.asc()).all()
    latency = db.query(models.LatencyLog).filter(models.LatencyLog.timestamp >= start_time).order_by(models.LatencyLog.timestamp.asc()).all()
    return {"bandwidth": bandwidth, "latency": latency}

@router.get("/network/health")
async def get_network_health(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
async def get_security_events(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns all security events."""
    return db.query(models.SecurityEvent).order_by(models.SecurityEvent.timestamp.desc()).limit(50).all()

@router.get("/analytics/summary")
async def get_analytics_summary(current_user: models.User = Depends(get_current_user)):
    """Returns comprehensive traffic analytics data."""
    return global_collector.get_analytics_summary()

@router.get("/analytics/packets")
def get_packet_log(
    limit: int = 100, 
    protocol: Optional[str] = None, 
    ip: Optional[str] = None, 
    port: Optional[int] = None, 
    flags: Optional[str] = None,
    current_user: models.User = Depends(get_current_user)
):
    """Returns filtered packet logs."""
    return global_collector.get_packet_log(limit=limit, protocol=protocol, ip=ip, port=port, flags=flags)

@router.get("/analytics/prediction")
def get_usage_prediction(current_user: models.User = Depends(get_current_user)):
    """Predicts monthly usage trends."""
    return ai_predictor.predict_total_usage()

@router.get("/analytics/anomalies")
def get_usage_anomalies(current_user: models.User = Depends(get_current_user)):
    """Returns detected usage anomalies."""
    return ai_predictor.detect_anomalies()

@router.get("/analytics/history/system")
def get_system_historical_stats(period: str = "daily", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Returns system-wide historical usage.
    period: daily, monthly, yearly
    """
    if period == "daily":
        results = db.query(models.SystemDailySummary).order_by(models.SystemDailySummary.date.desc()).limit(30).all()
        return [{"date": r.date, "sent": r.bytes_sent, "recv": r.bytes_recv} for r in results]
    elif period == "monthly":
        results = db.query(models.SystemMonthlySummary).order_by(models.SystemMonthlySummary.month.desc()).limit(12).all()
        return [{"month": r.month, "sent": r.bytes_sent, "recv": r.bytes_recv} for r in results]
    elif period == "yearly":
        results = db.query(models.SystemYearlySummary).order_by(models.SystemYearlySummary.year.desc()).all()
        return [{"year": r.year, "sent": r.bytes_sent, "recv": r.bytes_recv} for r in results]
    return {"error": "Invalid period"}

@router.get("/analytics/history/device/{mac}")
def get_device_historical_stats(mac: str, period: str = "daily", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Returns device-specific historical usage.
    period: daily, monthly, yearly
    """
    device = db.query(models.Device).filter(models.Device.mac_address == mac).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if period == "daily":
        results = db.query(models.DeviceDailySummary).filter(models.DeviceDailySummary.device_id == device.id).order_by(models.DeviceDailySummary.date.desc()).limit(30).all()
        return [{"date": r.date, "sent": r.upload_bytes, "recv": r.download_bytes} for r in results]
    elif period == "monthly":
        results = db.query(models.DeviceMonthlySummary).filter(models.DeviceMonthlySummary.device_id == device.id).order_by(models.DeviceMonthlySummary.month.desc()).limit(12).all()
        return [{"month": r.month, "sent": r.upload_bytes, "recv": r.download_bytes} for r in results]
    elif period == "yearly":
        results = db.query(models.DeviceYearlySummary).filter(models.DeviceYearlySummary.device_id == device.id).order_by(models.DeviceYearlySummary.year.desc()).all()
        return [{"year": r.year, "sent": r.upload_bytes, "recv": r.download_bytes} for r in results]
    return {"error": "Invalid period"}

@router.get("/network/dns", response_model=List[schemas.DnsLog])
def get_dns_logs(limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns recent DNS logs."""
    return db.query(models.DnsLog).order_by(models.DnsLog.timestamp.desc()).limit(limit).all()

@router.get("/network/dns/top")
def get_top_domains(limit: int = 10, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns top queried domains."""
    from sqlalchemy import func
    results = db.query(models.DnsLog.query_domain, func.count(models.DnsLog.query_domain).label('count'))\
        .group_by(models.DnsLog.query_domain)\
        .order_by(func.count(models.DnsLog.query_domain).desc())\
        .limit(limit).all()
    
    return [{"domain": r[0], "count": r[1]} for r in results]

@router.get("/settings", response_model=List[schemas.SystemSetting])
def get_settings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns all system settings."""
    return db.query(models.SystemSettings).all()

@router.post("/settings")
def update_setting(setting: schemas.SystemSettingBase, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
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
def get_speedtest_servers(current_user: models.User = Depends(get_current_user)):
    """Returns a list of available speedtest servers."""
    return speedtest_service.get_servers()

@router.post("/speedtest")
@limiter.limit("5/minute")
async def run_speedtest(request: Request, server_id: int = None, provider: str = "ookla", db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Triggers a new speedtest."""
    return await speedtest_service.run_speedtest(db, server_id, provider)

@router.get("/speedtest")
def get_speedtest_history(limit: int = 50, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns speedtest history."""
    return db.query(models.SpeedtestResult).order_by(models.SpeedtestResult.timestamp.desc()).limit(limit).all()

# Device Groups Endpoints

@router.post("/groups", response_model=schemas.DeviceGroup)
def create_group(group: schemas.DeviceGroupCreate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Creates a new device group."""
    db_group = models.DeviceGroup(name=group.name, color=group.color)
    db.add(db_group)
    try:
        db.commit()
        db.refresh(db_group)
        return db_group
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Group already exists")

@router.get("/groups", response_model=List[schemas.DeviceGroup])
def get_groups(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Returns all device groups."""
    return db.query(models.DeviceGroup).all()

@router.put("/groups/{group_id}", response_model=schemas.DeviceGroup)
def update_group(group_id: int, group_update: schemas.DeviceGroupUpdate, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Updates a device group."""
    db_group = db.query(models.DeviceGroup).filter(models.DeviceGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group_update.name is not None:
        db_group.name = group_update.name
    if group_update.color is not None:
        db_group.color = group_update.color
        
    db.commit()
    db.refresh(db_group)
    return db_group

@router.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), admin_user: models.User = Depends(get_current_admin_user)):
    """Deletes a device group."""
    db_group = db.query(models.DeviceGroup).filter(models.DeviceGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Set group_id to null for devices in this group
    devices = db.query(models.Device).filter(models.Device.group_id == group_id).all()
    for device in devices:
        device.group_id = None
        
    db.delete(db_group)
    db.commit()
    return {"status": "success"}

# Authentication Endpoints

@router.post("/auth/login", response_model=schemas.Token)
async def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not user.verify_password(form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/me", response_model=schemas.User)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.post("/auth/logout")
async def logout():
    # In JWT, logout is primarily handled by the client discarding the token.
    # We could implement a blacklist if needed later.
    return {"status": "success", "message": "Logged out successfully"}
