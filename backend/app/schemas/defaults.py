from datetime import datetime

from pydantic import BaseModel, field_validator


from typing import Generic, TypeVar, Any

T = TypeVar('T')

class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: int | str | None = None

class OffsetPage(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class DeviceBase(BaseModel):
    mac_address: str
    ip_address: str | None = None
    hostname: str | None = None
    vendor: str | None = None
    type: str | None = "Unknown"  # IoT, Mobile, PC
    nickname: str | None = None
    notes: str | None = None
    tags: list[str] | None = None
    group_id: int | None = None


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    nickname: str | None = None
    notes: str | None = None
    type: str | None = None
    tags: list[str] | None = None
    group_id: int | None = None


class Device(DeviceBase):
    id: int
    first_seen: datetime
    last_seen: datetime | None
    is_online: bool
    traffic_logs: list["TrafficLog"] = []

    @field_validator("tags", mode="before")
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
    description: str | None = None


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
    device_id: int | None = None
    is_resolved: bool = False


class SecurityAlert(SecurityAlertBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class SecurityRuleBase(BaseModel):
    name: str
    description: str | None = None
    condition: str
    action: str = "alert"
    is_active: bool = True

class SecurityRuleCreate(SecurityRuleBase):
    pass

class SecurityRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    condition: str | None = None
    action: str | None = None
    is_active: bool | None = None

class SecurityRule(SecurityRuleBase):
    id: int
    created_at: datetime
    organization_id: int | None = None

    class Config:
        from_attributes = True


class BandwidthQuotaBase(BaseModel):
    daily_limit_bytes: int | None = None
    monthly_limit_bytes: int | None = None


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
    color: str | None = "#3b82f6"


class DeviceGroupCreate(DeviceGroupBase):
    pass


class DeviceGroupUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class DeviceGroup(DeviceGroupBase):
    id: int

    class Config:
        from_attributes = True


class DnsLogBase(BaseModel):
    timestamp: datetime
    client_ip: str
    query_domain: str
    record_type: str
    device_id: int | None = None


class DnsLog(DnsLogBase):
    id: int

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str
    email: str
    full_name: str | None = None
    is_active: bool | None = True
    is_admin: bool | None = False
    must_change_password: bool = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    password: str | None = None
    is_active: bool | None = None
    is_admin: bool | None = None


class User(UserBase):
    id: int
    created_at: datetime
    last_login: datetime | None = None

    class Config:
        from_attributes = True



class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ContainerActionRequest(BaseModel):
    action: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str | None = None

class AuditLogBase(BaseModel):
    action: str
    resource_type: str
    resource_id: str | None = None
    details: str | None = None

class AuditLog(AuditLogBase):
    id: int
    actor_id: int | None = None
    organization_id: int | None = None
    timestamp: datetime

    class Config:
        from_attributes = True

class AuditLogResponse(AuditLog):
    actor: User | None = None

class AuditLogPaginated(BaseModel):
    items: list[AuditLogResponse]
    total: int