from datetime import date, datetime

import bcrypt
from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from ..db.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    plan_tier: Mapped[str] = mapped_column(String, default="free")  # free, pro, enterprise
    subscription_status: Mapped[str] = mapped_column(String, default="active")  # active, past_due, canceled
    stripe_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_color: Mapped[str] = mapped_column(String, default="#000000")
    secondary_color: Mapped[str] = mapped_column(String, default="#ffffff")
    custom_domain: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    default_language: Mapped[str] = mapped_column(String, default="en")
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="organization")
    api_keys = relationship("ApiKey", back_populates="organization")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String, default="member")  # owner, admin, member, viewer

    user = relationship("User", back_populates="organizations")
    organization = relationship("Organization", back_populates="members")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key_hash: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"))
    permissions: Mapped[str] = mapped_column(String, default="read")  # simple permission string or json
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user = relationship("User")
    organization = relationship("Organization", back_populates="api_keys")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String, default="en")

    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    token_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    organizations = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")

    def verify_password(self, password: str):
        return bcrypt.checkpw(password.encode("utf-8"), self.hashed_password.encode("utf-8"))

    @staticmethod
    def get_password_hash(password: str):
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    token: Mapped[str] = mapped_column(String, unique=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)

    user = relationship("User", back_populates="refresh_tokens")


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    color: Mapped[str] = mapped_column(String, default="#3b82f6")

    devices = relationship("Device", back_populates="group")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mac_address: Mapped[str] = mapped_column(String, unique=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    hostname: Mapped[str | None] = mapped_column(String, nullable=True)
    vendor: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String, default="Unknown")  # IoT, Mobile, PC
    first_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    nickname: Mapped[str | None] = mapped_column(String, nullable=True)
    icon_type: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # JSON list of strings
    group_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("device_groups.id"), nullable=True)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    group = relationship("DeviceGroup", back_populates="devices")
    organization = relationship("Organization", back_populates="devices")
    traffic_logs = relationship("TrafficLog", back_populates="device")
    daily_summaries = relationship("DeviceDailySummary", back_populates="device")
    quota = relationship(
        "BandwidthQuota", uselist=False, back_populates="device", cascade="all, delete-orphan"
    )
    status_logs = relationship(
        "DeviceStatusLog", back_populates="device", cascade="all, delete-orphan"
    )
    ports = relationship(
        "DevicePort", back_populates="device", cascade="all, delete-orphan"
    )


class DevicePort(Base):
    __tablename__ = "device_ports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"))
    port: Mapped[int] = mapped_column(Integer, index=True)
    protocol: Mapped[str] = mapped_column(String, default="TCP") # TCP, UDP
    service: Mapped[str | None] = mapped_column(String, nullable=True) # ssh, http, etc.
    state: Mapped[str] = mapped_column(String, default="open") # open, closed, filtered
    last_discovered: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    device = relationship("Device", back_populates="ports")


class BandwidthQuota(Base):
    __tablename__ = "bandwidth_quotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"), unique=True)
    daily_limit_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    monthly_limit_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    device = relationship("Device", back_populates="quota")


class DeviceDailySummary(Base):
    __tablename__ = "device_daily_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"))
    date: Mapped[date] = mapped_column(Date, index=True)
    upload_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    download_bytes: Mapped[int] = mapped_column(BigInteger, default=0)

    device = relationship("Device", back_populates="daily_summaries")
    
    __table_args__ = (
        UniqueConstraint("device_id", "date", name="uix_device_date"),
    )


class BandwidthHistory(Base):
    __tablename__ = "bandwidth_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    upload_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    download_bytes: Mapped[int] = mapped_column(BigInteger, default=0)


class LatencyLog(Base):
    __tablename__ = "latency_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    target: Mapped[str] = mapped_column(String, index=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    event_type: Mapped[str] = mapped_column(String, index=True)  # PORT_SCAN, ROGUE_DHCP, NEW_DEVICE
    severity: Mapped[str] = mapped_column(String)  # LOW, MEDIUM, HIGH, CRITICAL
    description: Mapped[str] = mapped_column(String)
    source_ip: Mapped[str | None] = mapped_column(String, nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
class TrafficLog(Base):
    __tablename__ = "traffic_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"), index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    upload_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    download_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    protocol: Mapped[str] = mapped_column(String, default="TCP")
    app_category: Mapped[str] = mapped_column(String, default="Unknown")

    device = relationship("Device", back_populates="traffic_logs")


