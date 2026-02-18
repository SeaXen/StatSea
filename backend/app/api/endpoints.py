import asyncio
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Request, WebSocket
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..core import sanitization
from ..core.ai_predictor import ai_predictor
from ..core.auth_jwt import get_current_admin_user, get_current_user
from ..core.collector import global_collector
from ..core.docker_monitor import docker_monitor
from ..core.exceptions import ValidationException
from ..core.ip_intel import get_ip_info
from ..core.limiter import limiter
from ..core.scheduler import scheduler
from ..core.speedtest_service import speedtest_service
from ..core.system_stats import system_stats
from ..db.database import get_db
from ..models import models
from ..schemas import defaults as schemas
from ..services.analytics_service import AnalyticsService

# Import Services
from ..services.auth_service import AuthService
from ..services.device_service import DeviceService
from ..services.user_service import UserService
from ..services.log_service import LogService
from ..services.email_service import EmailService

from ..services.email_service import EmailService

router = APIRouter()


def get_current_org_id(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> int:
    """
    Dependency to get the current user's active organization ID.
    For now, it returns the first organization found.
    """
    member = (
        db.query(models.OrganizationMember)
        .filter(models.OrganizationMember.user_id == current_user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="User is not a member of any organization")
    return member.organization_id


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might be dead, remove it
                self.disconnect(connection)


manager = ConnectionManager()
global_collector.set_event_callback(manager.broadcast)

# --- Device Endpoints ---


@router.get(
    "/devices",
    response_model=list[schemas.Device],
    summary="List all devices",
    description="Retrieve a list of all devices with pagination.",
)
def list_devices(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.get_devices(db, org_id, skip, limit)


@router.get(
    "/devices/{device_id}",
    response_model=schemas.Device,
    summary="Get device details",
    description="Retrieve detailed information about a specific device.",
)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.get_device(db, device_id, org_id)


@router.put(
    "/devices/{device_id}",
    response_model=schemas.Device,
    summary="Update device",
    description="Update device information.",
)
def update_device(
    device_id: int,
    device_update: schemas.DeviceUpdate,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.update_device(db, device_id, org_id, device_update)


@router.post(
    "/devices/{mac}/wake",
    summary="Wake on LAN",
    description="Send a Wake-on-LAN magic packet to the device.",
)
async def wake_host(
    mac: str,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    DeviceService.wake_host(db, mac, org_id)
    return {"status": "success", "message": f"Magic packet sent to {mac}"}


# --- Quota Endpoints ---


@router.get(
    "/quotas/{device_id}",
    response_model=schemas.BandwidthQuota,
    summary="Get device quota",
    description="Retrieve bandwidth quota for a specific device.",
)
def get_device_quota(
    device_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.get_quota(db, device_id, org_id)


@router.put(
    "/quotas/{device_id}",
    response_model=schemas.BandwidthQuota,
    summary="Set device quota",
    description="Set or update bandwidth quota for a specific device.",
)
def set_device_quota(
    device_id: int,
    quota_data: schemas.BandwidthQuotaBase,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return DeviceService.set_quota(db, device_id, org_id, quota_data)


@router.delete(
    "/quotas/{device_id}",
    summary="Delete device quota",
    description="Remove bandwidth quota for a specific device.",
)
def delete_device_quota(
    device_id: int,
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    DeviceService.delete_quota(db, device_id, org_id)
    return {"status": "success"}


# --- Analytics Endpoints ---


@router.get(
    "/network/history",
    summary="Get network history",
    description="Retrieve historical network usage data.",
)
def get_network_history(
    skip: int = 0,
    limit: int = 60,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return AnalyticsService.get_network_history(db, limit)


@router.get(
    "/network/topology",
    summary="Get network topology",
    description="Retrieve network topology data.",
)
async def get_network_topology(
    db: Session = Depends(get_db),
    org_id: int = Depends(get_current_org_id),
):
    return AnalyticsService.get_topology(db, org_id)


@router.get(
    "/network/connections",
    summary="Get external connections",
    description="Retrieve current external connections.",
)
def get_external_connections(current_user: models.User = Depends(get_current_user)):
    return global_collector.get_external_connections()


@router.get(
    "/network/ip/{ip_address}",
    summary="Lookup IP",
    description="Get information about an IP address.",
)
def lookup_ip(
    ip_address: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return get_ip_info(ip_address)


@router.get(
    "/analytics/summary",
    summary="Get analytics summary",
    description="Retrieve a summary of network analytics.",
)
async def get_analytics_summary(current_user: models.User = Depends(get_current_user)):
    return global_collector.get_analytics_summary()


@router.get(
    "/analytics/packets",
    summary="Get packet log",
    description="Retrieve packet logs with optional filtering.",
)
def get_packet_log(
    limit: int = 100,
    protocol: str | None = None,
    ip: str | None = None,
    port: int | None = None,
    flags: str | None = None,
    current_user: models.User = Depends(get_current_user),
):
    return global_collector.get_packet_log(
        limit=limit, protocol=protocol, ip=ip, port=port, flags=flags
    )


@router.get(
    "/analytics/prediction",
    summary="Get usage prediction",
    description="Predict future network usage.",
)
def get_usage_prediction(current_user: models.User = Depends(get_current_user)):
    return ai_predictor.predict_total_usage()


@router.get(
    "/analytics/anomalies",
    summary="Get usage anomalies",
    description="Detect network usage anomalies.",
)
def get_usage_anomalies(current_user: models.User = Depends(get_current_user)):
    return ai_predictor.detect_anomalies()


@router.get(
    "/analytics/dns-logs",
    summary="Get DNS logs",
    description="Retrieve DNS query logs.",
)
def get_dns_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return LogService.get_dns_logs(db, skip, limit)


@router.get(
    "/analytics/device-logs",
    summary="Get device logs",
    description="Retrieve logs for a specific device.",
)
def get_device_logs(
    device_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return LogService.get_device_logs(db, device_id, skip, limit)


# --- Docker Endpoints ---


@router.get(
    "/docker/containers",
    summary="Get Docker containers",
    description="Retrieve status of all Docker containers.",
)
def get_docker_containers(current_user: models.User = Depends(get_current_user)):
    return docker_monitor.get_stats()


@router.get(
    "/docker/{container_id}/history",
    summary="Get container history",
    description="Retrieve historical stats for a container.",
)
def get_docker_container_history(
    container_id: str,
    minutes: int = 60,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return AnalyticsService.get_docker_history(db, container_id, minutes)


@router.get(
    "/docker/{container_id}/usage",
    summary="Get container usage",
    description="Retrieve current usage stats for a container.",
)
def get_docker_container_usage(
    container_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return AnalyticsService.get_docker_usage(db, container_id)


@router.get(
    "/docker/containers/{container_id}/logs",
    summary="Get container logs",
    description="Retrieve logs for a specific container.",
)
async def get_container_logs(
    container_id: str, tail: int = 100, current_user: models.User = Depends(get_current_user)
):
    return {"logs": docker_monitor.get_logs(container_id, tail)}


@router.post(
    "/docker/containers/{container_id}/action",
    summary="Container action",
    description="Perform an action (start/stop/restart) on a container.",
)
@limiter.limit("10/minute")
async def container_action(
    request: Request,
    container_id: str,
    payload: dict,
    admin_user: models.User = Depends(get_current_admin_user),
):
    action = payload.get("action")
    if action not in ["start", "stop", "restart"]:
        return {"success": False, "error": "Invalid action"}
    success = docker_monitor.perform_action(container_id, action)
    return {"success": success}


@router.post(
    "/docker/prune",
    summary="Prune containers",
    description="Remove unused Docker containers and images.",
)
@limiter.limit("5/minute")
def prune_containers(
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return docker_monitor.prune_containers()


# --- System Endpoints ---


@router.get(
    "/system/info",
    summary="Get system info",
    description="Retrieve general system information.",
)
def get_system_info(current_user: models.User = Depends(get_current_user)):
    info = system_stats.get_info()
    info["active_devices"] = len(global_collector.active_devices)
    return info


@router.get(
    "/system/processes",
    summary="Get system processes",
    description="Retrieve top system processes and container stats.",
)
def get_system_processes(current_user: models.User = Depends(get_current_user)):
    top_procs = system_stats.get_top_processes(limit=15)
    docker_stats = docker_monitor.get_stats()
    combined = []

    for p in top_procs:
        combined.append(
            {
                "id": f"p-{p['id']}",
                "name": p["name"],
                "cpu": round(p["cpu"], 1),
                "ram": round(p["ram"] / (1024 * 1024), 1),
                "type": "Process",
                "status": "running",
            }
        )

    for c in docker_stats:
        combined.append(
            {
                "id": f"d-{c['id']}",
                "name": c["name"],
                "cpu": round(c["cpu_pct"], 1),
                "ram": round(c["mem_usage"], 1),
                "type": "Container",
                "status": c["status"],
            }
        )
    return sorted(combined, key=lambda x: (x["cpu"], x["ram"]), reverse=True)


@router.get(
    "/system/network/history",
    summary="Get system network history",
    description="Retrieve historical system network usage.",
)
def get_system_network_history(
    hours: int = 24,
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.SystemNetworkHistory)
    if start and end:
        query = query.filter(
            models.SystemNetworkHistory.timestamp >= start,
            models.SystemNetworkHistory.timestamp <= end,
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
            "bytes_recv": h.bytes_recv,
        }
        for h in history
    ]


# --- Auth Endpoints ---


@router.post(
    "/auth/login",
    response_model=schemas.Token,
    summary="Login",
    description="Authenticate user and return a token.",
)
async def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
    remember_me: bool = Form(False),
):
    user = AuthService.authenticate_user(db, form_data.username, form_data.password)
    return AuthService.create_session(db, user, remember_me)


@router.post(
    "/auth/refresh",
    response_model=schemas.Token,
    summary="Refresh token",
    description="Refresh an expired access token.",
)
async def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    return AuthService.refresh_session(db, refresh_token)


@router.get(
    "/auth/me",
    response_model=schemas.User,
    summary="Get current user",
    description="Retrieve information about the currently authenticated user.",
)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post(
    "/auth/change-password",
    summary="Change password",
    description="Change the current user's password.",
)
async def change_password(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_password = payload.get("current_password")
    new_password = payload.get("new_password")
    if not current_password or not new_password:
        raise ValidationException("Missing passwords")
    AuthService.change_password(db, current_user, current_password, new_password)
    return {"status": "success", "message": "Password updated successfully"}


@router.post(
    "/auth/logout",
    summary="Logout",
    description="Logout the current user and invalidate the token.",
)
async def logout(refresh_token: str | None = None, db: Session = Depends(get_db)):
    AuthService.logout(db, refresh_token)
    return {"status": "success", "message": "Logged out successfully"}


# --- Admin Endpoints ---


@router.get(
    "/admin/users",
    response_model=list[schemas.User],
    summary="List users",
    description="Retrieve a list of all users.",
)
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return UserService.list_users(db, skip, limit)


@router.post(
    "/admin/users",
    response_model=schemas.User,
    summary="Create user",
    description="Create a new user.",
)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return UserService.create_user(db, user)


@router.put(
    "/admin/users/{user_id}",
    response_model=schemas.User,
    summary="Update user",
    description="Update an existing user.",
)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return UserService.update_user(db, user_id, user_update)


@router.delete(
    "/admin/users/{user_id}",
    summary="Delete user",
    description="Delete a user.",
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    UserService.delete_user(db, user_id, admin_user.id)
    return {"status": "success"}


# --- Groups Endpoints ---


@router.get(
    "/groups",
    response_model=list[schemas.DeviceGroup],
    summary="Get groups",
    description="Retrieve a list of all device groups.",
)
def get_groups(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    return db.query(models.DeviceGroup).all()


@router.post(
    "/groups",
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
    "/groups/{group_id}",
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
    "/groups/{group_id}",
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


# --- Settings Endpoints ---


@router.get(
    "/settings",
    response_model=list[schemas.SystemSetting],
    summary="Get settings",
    description="Retrieve all system settings.",
)
def get_settings(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    return db.query(models.SystemSettings).all()


@router.post(
    "/settings",
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
        db_setting = models.SystemSettings(**setting.dict())
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    if setting.key == "speedtest_interval":
        try:
            scheduler.schedule_speedtest(float(setting.value))
        except ValueError:
            pass
    return db_setting


# --- WebSocket Endpoints ---


@router.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            stats = global_collector.get_current_stats()
            data = {
                "timestamp": time.time(),
                "u": stats["u"],
                "d": stats["d"],
                "active_devices": stats["active_device_count"],
            }
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except (WebSocketDisconnect, ConnectionStateError):
        logger.debug("Live stats WebSocket disconnected")


@router.websocket("/ws/events")
async def events_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, ConnectionStateError):
        manager.disconnect(websocket)


# --- Other Endpoints ---


@router.get(
    "/health",
    summary="Health check",
    description="Check if the API is running.",
)
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get(
    "/alerts",
    summary="Get alerts",
    description="Retrieve security alerts.",
)
async def get_alerts(
    severity: str = None,
    timeframe: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    query = db.query(models.SecurityAlert)
    if severity:
        severities = severity.upper().split(",")
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
        query = query.filter(models.SecurityAlert.timestamp >= since)
    return query.order_by(models.SecurityAlert.timestamp.desc()).offset(skip).limit(limit).all()


@router.post(
    "/reports/test-email",
    summary="Send test email",
    description="Trigger a test email for scheduled reports.",
)
def send_test_email(to_email: str, current_user: models.User = Depends(get_current_user)):
    EmailService.send_daily_summary(to_email)
    return {"status": "success", "message": f"Test email sent to {to_email}"}


@router.get(
    "/speedtest",
    summary="Get speedtest history",
    description="Retrieve historical speedtest results.",
)
def get_speedtest_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.SpeedtestResult)
        .order_by(models.SpeedtestResult.timestamp.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post(
    "/speedtest",
    summary="Run speedtest",
    description="Trigger a new speedtest.",
)
@limiter.limit("5/minute")
async def run_speedtest(
    request: Request,
    server_id: int = None,
    provider: str = "ookla",
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user),
):
    return await speedtest_service.run_speedtest(db, server_id, provider)


@router.get(
    "/speedtest/servers",
    summary="Get speedtest servers",
    description="Retrieve available speedtest servers.",
)
def get_speedtest_servers(current_user: models.User = Depends(get_current_user)):
    return speedtest_service.get_servers()
