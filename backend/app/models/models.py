from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, BigInteger, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    mac_address = Column(String, unique=True, index=True)
    ip_address = Column(String, nullable=True)
    hostname = Column(String, nullable=True)
    vendor = Column(String, nullable=True)
    type = Column(String, default="Unknown")  # IoT, Mobile, PC
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), onupdate=func.now())
    is_online = Column(Boolean, default=False)

    traffic_logs = relationship("TrafficLog", back_populates="device")


class BandwidthHistory(Base):
    __tablename__ = "bandwidth_history"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    upload_bytes = Column(BigInteger, default=0)
    download_bytes = Column(BigInteger, default=0)

class LatencyLog(Base):
    __tablename__ = "latency_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
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
    device_id = Column(Integer, ForeignKey("devices.id"))
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
    duration = Column(Integer, nullable=True) # seconds

class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    severity = Column(String, default="info") # info, warning, critical
    title = Column(String)
    description = Column(String)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    is_resolved = Column(Boolean, default=False)

    device = relationship("Device")


class SystemSettings(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)
    type = Column(String, default="string") # string, int, float, bool, json
    description = Column(String, nullable=True)
