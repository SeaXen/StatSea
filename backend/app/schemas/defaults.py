from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DeviceBase(BaseModel):
    mac_address: str
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    type: Optional[str] = "Unknown"  # IoT, Mobile, PC
    nickname: Optional[str] = None
    notes: Optional[str] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    nickname: Optional[str] = None
    notes: Optional[str] = None
    type: Optional[str] = None

class Device(DeviceBase):
    id: int
    first_seen: datetime
    last_seen: Optional[datetime]
    is_online: bool
    traffic_logs: List['TrafficLog'] = []

    class Config:
        from_attributes = True

class SystemSettingBase(BaseModel):
    key: str
    value: str
    type: str = "string"
    description: Optional[str] = None

class SystemSetting(SystemSettingBase):
    class Config:
        from_attributes = True

class TrafficLogBase(BaseModel):
    device_id: int
    timestamp: datetime
    upload_bytes: int
    download_bytes: int
    protocol: str = "TCP"
    app_category: str = "Unknown"

class TrafficLog(TrafficLogBase):
    id: int

    class Config:
        from_attributes = True

class SecurityAlertBase(BaseModel):
    severity: str
    title: str
    description: str
    device_id: Optional[int] = None
    is_resolved: bool = False

class SecurityAlert(SecurityAlertBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
