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
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db.database import Base


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

    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

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
    tags = Column(String, nullable=True)  # JSON list of strings
    group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=True)

    group = relationship("DeviceGroup", back_populates="devices")
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

    device = relationship("Device")


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


class SystemMonthlySummary(Base):
    """Aggregated monthly usage for the whole system"""

    __tablename__ = "system_monthly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String, index=True)  # YYYY-MM
    bytes_sent = Column(BigInteger, default=0)
    bytes_recv = Column(BigInteger, default=0)


class SystemYearlySummary(Base):
    """Aggregated yearly usage for the whole system"""

    __tablename__ = "system_yearly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, index=True)  # YYYY
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


class DeviceYearlySummary(Base):
    """Aggregated yearly usage for a device"""

    __tablename__ = "device_yearly_summaries"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    year = Column(Integer, index=True)  # YYYY
    upload_bytes = Column(BigInteger, default=0)
    download_bytes = Column(BigInteger, default=0)

    device = relationship("Device")
