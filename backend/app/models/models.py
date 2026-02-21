import bcrypt
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db.database import Base



class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    plan_tier = Column(String, default="free")  # free, pro, enterprise
    subscription_status = Column(String, default="active")  # active, past_due, canceled
    stripe_customer_id = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    primary_color = Column(String, default="#000000")
    secondary_color = Column(String, default="#ffffff")
    custom_domain = Column(String, nullable=True, unique=True)
    default_language = Column(String, default="en")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="organization")
    api_keys = relationship("ApiKey", back_populates="organization")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), primary_key=True)
    role = Column(String, default="member")  # owner, admin, member, viewer

    user = relationship("User", back_populates="organizations")
    organization = relationship("Organization", back_populates="members")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key_hash = Column(String, index=True)
    name = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    permissions = Column(String, default="read")  # simple permission string or json
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    organization = relationship("Organization", back_populates="api_keys")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    preferred_language = Column(String, default="en")

    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    must_change_password = Column(Boolean, default=False)
    
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

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

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    expires_at = Column(DateTime(timezone=True), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_revoked = Column(Boolean, default=False)

    user = relationship("User", back_populates="refresh_tokens")


class DeviceGroup(Base):
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    color = Column(String, default="#3b82f6")

    devices = relationship("Device", back_populates="group")


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    mac_address = Column(String, unique=True, index=True)
    ip_address = Column(String, nullable=True)
    hostname = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    type = Column(String, default="Unknown")  # IoT, Mobile, PC
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_online = Column(Boolean, default=False)
    nickname = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)  # JSON list of strings
    group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

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


class BandwidthQuota(Base):
    __tablename__ = "bandwidth_quotas"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), unique=True)
    daily_limit_bytes = Column(BigInteger, nullable=True)
    monthly_limit_bytes = Column(BigInteger, nullable=True)

    device = relationship("Device", back_populates="quota")


class DeviceDailySummary(Base):
    __tablename__ = "device_daily_summaries"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    date = Column(Date, index=True)
    upload_bytes = Column(BigInteger, default=0)
    download_bytes = Column(BigInteger, default=0)

    device = relationship("Device", back_populates="daily_summaries")
    
    __table_args__ = (
        UniqueConstraint("device_id", "date", name="uix_device_date"),
    )


class BandwidthHistory(Base):
    __tablename__ = "bandwidth_history"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    upload_bytes = Column(BigInteger, default=0)
    download_bytes = Column(BigInteger, default=0)


class LatencyLog(Base):
    __tablename__ = "latency_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    target = Column(String, index=True)
    latency_ms = Column(Float, nullable=True)


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    event_type = Column(String, index=True)  # PORT_SCAN, ROGUE_DHCP, NEW_DEVICE
    severity = Column(String)  # LOW, MEDIUM, HIGH, CRITICAL
    description = Column(String)
    source_ip = Column(String, nullable=True)
    mac_address = Column(String, nullable=True)
    resolved = Column(Boolean, default=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)


class TrafficLog(Base):
    __tablename__ = "traffic_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    upload_bytes = Column(BigInteger, default=0)
    download_bytes = Column(BigInteger, default=0)
    protocol = Column(String, default="TCP")
    app_category = Column(String, default="Unknown")

    device = relationship("Device", back_populates="traffic_logs")


class Outage(Base):
    __tablename__ = "outages"

    id = Column(Integer, primary_key=True, index=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Integer, nullable=True)  # seconds


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    severity = Column(String, default="info")  # info, warning, critical
    title = Column(String)
    description = Column(String)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True)
    is_resolved = Column(Boolean, default=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

    device = relationship("Device")


class SecurityRule(Base):
    __tablename__ = "security_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    condition = Column(String)  # E.g. "bandwidth > 1GB"
    action = Column(String, default="alert") # alert, block
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)


class SystemSettings(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)
    type = Column(String, default="string")  # string, int, float, bool, json
    description = Column(String, nullable=True)


class SpeedtestResult(Base):
    __tablename__ = "speedtest_results"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    ping = Column(Float)  # ms
    download = Column(Float)  # Mbps
    upload = Column(Float)  # Mbps
    server_id = Column(Integer, nullable=True)
    server_name = Column(String, nullable=True)
    server_country = Column(String, nullable=True)
    provider = Column(String, default="ookla")  # ookla, cloudflare
    isp = Column(String, nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)


class DockerContainerMetric(Base):
    __tablename__ = "docker_metrics"

    id = Column(Integer, primary_key=True, index=True)
    container_id = Column(String, index=True)
    container_name = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    cpu_pct = Column(Float)
    mem_usage = Column(Float)  # MB
    net_rx = Column(BigInteger)
    net_tx = Column(BigInteger)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)


