import asyncio
import ipaddress
import random
import threading
import time
from datetime import datetime, timezone

try:
    from scapy.all import DNS, IP, TCP, UDP, sniff, Raw

    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

import requests
import sqlalchemy.exc

from ..core.logging import get_logger
from ..db.database import SessionLocal
from ..models.models import (
    BandwidthHistory,
    Device,
    DeviceDailySummary,
    DeviceStatusLog,
    DnsLog,
    SecurityAlert,
    TrafficLog,
)
from ..services.notification_service import NotificationService
from mac_vendor_lookup import MacLookup

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
    except Exception:
        pass
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
        self.interface = None
        self.upload_acc = 0
        self.download_acc = 0
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
        self.packet_log: list[dict] = []  # ring buffer for live stream
        self.PACKET_LOG_SIZE = 1000
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
        self.interface = interface
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

        self._persistence_thread = threading.Thread(target=self._persistence_loop, daemon=True)
        self._persistence_thread.start()

        logger.info(f"Collector started on interface: {interface or 'default'}")

    def stop(self):
        """Stops the sniffing thread."""
        self.running = False
        if self._thread:
            self._thread.join(timeout=1)

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

                                self.dns_log_buffer.append(
                                    {
                                        "timestamp": datetime.now(),
                                        "client_ip": src_ip,
                                        "query_domain": qname,
                                        "record_type": record_type,
                                    }
                                )
                    except Exception:
                        pass  # Scapy might fail on malformed packets
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
                    # We only track download for devices we've seen (or should we add them?)
                    # Let's add them if they look like local devices, but promiscuous mode might see non-local MACs?
                    # Generally safely to assume traffic on LAN interface with MAC is local-ish.
                    if dst_mac in self.active_devices:
                        self.device_traffic[dst_mac]["download"] += packet_len
                        self.download_acc += packet_len

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

                # Packet log for live stream
                log_entry = {
                    "time": datetime.now().strftime("%H:%M:%S.%f")[:-3],
                    "proto": proto,
                    "src": f"{src_ip}:{src_port}" if src_port else src_ip,
                    "dst": f"{dst_ip}:{dst_port}" if dst_port else dst_ip,
                    "size": packet_len,
                    "flags": flags,
                }
                self.packet_log.append(log_entry)
                if len(self.packet_log) > self.PACKET_LOG_SIZE:
                    self.packet_log.pop(0)

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
        """Main sniffer loop."""
        if not SCAPY_AVAILABLE:
            logger.error("Scapy is not available. Network traffic collection disabled.")
            return

        try:
            # Note: sniff() is blocking, so we run it in a loop with count or timeout
            while self.running:
                sniff(
                    iface=self.interface,
                    prn=self._packet_callback,
                    count=100,
                    timeout=2,
                    store=0,  # Don't keep packets in memory
                )
        except PermissionError:
            logger.error(
                "Permission denied to sniff on interface. Ensure application is running with administrative privileges."
            )
        except Exception:
            logger.exception("Sniffer crashed unexpectedly")

    def get_current_stats(self):
        """Returns and resets the accumulated bitrates."""
        with self.stats_lock:
            stats = {
                "u": self.upload_acc,
                "d": self.download_acc,
                "active_device_count": len(self.active_devices),
            }
            self.upload_acc = 0
            self.download_acc = 0
            return stats

    def _persistence_loop(self):
        """Periodically flushes active devices to the database."""
        while self.running:
            try:
                self._flush_devices()
                # Persist daily stats every ~5 minutes or so (controlled by flush_interval for now)
                # In production you might want a separate schedule, but this is fine for now
                self._persist_daily_stats()
                self._flush_app_traffic()
                self._flush_dns_logs()
            except sqlalchemy.exc.SQLAlchemyError:
                logger.exception("Database error in persistence loop")
            except Exception:
                logger.exception("Unexpected error in persistence loop")
            time.sleep(self.flush_interval)

    def _flush_devices(self):
        """Writes in-memory device data to the database."""
        db = SessionLocal()
        try:
            with self.stats_lock:
                devices_to_flush = list(self.active_devices.items())

            for mac, data in devices_to_flush:
                device = db.query(Device).filter(Device.mac_address == mac).first()
                if not device:
                    # Attempt MAC OUI vendor lookup
                    vendor = "Unknown"
                    try:
                        vendor = mac_lookup.lookup(mac)
                    except Exception as e:
                        logger.debug(f"MAC OUI lookup failed for {mac}: {e}")

                    # Determine a basic type based on vendor (can be expanded later)
                    device_type = "Unknown"
                    icon_type = "help" # Default icon
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
                        last_seen=datetime.fromtimestamp(data["last_seen"]),
                    )
                    db.add(device)
                    db.flush()  # Get ID

                    # Log initial status
                    status_log = DeviceStatusLog(
                        device_id=device.id, status="online", timestamp=datetime.now(timezone.utc)
                    )
                    db.add(status_log)

                    # Trigger alert for truly new devices
                    self._trigger_new_device_alert(db, mac, data["ip"])
                    logger.info(f"New device discovered and persisted: {mac} ({data['ip']}) - Vendor: {vendor}")
                else:
                    # Check for status change
                    if not device.is_online:
                        status_log = DeviceStatusLog(
                            device_id=device.id, status="online", timestamp=datetime.now(timezone.utc)
                        )
                        db.add(status_log)

                    device.ip_address = data["ip"]
                    device.is_online = True
                    device.last_seen = datetime.fromtimestamp(data["last_seen"])

            db.commit()
        finally:
            db.close()

    def _persist_daily_stats(self):
        """Aggregates and persists traffic stats to DeviceDailySummary."""
        with self.stats_lock:
            if not self.daily_traffic_buffer:
                return
            buffer_copy = self.daily_traffic_buffer.copy()
            self.daily_traffic_buffer.clear()

        db = SessionLocal()
        try:
            today = datetime.now().date()

            for mac, traffic in buffer_copy.items():
                device = db.query(Device).filter(Device.mac_address == mac).first()
                if not device:
                    continue  # Should have been created by _flush_devices already

                # Check for existing summary for today
                summary = (
                    db.query(DeviceDailySummary)
                    .filter(
                        DeviceDailySummary.device_id == device.id, DeviceDailySummary.date == today
                    )
                    .first()
                )

                if not summary:
                    summary = DeviceDailySummary(
                        device_id=device.id, date=today, upload_bytes=0, download_bytes=0
                    )
                    db.add(summary)

                summary.upload_bytes += traffic["upload"]
                summary.download_bytes += traffic["download"]

            # Persist Global Bandwidth History (Delta)
            current_upload = self.upload_acc
            current_download = self.download_acc

            delta_upload = current_upload - self._last_persist_upload
            delta_download = current_download - self._last_persist_download

            # Update last persist reference
            self._last_persist_upload = current_upload
            self._last_persist_download = current_download

            if delta_upload > 0 or delta_download > 0:
                bw_history = BandwidthHistory(
                    upload_bytes=delta_upload, download_bytes=delta_download
                )
                db.add(bw_history)

            db.commit()
            # logger.info(f"Persisted daily stats for {len(buffer_copy)} devices")
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Error persisting daily stats")
        except Exception:
            logger.exception("Unexpected error persisting daily stats")
            # Restore buffer on error? Naah, simpler to drop data than complex recovery for now.
        finally:
            db.close()

    def _flush_app_traffic(self):
        """Flushes DPI app traffic tracking to TrafficLog."""
        with self.stats_lock:
            if not self.app_traffic_buffer:
                return
            buffer_copy = self.app_traffic_buffer.copy()
            self.app_traffic_buffer.clear()
            
            # Also cleanup stale intellectual ip mappings
            now = time.time()
            self.ip_app_map = {k: v for k, v in self.ip_app_map.items() if (now - v["last_seen"]) < 3600}

        db = SessionLocal()
        try:
            for mac, categories in buffer_copy.items():
                device = db.query(Device).filter(Device.mac_address == mac).first()
                if not device:
                    continue

                for app_category, traffic in categories.items():
                    log = TrafficLog(
                        device_id=device.id,
                        upload_bytes=traffic["upload"],
                        download_bytes=traffic["download"],
                        app_category=app_category,
                        timestamp=datetime.now()
                    )
                    db.add(log)
            db.commit()
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Error persisting traffic logs")
        finally:
            db.close()

    def _trigger_new_device_alert(self, db, mac, ip):
        """Triggers a security alert for a new device."""
        device = db.query(Device).filter(Device.mac_address == mac).first()
        alert = SecurityAlert(
            severity="info",
            title="New Device Detected",
            description=f"A new device with MAC {mac} and IP {ip} has joined the network.",
            device_id=device.id if device else None,
        )
        db.add(alert)
        # Note: Caller is responsible for committing the transaction to prevent deadlocks

        # Dispatch external notifications
        vendor = device.vendor if device and device.vendor else "Unknown"
        notif_title = "New Device Detected"
        notif_desc = (
            f"A new device has joined the network:\n\n"
            f"**MAC:** `{mac}`\n"
            f"**IP:** `{ip}`\n"
            f"**Vendor:** {vendor}"
        )
        
        # Helper to dispatch notification in thread
        def dispatch_alert():
            try:
                # Resolve org_id 
                # Device is already related to the organization in some models, 
                # but here we'll default to first org if not explicit.
                org = db.query(models.Organization).first()
                org_id = org.id if org else 1
                
                NotificationService.send_alert(
                    db=db,
                    organization_id=org_id,
                    title=notif_title,
                    description=notif_desc,
                    severity="INFO"
                )
            except Exception as e:
                logger.error(f"Failed to send new device notification: {e}")

        # Run in thread to prevent blocking the sniffing loop
        threading.Thread(target=dispatch_alert, daemon=True).start()

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
                "upload_rate": self.upload_acc,
                "download_rate": self.download_acc,
                "protocols": dict(self.protocol_counts),
                "top_devices": top_devices,
                "packet_log": list(self.packet_log[-50:]),  # last 50 packets
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

            filtered = self.packet_log

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
        """Returns an empty 7x24 matrix for production."""
        heatmap_data = []
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for day_name in days:
            for h in range(24):
                heatmap_data.append({"day": day_name, "hour": h, "value": 0})
        return heatmap_data

global_collector = PacketCollector()