class Outage(Base):
    __tablename__ = "outages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)  # seconds


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    severity: Mapped[str] = mapped_column(String, default="info")  # info, warning, critical
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    device_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("devices.id"), nullable=True, index=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    device = relationship("Device")


class SecurityRule(Base):
    __tablename__ = "security_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    condition: Mapped[str] = mapped_column(String)  # E.g. "bandwidth > 1GB"
    action: Mapped[str] = mapped_column(String, default="alert") # alert, block
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
class SystemSettings(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    value: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String, default="string")  # string, int, float, bool, json
    description: Mapped[str | None] = mapped_column(String, nullable=True)


class SpeedtestResult(Base):
    __tablename__ = "speedtest_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    ping: Mapped[float] = mapped_column(Float)  # ms
    download: Mapped[float] = mapped_column(Float)  # Mbps
    upload: Mapped[float] = mapped_column(Float)  # Mbps
    server_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    server_name: Mapped[str | None] = mapped_column(String, nullable=True)
    server_country: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str] = mapped_column(String, default="ookla")  # ookla, cloudflare
    isp: Mapped[str | None] = mapped_column(String, nullable=True)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
class DockerContainerMetric(Base):
    __tablename__ = "docker_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    container_id: Mapped[str] = mapped_column(String, index=True)
    container_name: Mapped[str] = mapped_column(String)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    cpu_pct: Mapped[float] = mapped_column(Float)
    mem_usage: Mapped[float] = mapped_column(Float)  # MB
    net_rx: Mapped[int] = mapped_column(BigInteger)
    net_tx: Mapped[int] = mapped_column(BigInteger)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
class DeviceStatusLog(Base):
    __tablename__ = "device_status_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"))
    status: Mapped[str] = mapped_column(String, index=True)  # 'online' or 'offline'
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    device = relationship("Device", back_populates="status_logs")


class SystemNetworkHistory(Base):
    """vnstat-like total interface usage history"""

    __tablename__ = "system_network_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    interface: Mapped[str] = mapped_column(String, index=True)  # e.g., eth0, wlan0
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    bytes_sent: Mapped[int] = mapped_column(BigInteger)
    bytes_recv: Mapped[int] = mapped_column(BigInteger)
    packets_sent: Mapped[int] = mapped_column(BigInteger)
    packets_recv: Mapped[int] = mapped_column(BigInteger)


class DnsLog(Base):
    """Log of DNS queries captured by the collector"""

    __tablename__ = "dns_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    client_ip: Mapped[str] = mapped_column(String, index=True)
    device_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("devices.id"), nullable=True)
    query_domain: Mapped[str] = mapped_column(String, index=True)
    record_type: Mapped[str] = mapped_column(String)  # A, AAAA, CNAME, etc.
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    device = relationship("Device")


class SystemDailySummary(Base):
    """Aggregated daily usage for the whole system"""

    __tablename__ = "system_daily_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, index=True, unique=True)
    bytes_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    bytes_recv: Mapped[int] = mapped_column(BigInteger, default=0)
    packets_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    packets_recv: Mapped[int] = mapped_column(BigInteger, default=0)


class SystemInterfaceDailySummary(Base):
    """Aggregated daily usage for a specific system interface"""

    __tablename__ = "system_interface_daily_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    interface: Mapped[str] = mapped_column(String, index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    bytes_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    bytes_recv: Mapped[int] = mapped_column(BigInteger, default=0)
    packets_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    packets_recv: Mapped[int] = mapped_column(BigInteger, default=0)


class SystemInterfaceMonthlySummary(Base):
    """Aggregated monthly usage for a specific system interface"""

    __tablename__ = "system_interface_monthly_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    interface: Mapped[str] = mapped_column(String, index=True)
    month: Mapped[str] = mapped_column(String, index=True)  # YYYY-MM
    bytes_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    bytes_recv: Mapped[int] = mapped_column(BigInteger, default=0)


class SystemMonthlySummary(Base):
    """Aggregated monthly usage for the whole system"""

    __tablename__ = "system_monthly_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    month: Mapped[str] = mapped_column(String, index=True, unique=True)  # YYYY-MM
    bytes_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    bytes_recv: Mapped[int] = mapped_column(BigInteger, default=0)


class SystemYearlySummary(Base):
    """Aggregated yearly usage for the whole system"""

    __tablename__ = "system_yearly_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    year: Mapped[int] = mapped_column(Integer, index=True, unique=True)  # YYYY
    bytes_sent: Mapped[int] = mapped_column(BigInteger, default=0)
    bytes_recv: Mapped[int] = mapped_column(BigInteger, default=0)