class DeviceStatusLog(Base):
    __tablename__ = "device_status_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    status = Column(String, index=True)  # 'online' or 'offline'
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    device = relationship("Device", back_populates="status_logs")


class SystemNetworkHistory(Base):
    """vnstat-like total interface usage history"""

    __tablename__ = "system_network_history"

    id = Column(Integer, primary_key=True, index=True)
    interface = Column(String, index=True)  # e.g., eth0, wlan0
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    bytes_sent = Column(BigInteger)
    bytes_recv = Column(BigInteger)
    packets_sent = Column(BigInteger)
    packets_recv = Column(BigInteger)


class DnsLog(Base):
    """Log of DNS queries captured by the collector"""

    __tablename__ = "dns_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    client_ip = Column(String, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    query_domain = Column(String, index=True)
    record_type = Column(String)  # A, AAAA, CNAME, etc.
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

    device = relationship("Device")


class SystemDailySummary(Base):
    """Aggregated daily usage for the whole system"""

    __tablename__ = "system_daily_summaries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True, unique=True)
    bytes_sent = Column(BigInteger, default=0)
    bytes_recv = Column(BigInteger, default=0)
    packets_sent = Column(BigInteger, default=0)
    packets_recv = Column(BigInteger, default=0)


class SystemInterfaceDailySummary(Base):
    """Aggregated daily usage for a specific system interface"""

    __tablename__ = "system_interface_daily_summaries"

    id = Column(Integer, primary_key=True, index=True)
    interface = Column(String, index=True)
    date = Column(Date, index=True)
    bytes_sent = Column(BigInteger, default=0)
    bytes_recv = Column(BigInteger, default=0)
    packets_sent = Column(BigInteger, default=0)
    packets_recv = Column(BigInteger, default=0)


class SystemInterfaceMonthlySummary(Base):
    """Aggregated monthly usage for a specific system interface"""

    __tablename__ = "system_interface_monthly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    interface = Column(String, index=True)
    month = Column(String, index=True)  # YYYY-MM
    bytes_sent = Column(BigInteger, default=0)
    bytes_recv = Column(BigInteger, default=0)


class SystemMonthlySummary(Base):
    """Aggregated monthly usage for the whole system"""

    __tablename__ = "system_monthly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, index=True, unique=True)  # YYYY-MM
    bytes_sent = Column(BigInteger, default=0)
    bytes_recv = Column(BigInteger, default=0)


class SystemYearlySummary(Base):
    """Aggregated yearly usage for the whole system"""

    __tablename__ = "system_yearly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, index=True, unique=True)  # YYYY
    bytes_sent = Column(BigInteger, default=0)
    bytes_recv = Column(BigInteger, default=0)


class DeviceMonthlySummary(Base):
    """Aggregated monthly usage for a device"""

    __tablename__ = "device_monthly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    month = Column(String, index=True)  # YYYY-MM
    upload_bytes = Column(BigInteger, default=0)
    download_bytes = Column(BigInteger, default=0)

    device = relationship("Device")
    
    __table_args__ = (
        UniqueConstraint("device_id", "month", name="uix_device_month"),
    )


class DeviceYearlySummary(Base):
    """Aggregated yearly usage for a device"""

    __tablename__ = "device_yearly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    year = Column(Integer, index=True)  # YYYY
    upload_bytes = Column(BigInteger, default=0)
    download_bytes = Column(BigInteger, default=0)


    device = relationship("Device")

    __table_args__ = (
        UniqueConstraint("device_id", "year", name="uix_device_year"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, index=True)  # CREATE, UPDATE, DELETE, LOGIN
    resource_type = Column(String, index=True)  # DEVICE, USER, ORG
    resource_id = Column(String, nullable=True)
    details = Column(String, nullable=True)  # JSON or text
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("User")
    organization = relationship("Organization")


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    type = Column(String)  # email, slack, discord, webhook
    config = Column(String)  # JSON: webhook_url, email_address, etc.
    events = Column(String, default="[]")  # JSON list: trigger events
    is_enabled = Column(Boolean, default=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    organization = relationship("Organization")


class StatusPage(Base):
    __tablename__ = "status_pages"
    
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True)  # public url slug
    title = Column(String)
    description = Column(String, nullable=True)
    is_public = Column(Boolean, default=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    organization = relationship("Organization")


class PushSubscription(Base):
    """Stores Web Push API subscriptions for PWA notifications"""
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String, unique=True, index=True)
    keys = Column(String)  # JSON string {"auth": "...", "p256dh": "..."}
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="push_subscriptions")

