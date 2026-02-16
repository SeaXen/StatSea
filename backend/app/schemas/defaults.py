from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DeviceBase(BaseModel):
    mac_address: str
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    type: Optional[str] = "Unknown"  # IoT, Mobile, PC

class DeviceCreate(DeviceBase):
    pass

class Device(DeviceBase):
    id: int
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    is_online: bool = False

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