class DeviceMonthlySummary(Base):
    """Aggregated monthly usage for a device"""

    __tablename__ = "device_monthly_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"))
    month: Mapped[str] = mapped_column(String, index=True)  # YYYY-MM
    upload_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    download_bytes: Mapped[int] = mapped_column(BigInteger, default=0)

    device = relationship("Device")
    
    __table_args__ = (
        UniqueConstraint("device_id", "month", name="uix_device_month"),
    )


class DeviceYearlySummary(Base):
    """Aggregated yearly usage for a device"""

    __tablename__ = "device_yearly_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(Integer, ForeignKey("devices.id"))
    year: Mapped[int] = mapped_column(Integer, index=True)  # YYYY
    upload_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    download_bytes: Mapped[int] = mapped_column(BigInteger, default=0)


    device = relationship("Device")

    __table_args__ = (
        UniqueConstraint("device_id", "year", name="uix_device_year"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, index=True)  # CREATE, UPDATE, DELETE, LOGIN
    resource_type: Mapped[str] = mapped_column(String, index=True)  # DEVICE, USER, ORG
    resource_id: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON or text
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actor = relationship("User")
    organization = relationship("Organization")


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)  # email, slack, discord, webhook
    config: Mapped[str] = mapped_column(String)  # JSON: webhook_url, email_address, etc.
    events: Mapped[str] = mapped_column(String, default="[]")  # JSON list: trigger events
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"), index=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    organization = relationship("Organization")


class StatusPage(Base):
    __tablename__ = "status_pages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String, unique=True, index=True)  # public url slug
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"), unique=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    organization = relationship("Organization")


class PushSubscription(Base):
    """Stores Web Push API subscriptions for PWA notifications"""
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    endpoint: Mapped[str] = mapped_column(String, unique=True, index=True)
    keys: Mapped[str] = mapped_column(String)  # JSON string {"auth": "...", "p256dh": "..."}
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="push_subscriptions")


class OSMetricHistory(Base):
    __tablename__ = "os_metric_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    cpu_pct: Mapped[float] = mapped_column(Float)
    ram_used_gb: Mapped[float] = mapped_column(Float)
    ram_total_gb: Mapped[float] = mapped_column(Float)
    disk_used_gb: Mapped[float] = mapped_column(Float)
    disk_total_gb: Mapped[float] = mapped_column(Float)


class HealthCheck(Base):
    __tablename__ = "health_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String)
    url: Mapped[str] = mapped_column(String)
    method: Mapped[str] = mapped_column(String, default="GET")  # GET, POST
    interval_seconds: Mapped[int] = mapped_column(Integer, default=300) # Default 5 mins
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_checked: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    logs = relationship("HealthCheckLog", back_populates="check", cascade="all, delete-orphan")


class HealthCheckLog(Base):
    __tablename__ = "health_check_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    check_id: Mapped[int] = mapped_column(Integer, ForeignKey("health_checks.id"))
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_up: Mapped[bool] = mapped_column(Boolean)
    error: Mapped[str | None] = mapped_column(String, nullable=True)

    check = relationship("HealthCheck", back_populates="logs")


class BackupRecord(Base):
    __tablename__ = "backup_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String, unique=True)
    file_path: Mapped[str] = mapped_column(String)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)


class MonitoredCertificate(Base):
    __tablename__ = "monitored_certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    domain: Mapped[str] = mapped_column(String, index=True)
    port: Mapped[int] = mapped_column(Integer, default=443)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_checked: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiration_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    issuer: Mapped[str | None] = mapped_column(String, nullable=True)
    days_until_expiration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
class AgentNode(Base):
    __tablename__ = "agent_nodes"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String)
    api_key_hash: Mapped[str] = mapped_column(String, index=True)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="offline") # 'online', 'offline'
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    system_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    organization_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    organization = relationship("Organization")
    metrics = relationship("AgentMetric", back_populates="agent", cascade="all, delete-orphan")

class AgentMetric(Base):
    __tablename__ = "agent_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agent_nodes.id"), index=True)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    cpu_pct: Mapped[float] = mapped_column(Float)
    mem_usage: Mapped[float] = mapped_column(Float) # MB
    disk_usage: Mapped[float] = mapped_column(Float) # Percent
    net_rx: Mapped[int] = mapped_column(BigInteger, default=0)
    net_tx: Mapped[int] = mapped_column(BigInteger, default=0)

    agent = relationship("AgentNode", back_populates="metrics")

