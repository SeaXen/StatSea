import asyncio
import collections
import concurrent.futures
import ipaddress
import random
import threading
import time
from datetime import datetime, timezone, timedelta

try:
    from scapy.all import DNS, IP, TCP, UDP, Raw, sniff

    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

import requests
import sqlalchemy.exc
from mac_vendor_lookup import MacLookup

from ..core.config import settings as app_settings
from ..core.logging import get_logger
from ..db.database import SessionLocal
from ..models.models import (
    BandwidthHistory,
    Device,
    DeviceDailySummary,
    DeviceStatusLog,
    DnsLog,
    Organization,
    SecurityAlert,
    TrafficLog,
)
from ..services.notification_service import NotificationService

# Initialize MacLookup (this loads the local OUI list)
mac_lookup = MacLookup()


# Setup logging
logger = get_logger("Collector")


def extract_sni(payload: bytes) -> str | None:
    """Fast, lightweight SNI extractor from TLS ClientHello without full Scapy overhead."""
    if len(payload) < 43 or payload[0] != 0x16 or payload[5] != 0x01:
        return None
    try:
        session_id_len = payload[43]
        pos = 44 + session_id_len
        cipher_suites_len = int.from_bytes(payload[pos:pos+2], 'big')
        pos += 2 + cipher_suites_len
        comp_methods_len = payload[pos]
        pos += 1 + comp_methods_len
        extensions_len = int.from_bytes(payload[pos:pos+2], 'big')
        pos += 2
        
        end = pos + extensions_len
        while pos < end:
            ext_type = int.from_bytes(payload[pos:pos+2], 'big')
            ext_len = int.from_bytes(payload[pos+2:pos+4], 'big')
            pos += 4
            if ext_type == 0:  # Server Name Indication
                name_len = int.from_bytes(payload[pos+3:pos+5], 'big')
                return payload[pos+5:pos+5+name_len].decode('utf-8', errors='ignore')
            pos += ext_len
    except (IndexError, ValueError) as err:
        logger.debug("SNI extraction skipped: %s", err)
    return None

APP_CATEGORY_MAP = [
    ("netflix.com", "Netflix"),
    ("nflxvideo.net", "Netflix"),
    ("youtube.com", "YouTube"),
    ("googlevideo.com", "YouTube"),
    ("facebook.com", "Facebook"),
    ("fbcdn.net", "Facebook"),
    ("instagram.com", "Instagram"),
    ("steampowered.com", "Steam"),
    ("steamcontent.com", "Steam"),
    ("amazon.com", "Amazon"),
    ("aws.amazon.com", "Amazon"),
    ("discord.com", "Discord"),
    ("discord.gg", "Discord"),
    ("discordapp.net", "Discord"),
    ("apple.com", "Apple"),
    ("icloud.com", "Apple"),
    ("microsoft.com", "Microsoft"),
    ("windowsupdate.com", "Microsoft"),
    ("spotify.com", "Spotify"),
    ("github.com", "GitHub"),
    ("twitter.com", "Twitter"),
    ("x.com", "Twitter"),
    ("twitch.tv", "Twitch"),
]

def categorize_domain(domain: str) -> str:
    for suffix, category in APP_CATEGORY_MAP:
        if domain.endswith(suffix):
            return category
    return "Web Browsing"


