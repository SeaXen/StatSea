from pydantic import BaseModel, field_validator
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
    tags: Optional[List[str]] = []
    group_id: Optional[int] = None

class DeviceCreate(DeviceBase):
    pass

class DeviceUpdate(BaseModel):
    nickname: Optional[str] = None
    notes: Optional[str] = None
    type: Optional[str] = None
    tags: Optional[List[str]] = None
    group_id: Optional[int] = None

class Device(DeviceBase):
    id: int
    first_seen: datetime
    last_seen: Optional[datetime]
    is_online: bool
    traffic_logs: List['TrafficLog'] = []

    @field_validator('tags', mode='before')
    def parse_tags(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except ValueError:
                return []
        return v

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

class BandwidthQuotaBase(BaseModel):
    daily_limit_bytes: Optional[int] = None
    monthly_limit_bytes: Optional[int] = None

class BandwidthQuotaCreate(BandwidthQuotaBase):
    device_id: int

class BandwidthQuota(BandwidthQuotaBase):
    id: int
    device_id: int
    
    class Config:
        from_attributes = True

class DeviceStatusLogBase(BaseModel):
    device_id: int
    status: str
    timestamp: datetime

class DeviceStatusLog(DeviceStatusLogBase):
    id: int

    class Config:
        from_attributes = True

class DeviceGroupBase(BaseModel):
    name: str
    color: Optional[str] = "#3b82f6"

class DeviceGroupCreate(DeviceGroupBase):
    pass

class DeviceGroupUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class DeviceGroup(DeviceGroupBase):
    id: int

    class Config:
        from_attributes = True
    class Config:
        from_attributes = True

class DnsLogBase(BaseModel):
    timestamp: datetime
    client_ip: str
    query_domain: str
    record_type: str
    device_id: Optional[int] = None

class DnsLog(DnsLogBase):
    id: int

    class Config:
        from_attributes = True