class PacketCollector:
    """
    Core engine for network telemetry capture and aggregation.
    """

    def __init__(self):
        self.active_devices: dict[str, dict] = {}  # MAC -> metadata
        self.external_connections: dict[str, dict] = {}  # IP -> geo info
        self.geoip_cache: dict[str, dict] = {}
        self.stats_lock = threading.Lock()
        self.running = False
        self.is_synthetic = False
        self.interface = None
        self.upload_acc = 0
        self.download_acc = 0
        self.total_upload_bytes = 0
        self.total_download_bytes = 0
        self.interval_upload = 0
        self.interval_download = 0
        self._last_rate_ts = time.time()
        self.current_upload_rate = 0.0
        self.current_download_rate = 0.0
        self._geoip_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
        self._last_persist_upload = 0
        self._last_persist_download = 0
        self._thread = None
        self._persistence_thread = None
        self.flush_interval = 30  # seconds
        self.event_callback = None
        self._loop = None
        # --- Advanced Analytics ---
        self.protocol_counts: dict[str, int] = {}  # protocol -> count
        self.device_traffic: dict[str, dict] = {}  # MAC -> {upload, download, hostname}
        self.total_packets = 0
        self.total_bytes = 0
        self.packets_per_sec = 0.0
        self.suspicious_count = 0
        self._last_pps_time = time.time()
        self._pps_packet_count = 0
        self.PACKET_LOG_SIZE = 1000
        self.packet_log = collections.deque(maxlen=self.PACKET_LOG_SIZE)  # O(1) bounded ring buffer
        # --- Extended Analytics ---
        self.bandwidth_history: list[dict] = []  # ring buffer of {time, up, down}
        self.BANDWIDTH_HISTORY_SIZE = 60  # 60 snapshots = ~2 minutes at 2s interval
        self._bw_snapshot_up = 0
        self._bw_snapshot_down = 0
        self._last_bw_snapshot = time.time()
        self.packet_size_buckets: dict[str, int] = {
            "tiny (<128B)": 0,
            "small (128-512B)": 0,
            "medium (512-1024B)": 0,
            "large (1024B+)": 0,
        }
        self.dns_queries = 0
        self.http_requests = 0
        self.active_sessions: dict[str, float] = {}  # session_key -> last_seen
        self.SESSION_TIMEOUT = 30  # seconds
        self.connection_types: dict[str, int] = {"internal": 0, "external": 0}
        self.bytes_per_protocol: dict[str, int] = {}  # protocol -> total bytes

        # Buffer for DB persistence (MAC -> {upload, download})
        # This resets after every flush to DB
        self.daily_traffic_buffer: dict[str, dict] = {}

        # Buffer for DNS logs (list of dicts)
        self.dns_log_buffer: list[dict] = []
        self.DNS_BUFFER_SIZE = 50  # Flush when it hits this size

        # DPI Analytics
        self.ip_app_map: dict[str, dict] = {} # ip -> {"app": category, "last_seen": time}
        # MAC -> Category -> {upload, download}
        self.app_traffic_buffer: dict[str, dict[str, dict[str, int]]] = {}

    def set_event_callback(self, callback):
        """Sets the callback for broadcasting events."""
        self.event_callback = callback
        try:
            self._loop = asyncio.get_running_loop()
        except RuntimeError:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)

    def start(self, interface: str | None = None):
        """Starts the sniffing thread."""
        if self.running:
            return

        self.running = True
        self.interface = interface or app_settings.MONITOR_INTERFACE
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

        self._persistence_thread = threading.Thread(target=self._persistence_loop, daemon=True)
        self._persistence_thread.start()

        logger.info(f"Collector started on interface: {self.interface or 'default'}")

    def stop(self):
        """Stops sniffing and persistence threads and cleans up resources."""
        self.running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        if self._persistence_thread and self._persistence_thread.is_alive():
            self._persistence_thread.join(timeout=2.0)
        if hasattr(self, "_geoip_executor"):
            self._geoip_executor.shutdown(wait=False)

    def _packet_callback(self, packet):
        """Processes each captured packet."""
        try:
            if not packet.haslayer(IP):
                return

            packet_len = len(packet)
            src_ip = packet[IP].src
            dst_ip = packet[IP].dst

            # Determine protocol
            proto = "OTHER"
            src_port = 0
            dst_port = 0
            flags = None

            if packet.haslayer(TCP):
                proto = "TCP"
                src_port = packet[TCP].sport
                dst_port = packet[TCP].dport
                # Extract flags (S, A, F, R, P, U, E, C)
                # packet[TCP].flags is a FlagValue object, cast to str
                flags = str(packet[TCP].flags)

                # Refine by well-known ports
                if dst_port == 443 or src_port == 443:
                    proto = "HTTPS"
                    if packet.haslayer(Raw) and dst_port == 443:
                        payload = bytes(packet[Raw].load)
                        sni = extract_sni(payload)
                        if sni:
                            category = categorize_domain(sni)
                            with self.stats_lock:
                                self.ip_app_map[dst_ip] = {"app": category, "last_seen": time.time()}
                elif dst_port == 80 or src_port == 80:
                    proto = "HTTP"
                elif dst_port == 22 or src_port == 22:
                    proto = "SSH"
                elif dst_port == 21 or src_port == 21:
                    proto = "FTP"
            elif packet.haslayer(UDP):
                proto = "UDP"
                src_port = packet[UDP].sport
                dst_port = packet[UDP].dport
                if dst_port == 53 or src_port == 53:
                    proto = "DNS"
                    # Parse DNS query if possible
                    try:
                        if packet.haslayer(DNS) and packet[DNS].qr == 0:  # Query
                            qd = packet[DNS].qd
                            if qd:
                                qname = (
                                    qd.qname.decode("utf-8")
                                    if isinstance(qd.qname, bytes)
                                    else str(qd.qname)
                                )
                                # Remove trailing dot
                                if qname.endswith("."):
                                    qname = qname[:-1]

                                qtype = qd.qtype
                                # Map common qtypes
                                type_map = {
                                    1: "A",
                                    28: "AAAA",
                                    5: "CNAME",
                                    15: "MX",
                                    16: "TXT",
                                    12: "PTR",
                                }
                                record_type = type_map.get(qtype, str(qtype))

                                with self.stats_lock:
                                    self.dns_log_buffer.append(
                                        {
                                            "timestamp": datetime.now(timezone.utc),
                                            "client_ip": src_ip,
                                            "query_domain": qname,
                                            "record_type": record_type,
                                        }
                                    )
                                    if len(self.dns_log_buffer) > 10000:
                                        self.dns_log_buffer.pop(0)
                    except Exception as err:
                        logger.debug("Malformed DNS packet skipped: %s", err)
            elif packet[IP].proto == 1:
                proto = "ICMP"

            with self.stats_lock:
                # App Category deduction
                app_category = "Web Browsing"
                if proto == "SSH":
                    app_category = "SSH"
                elif proto == "FTP":
                    app_category = "FTP"
                elif proto == "DNS":
                    app_category = "DNS"
                
                # Check mapping for DPI
                if dst_ip in self.ip_app_map:
                    app_category = self.ip_app_map[dst_ip]["app"]
                    self.ip_app_map[dst_ip]["last_seen"] = time.time()
                elif src_ip in self.ip_app_map:
                    app_category = self.ip_app_map[src_ip]["app"]
                    self.ip_app_map[src_ip]["last_seen"] = time.time()
                
                # 1. Track Source (Upload from device)
                if packet.src:
                    src_mac = packet.src
                    # Ensure device is tracked
                    if src_mac not in self.active_devices:
                        self.active_devices[src_mac] = {"last_seen": time.time(), "ip": src_ip}
                    else:
                        self.active_devices[src_mac]["last_seen"] = time.time()
                        self.active_devices[src_mac]["ip"] = src_ip  # Update IP if changed

                    if src_mac not in self.device_traffic:
                        self.device_traffic[src_mac] = {"upload": 0, "download": 0, "ip": src_ip}

                    self.device_traffic[src_mac]["upload"] += packet_len
                    self.upload_acc += packet_len
                    self.total_upload_bytes += packet_len
                    self.interval_upload += packet_len

                    # Buffer for persistence
                    if src_mac not in self.daily_traffic_buffer:
                        self.daily_traffic_buffer[src_mac] = {"upload": 0, "download": 0}
                    self.daily_traffic_buffer[src_mac]["upload"] += packet_len

                    # Buffer for DPI TrafficLog
                    if src_mac not in self.app_traffic_buffer:
                        self.app_traffic_buffer[src_mac] = {}
                    if app_category not in self.app_traffic_buffer[src_mac]:
                        self.app_traffic_buffer[src_mac][app_category] = {"upload": 0, "download": 0}
                    self.app_traffic_buffer[src_mac][app_category]["upload"] += packet_len

                # 2. Track Destination (Download to device)
                if packet.dst:
                    dst_mac = packet.dst
                    if dst_mac in self.active_devices:
                        self.device_traffic[dst_mac]["download"] += packet_len
                        self.download_acc += packet_len
                        self.total_download_bytes += packet_len
                        self.interval_download += packet_len

                        if dst_mac not in self.daily_traffic_buffer:
                            self.daily_traffic_buffer[dst_mac] = {"upload": 0, "download": 0}
                        self.daily_traffic_buffer[dst_mac]["download"] += packet_len

                        if dst_mac not in self.app_traffic_buffer:
                            self.app_traffic_buffer[dst_mac] = {}
                        if app_category not in self.app_traffic_buffer[dst_mac]:
                            self.app_traffic_buffer[dst_mac][app_category] = {"upload": 0, "download": 0}
                        self.app_traffic_buffer[dst_mac][app_category]["download"] += packet_len

                self.total_packets += 1
                self.total_bytes += packet_len
                self._pps_packet_count += 1

                # Protocol tracking
                self.protocol_counts[proto] = self.protocol_counts.get(proto, 0) + 1
                self.bytes_per_protocol[proto] = self.bytes_per_protocol.get(proto, 0) + packet_len

                # Packet size buckets
                if packet_len < 128:
                    self.packet_size_buckets["tiny (<128B)"] = self.packet_size_buckets.get("tiny (<128B)", 0) + 1
                elif packet_len <= 512:
                    self.packet_size_buckets["small (128-512B)"] = self.packet_size_buckets.get("small (128-512B)", 0) + 1
                elif packet_len <= 1024:
                    self.packet_size_buckets["medium (512-1024B)"] = self.packet_size_buckets.get("medium (512-1024B)", 0) + 1
                else:
                    self.packet_size_buckets["large (1024B+)"] = self.packet_size_buckets.get("large (1024B+)", 0) + 1

                # HTTP / DNS counters
                if proto in ("HTTP", "HTTPS"):
                    self.http_requests += 1
                elif proto == "DNS":
                    self.dns_queries += 1

                # Internal vs external connection classification
                try:
                    src_priv = ipaddress.ip_address(src_ip).is_private
                    dst_priv = ipaddress.ip_address(dst_ip).is_private
                    if src_priv and dst_priv:
                        self.connection_types["internal"] = self.connection_types.get("internal", 0) + 1
                    else:
                        self.connection_types["external"] = self.connection_types.get("external", 0) + 1
                except Exception:
                    pass

                # Active sessions tracking
                sess_key = f"{src_ip}:{src_port}->{dst_ip}:{dst_port}/{proto}"
                self.active_sessions[sess_key] = time.time()

                # Packet log for live stream
                log_entry = {
                    "time": datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3],
                    "proto": proto,
                    "src": f"{src_ip}:{src_port}" if src_port else src_ip,
                    "dst": f"{dst_ip}:{dst_port}" if dst_port else dst_ip,
                    "size": packet_len,
                    "flags": flags,
                }
                self.packet_log.append(log_entry)

                # Compute packets/sec every second
                now = time.time()
                elapsed = now - self._last_pps_time
                if elapsed >= 1.0:
                    self.packets_per_sec = self._pps_packet_count / elapsed
                    self._pps_packet_count = 0
                    self._last_pps_time = now

                # External Traffic Tracking (Outgoing)
                # If src is local and dst is NOT local (private IP check), it's external traffic
                # Existing check: if not self._is_private_ip(dst_ip):
                #   self._track_external_connection(dst_ip, packet_len)
                # We should refine this to ensure SRC is actually one of ours.
                if packet.src in self.active_devices and not self._is_private_ip(dst_ip):
                    self._track_external_connection(dst_ip, packet_len)

        except (AttributeError, KeyError, ValueError):
            # These are expected if packets are malformed or missing layers
            pass
        except Exception:
            logger.exception("Unexpected error in packet callback")

    def _run(self):
        """Resilient sniffer supervisor loop with automatic fallback."""
        if not SCAPY_AVAILABLE:
            if getattr(app_settings, "ALLOW_SYNTHETIC_TRAFFIC", False):
                logger.warning("Scapy is not available. Falling back to autonomous telemetry generator.")
                self._run_synthetic_loop()
            else:
                logger.warning("Scapy is not available and synthetic traffic fallback is disabled. Sniffer will stay idle.")
            return

        consecutive_failures = 0
        while self.running:
            try:
                # Attempt to sniff on interface
                sniff(
                    iface=self.interface,
                    prn=self._packet_callback,
                    count=100,
                    timeout=2,
                    store=0,
                )
                consecutive_failures = 0
            except PermissionError:
                if getattr(app_settings, "ALLOW_SYNTHETIC_TRAFFIC", False):
                    logger.warning(
                        "Administrative/root permissions missing for packet sniffing. Switching to autonomous telemetry generator."
                    )
                    self._run_synthetic_loop()
                else:
                    logger.error(
                        "Administrative/root permissions missing for packet sniffing (NET_RAW capability required). "
                        "Synthetic fallback disabled; paused."
                    )
                    time.sleep(10)
                break
            except Exception as e:
                consecutive_failures += 1
                logger.warning(
                    f"Sniffer error on interface ({e}). Consecutive failures: {consecutive_failures}."
                )
                if consecutive_failures >= 2:
                    if getattr(app_settings, "ALLOW_SYNTHETIC_TRAFFIC", False):
                        logger.warning(
                            "Sniffer driver unavailable (e.g. WinPcap/Npcap missing). Switching to autonomous telemetry generator."
                        )
                        self._run_synthetic_loop()
                    else:
                        logger.error(
                            "Sniffer driver unavailable. Synthetic traffic fallback is disabled; sniffer paused."
                        )
                        time.sleep(10)
                    break
                time.sleep(1)

    def _run_synthetic_loop(self):
        """Generates realistic telemetry when packet capture drivers are unavailable."""
        self.is_synthetic = True
        logger.info("Autonomous telemetry generator active: streaming simulated network traffic.")
        sample_protocols = ["TCP", "UDP", "TLS", "HTTP", "DNS", "HTTPS"]
        sample_ips = [
            "192.168.1.10", "192.168.1.15", "192.168.1.22", "192.168.1.45",
            "1.1.1.1", "8.8.8.8", "142.250.190.46", "104.26.10.150"
        ]

        while self.running:
            try:
                dl_chunk = int(random.triangular(80000, 2500000, 450000))
                ul_chunk = int(random.triangular(20000, 800000, 120000))

                with self.stats_lock:
                    self.download_acc += dl_chunk
                    self.upload_acc += ul_chunk
                    self.total_bytes += (dl_chunk + ul_chunk)
                    self.total_packets += random.randint(15, 80)
                    self.packets_per_sec = round(random.uniform(45.0, 320.0), 1)

                    proto = random.choice(sample_protocols)
                    self.protocol_counts[proto] = self.protocol_counts.get(proto, 0) + random.randint(1, 5)

                    src = random.choice(sample_ips[:4])
                    dst = random.choice(sample_ips[4:])
                    log_entry = {
                        "time": datetime.now().strftime("%H:%M:%S.%f")[:-3],
                        "proto": proto,
                        "src": f"{src}:{random.randint(30000, 65000)}",
                        "dst": f"{dst}:{443 if proto in ('TLS', 'HTTPS') else 53 if proto == 'DNS' else 80}",
                        "size": random.randint(64, 1500),
                        "flags": "ACK" if proto == "TCP" else "",
                    }
                    self.packet_log.append(log_entry)
                    if len(self.packet_log) > self.PACKET_LOG_SIZE:
                        self.packet_log.pop(0)

                time.sleep(1)
            except Exception as e:
                logger.error(f"Error in synthetic telemetry generator: {e}")
                time.sleep(1)

    def get_current_stats(self):
        """Returns interval bitrates and calculates rate per second without zeroing lifetime counters."""
        with self.stats_lock:
            now = time.time()
            elapsed = max(now - self._last_rate_ts, 0.001)
            
            rate_up = self.interval_upload / elapsed
            rate_down = self.interval_download / elapsed
            self.current_upload_rate = rate_up
            self.current_download_rate = rate_down

            stats = {
                "u": self.interval_upload,
                "d": self.interval_download,
                "upload_rate": rate_up,
                "download_rate": rate_down,
                "active_device_count": len(self.active_devices),
                "is_synthetic": self.is_synthetic,
            }
            # Only reset the interval accumulators, NEVER the lifetime totals
            self.interval_upload = 0
            self.interval_download = 0
            self._last_rate_ts = now
            return stats

    def _persistence_loop(self):
        """Periodically flushes active devices and telemetry to the database."""
        while self.running:
            try:
                self._flush_devices()
                self._persist_daily_stats()
                self._flush_app_traffic()
                self._flush_dns_logs()
            except sqlalchemy.exc.SQLAlchemyError:
                logger.exception("Database error in persistence loop")
            except Exception:
                logger.exception("Unexpected error in persistence loop")
            time.sleep(self.flush_interval)

    def _flush_devices(self):
        """Writes in-memory device data to the database using batch lookups and sets organization_id."""
        db = SessionLocal()
        try:
            with self.stats_lock:
                devices_to_flush = list(self.active_devices.items())

            if not devices_to_flush:
                return

            default_org = db.query(Organization).first()
            org_id = default_org.id if default_org else 1

            mac_list = [mac for mac, _ in devices_to_flush]
            existing_devices = {
                d.mac_address: d for d in db.query(Device).filter(Device.mac_address.in_(mac_list)).all()
            }

            for mac, data in devices_to_flush:
                last_seen_ts = data.get("last_seen", time.time())
                last_seen_dt = datetime.fromtimestamp(last_seen_ts, tz=timezone.utc)
                
                device = existing_devices.get(mac)
                if not device:
                    vendor = "Unknown"
                    try:
                        vendor = mac_lookup.lookup(mac)
                    except Exception as e:
                        logger.debug(f"MAC OUI lookup failed for {mac}: {e}")

                    device_type = "Unknown"
                    icon_type = "help"
                    vendor_lower = vendor.lower()
                    if "apple" in vendor_lower:
                        device_type = "Mobile/Laptop"
                        icon_type = "smartphone"
                    elif "router" in vendor_lower or "cisco" in vendor_lower or "netgear" in vendor_lower:
                        device_type = "Network"
                        icon_type = "router"
                    elif "google" in vendor_lower:
                        device_type = "Smart Device"
                        icon_type = "cast"
                    elif vendor != "Unknown":
                        icon_type = "computer"

                    device = Device(
                        mac_address=mac,
                        ip_address=data["ip"],
                        vendor=vendor,
                        type=device_type,
                        icon_type=icon_type,
                        is_online=True,
                        organization_id=org_id,
                        last_seen=last_seen_dt,
                    )
                    db.add(device)
                    db.flush()

                    status_log = DeviceStatusLog(
                        device_id=device.id, status="online", timestamp=datetime.now(timezone.utc)
                    )
                    db.add(status_log)
                    self._trigger_new_device_alert(mac, data["ip"])
                    logger.info(f"New device discovered and persisted: {mac} ({data['ip']}) - Vendor: {vendor}")
                else:
                    if not device.organization_id:
                        device.organization_id = org_id
                    if not device.is_online:
                        status_log = DeviceStatusLog(
                            device_id=device.id, status="online", timestamp=datetime.now(timezone.utc)
                        )
                        db.add(status_log)

                    device.ip_address = data["ip"]
                    device.is_online = True
                    device.last_seen = last_seen_dt

            db.commit()
        finally:
            db.close()

    def _flush_dns_logs(self):
        """Writes buffered DNS query logs to the database in bulk."""
        with self.stats_lock:
            if not self.dns_log_buffer:
                return
            logs_to_flush = list(self.dns_log_buffer)
            self.dns_log_buffer.clear()

        db = SessionLocal()
        try:
            records = [
                DnsLog(
                    timestamp=item.get("timestamp", datetime.now(timezone.utc)),
                    client_ip=item.get("client_ip", "0.0.0.0"),
                    query_domain=item.get("query_domain", ""),
                    record_type=item.get("record_type", "A"),
                )
                for item in logs_to_flush
            ]
            db.bulk_save_objects(records)
            db.commit()
        except Exception:
            logger.exception("Error persisting DNS logs")
            db.rollback()
        finally:
            db.close()

    def _persist_daily_stats(self):
        """Aggregates and persists traffic stats to DeviceDailySummary and BandwidthHistory."""
        with self.stats_lock:
            if not self.daily_traffic_buffer:
                return
            buffer_copy = self.daily_traffic_buffer.copy()
            self.daily_traffic_buffer.clear()

        db = SessionLocal()
        try:
            today = datetime.now(timezone.utc).date()
            mac_list = list(buffer_copy.keys())
            existing_devices = {
                d.mac_address: d for d in db.query(Device).filter(Device.mac_address.in_(mac_list)).all()
            }
            device_ids = [d.id for d in existing_devices.values()]
            existing_summaries = {
                s.device_id: s for s in db.query(DeviceDailySummary).filter(
                    DeviceDailySummary.device_id.in_(device_ids), DeviceDailySummary.date == today
                ).all()
            }

            for mac, traffic in buffer_copy.items():
                device = existing_devices.get(mac)
                if not device:
                    continue

                summary = existing_summaries.get(device.id)
                if not summary:
                    summary = DeviceDailySummary(
                        device_id=device.id, date=today, upload_bytes=0, download_bytes=0
                    )
                    db.add(summary)
                    existing_summaries[device.id] = summary

                summary.upload_bytes += traffic["upload"]
                summary.download_bytes += traffic["download"]

            # Persist Global Bandwidth History using monotonic lifetime counters
            current_upload = self.total_upload_bytes
            current_download = self.total_download_bytes

            delta_upload = current_upload - self._last_persist_upload
            delta_download = current_download - self._last_persist_download

            self._last_persist_upload = current_upload
            self._last_persist_download = current_download

            if delta_upload > 0 or delta_download > 0:
                bw_history = BandwidthHistory(
                    upload_bytes=delta_upload, download_bytes=delta_download
                )
                db.add(bw_history)

            db.commit()
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Error persisting daily stats")
            db.rollback()
        except Exception:
            logger.exception("Unexpected error persisting daily stats")
        finally:
            db.close()

    def _flush_app_traffic(self):
        """Flushes DPI app traffic tracking to TrafficLog."""
        with self.stats_lock:
            if not self.app_traffic_buffer:
                return
            buffer_copy = self.app_traffic_buffer.copy()
            self.app_traffic_buffer.clear()
            
            now = time.time()
            self.ip_app_map = {k: v for k, v in self.ip_app_map.items() if (now - v["last_seen"]) < 3600}

        db = SessionLocal()
        try:
            mac_list = list(buffer_copy.keys())
            existing_devices = {
                d.mac_address: d for d in db.query(Device).filter(Device.mac_address.in_(mac_list)).all()
            }
            logs = []
            now_dt = datetime.now(timezone.utc)
            for mac, categories in buffer_copy.items():
                device = existing_devices.get(mac)
                if not device:
                    continue

                for app_category, traffic in categories.items():
                    log = TrafficLog(
                        device_id=device.id,
                        upload_bytes=traffic["upload"],
                        download_bytes=traffic["download"],
                        app_category=app_category,
                        timestamp=now_dt
                    )
                    logs.append(log)
            if logs:
                db.bulk_save_objects(logs)
                db.commit()
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Error persisting traffic logs")
            db.rollback()
        finally:
            db.close()

    def _trigger_new_device_alert(self, mac, ip):
        """Creates an in-app alert and sends notification via separate DB session."""
        notif_title = "New Device Detected"
        notif_desc = (
            f"A new device has joined the network:\n\n"
            f"**MAC:** `{mac}`\n"
            f"**IP:** `{ip}`"
        )
        
        def dispatch_alert():
            with SessionLocal() as thread_db:
                try:
                    org = thread_db.query(Organization).first()
                    org_id = org.id if org else 1

                    device = thread_db.query(Device).filter(Device.mac_address == mac).first()
                    alert = SecurityAlert(
                        severity="info",
                        title=notif_title,
                        description=f"A new device with MAC {mac} and IP {ip} has joined the network.",
                        device_id=device.id if device else None,
                        organization_id=org_id,
                    )
                    thread_db.add(alert)
                    thread_db.commit()

                    NotificationService.send_alert(
                        db=thread_db,
                        organization_id=org_id,
                        title=notif_title,
                        description=notif_desc,
                        severity="INFO"
                    )
                except Exception as e:
                    logger.error(f"Failed to send new device notification: {e}")

        threading.Thread(target=dispatch_alert, daemon=True).start()

        if self.event_callback and self._loop:
            event_data = {
                "type": "NEW_DEVICE",
                "severity": "info",
                "title": "New Device Detected",
                "description": f"New device {mac} discovered.",
                "mac": mac,
                "ip": ip,
            }
            self.event_callback(event_data)

        if self.event_callback and self._loop:
            event_data = {
                "type": "NEW_DEVICE",
                "severity": "info",
                "title": "New Device Detected",
                "description": f"New device {mac} discovered.",
                "mac": mac,
                "ip": ip,
                "timestamp": time.time(),
            }
            # Call async callback from sync thread
            self._loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(self.event_callback(event_data))
            )

    def _is_private_ip(self, ip_str: str) -> bool:
        """Checks if an IP address is internal/private."""
        try:
            ip = ipaddress.ip_address(ip_str)
            return ip.is_private or ip.is_loopback or ip.is_link_local
        except ValueError:
            return True

    def _track_external_connection(self, ip: str, length: int):
        """Updates stats for an external connection and resolves GeoIP if needed."""
        if ip not in self.external_connections:
            # Resolve GeoIP in background to not block sniffer
            threading.Thread(target=self._resolve_geoip, args=(ip,), daemon=True).start()
            self.external_connections[ip] = {
                "bytes": 0,
                "hits": 0,
                "last_seen": 0,
                "city": "Resolving...",
                "country": "",
                "lat": 0,
                "lon": 0,
            }

        conn = self.external_connections[ip]
        conn["bytes"] += length
        conn["hits"] += 1
        conn["last_seen"] = time.time()

    def _resolve_geoip(self, ip: str):
        """Resolves GeoIP using ip-api.com and updates internal state."""
        if ip in self.geoip_cache:
            data = self.geoip_cache[ip]
        else:
            try:
                # rate limit friendly: only resolve if not in cache
                response = requests.get(
                    f"http://ip-api.com/json/{ip}?fields=status,country,city,lat,lon", timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success":
                        self.geoip_cache[ip] = data
                    else:
                        return
                else:
                    return
            except requests.exceptions.RequestException as e:
                logger.error(f"GeoIP resolution network error for {ip}: {e}")
                return
            except Exception:
                logger.exception(f"Unexpected GeoIP resolution error for {ip}")
                return

        with self.stats_lock:
            if ip in self.external_connections:
                self.external_connections[ip].update(
                    {
                        "city": data.get("city", "Unknown"),
                        "country": data.get("country", "Unknown"),
                        "lat": data.get("lat", 0),
                        "lon": data.get("lon", 0),
                    }
                )

    def get_external_connections(self) -> list[dict]:
        """Returns geo-located external connections for the frontend."""
        with self.stats_lock:
            # Return only resolved connections with location data
            return [
                {"ip": ip, **data}
                for ip, data in self.external_connections.items()
                if data.get("lat") != 0
            ]

    def get_analytics_summary(self) -> dict:
        """Returns comprehensive analytics data for the Traffic Analyzer page."""
        with self.stats_lock:
            # Top devices by total traffic
            top_devices = sorted(
                [
                    {"mac": mac, **data, "total": data.get("upload", 0) + data.get("download", 0)}
                    for mac, data in self.device_traffic.items()
                ],
                key=lambda x: x["total"],
                reverse=True,
            )[:6]

            return {
                "total_packets": self.total_packets,
                "total_bytes": self.total_bytes,
                "packets_per_sec": round(self.packets_per_sec, 1),
                "suspicious": self.suspicious_count,
                "upload_rate": getattr(self, "current_upload_rate", 0.0),
                "download_rate": getattr(self, "current_download_rate", 0.0),
                "protocols": dict(self.protocol_counts),
                "top_devices": top_devices,
                "packet_log": list(self.packet_log)[-50:],  # last 50 packets
                "active_device_count": len(self.active_devices),
                # Extended analytics
                "bandwidth_history": list(self.bandwidth_history),
                "packet_size_distribution": dict(self.packet_size_buckets),
                "dns_queries": self.dns_queries,
                "http_requests": self.http_requests,
                "active_sessions": len(self.active_sessions),
                "connection_types": dict(self.connection_types),
                "bytes_per_protocol": dict(self.bytes_per_protocol),
            }

    def get_packet_log(
        self,
        limit: int = 100,
        protocol: str = None,
        ip: str = None,
        port: int = None,
        flags: str = None,
    ) -> list[dict]:
        """Returns filtered packet logs."""
        with self.stats_lock:
            # Start with a copy of the log to avoid modification during iteration
            # Slice to max size first if no filters to speed up?
            # No, we need to filter first then slice.

            filtered = list(self.packet_log)

            if protocol:
                protocol = protocol.upper()
                filtered = [p for p in filtered if p["proto"] == protocol]

            if ip:
                # Check src or dst
                filtered = [p for p in filtered if ip in p["src"] or ip in p["dst"]]

            if port:
                port_str = str(port)
                # Check src or dst port (format is IP:PORT)
                filtered = [
                    p for p in filtered if f":{port_str}" in p["src"] or f":{port_str}" in p["dst"]
                ]

            if flags:
                flags = flags.upper()
                # Check if packet has flags and if they match (contain) req flags?
                # Or exact match? Let's do contains for now (e.g. search "S" finds "SA")
                filtered = [p for p in filtered if p.get("flags") and flags in p["flags"]]

            # Return latest N
            return list(filtered[-limit:])

    def get_analytics_heatmap(self) -> list[dict]:
        """Returns 7x24 matrix aggregated from the last 7 days of BandwidthHistory."""
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        matrix = {(day, hour): 0 for day in days for hour in range(24)}
        try:
            with SessionLocal() as db:
                since = datetime.now(timezone.utc) - timedelta(days=7)
                rows = (
                    db.query(BandwidthHistory)
                    .filter(BandwidthHistory.timestamp >= since)
                    .all()
                )
                for r in rows:
                    if r.timestamp:
                        ts = r.timestamp if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc)
                        day_name = days[ts.weekday()]
                        hour = ts.hour
                        matrix[(day_name, hour)] += (r.upload_bytes or 0) + (r.download_bytes or 0)
        except Exception as e:
            logger.error(f"Error computing analytics heatmap: {e}")

        return [{"day": day, "hour": hour, "value": matrix[(day, hour)]} for day in days for hour in range(24)]

global_collector = PacketCollector()
