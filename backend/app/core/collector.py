import os
import time
import threading
import logging
from typing import Dict, List, Optional
try:
    from scapy.all import sniff, IP, TCP, UDP, conf
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

from ..db.database import SessionLocal
from ..models.models import Device, SecurityAlert, DeviceDailySummary
from datetime import datetime
from sqlalchemy import func, Date
import asyncio
import requests
import ipaddress

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Collector")

class PacketCollector:
    """
    Core engine for network telemetry capture and aggregation.
    """
    def __init__(self):
        self.active_devices: Dict[str, Dict] = {} # MAC -> metadata
        self.external_connections: Dict[str, Dict] = {} # IP -> geo info
        self.geoip_cache: Dict[str, Dict] = {}
        self.stats_lock = threading.Lock()
        self.running = False
        self.interface = None
        self.upload_acc = 0
        self.download_acc = 0
        self._thread = None
        self._persistence_thread = None
        self.flush_interval = 30 # seconds
        self.event_callback = None
        self._loop = None
        # --- Advanced Analytics ---
        self.protocol_counts: Dict[str, int] = {}  # protocol -> count
        self.device_traffic: Dict[str, Dict] = {}  # MAC -> {upload, download, hostname}
        self.total_packets = 0
        self.total_bytes = 0
        self.packets_per_sec = 0.0
        self.suspicious_count = 0
        self._last_pps_time = time.time()
        self._pps_packet_count = 0
        self.packet_log: List[Dict] = []  # ring buffer for live stream
        self.PACKET_LOG_SIZE = 200
        # --- Extended Analytics ---
        self.bandwidth_history: List[Dict] = []  # ring buffer of {time, up, down}
        self.BANDWIDTH_HISTORY_SIZE = 60  # 60 snapshots = ~2 minutes at 2s interval
        self._bw_snapshot_up = 0
        self._bw_snapshot_down = 0
        self._last_bw_snapshot = time.time()
        self.packet_size_buckets: Dict[str, int] = {
            "tiny (<128B)": 0, "small (128-512B)": 0, "medium (512-1024B)": 0, "large (1024B+)": 0
        }
        self.dns_queries = 0
        self.http_requests = 0
        self.active_sessions: Dict[str, float] = {}  # session_key -> last_seen
        self.SESSION_TIMEOUT = 30  # seconds
        self.connection_types: Dict[str, int] = {"internal": 0, "external": 0}
        self.SESSION_TIMEOUT = 30  # seconds
        self.connection_types: Dict[str, int] = {"internal": 0, "external": 0}
        self.bytes_per_protocol: Dict[str, int] = {}  # protocol -> total bytes
        
        # Buffer for DB persistence (MAC -> {upload, download})
        # This resets after every flush to DB
        self.daily_traffic_buffer: Dict[str, Dict] = {} 


    def set_event_callback(self, callback):
        """Sets the callback for broadcasting events."""
        self.event_callback = callback
        try:
            self._loop = asyncio.get_event_loop()
        except RuntimeError:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)

    def start(self, interface: Optional[str] = None):
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
            if packet.haslayer(TCP):
                proto = "TCP"
                src_port = packet[TCP].sport
                dst_port = packet[TCP].dport
                # Refine by well-known ports
                if dst_port == 443 or src_port == 443:
                    proto = "HTTPS"
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
            elif packet[IP].proto == 1:
                proto = "ICMP"

            with self.stats_lock:
                self.download_acc += packet_len
                self.total_packets += 1
                self.total_bytes += packet_len
                self._pps_packet_count += 1

                # Protocol tracking
                self.protocol_counts[proto] = self.protocol_counts.get(proto, 0) + 1

                # Per-device traffic
                if packet.src:
                    mac = packet.src
                    self.active_devices[mac] = {
                        "last_seen": time.time(),
                        "ip": src_ip
                    }
                    if mac not in self.device_traffic:
                        self.device_traffic[mac] = {"upload": 0, "download": 0, "ip": src_ip}
                    self.device_traffic[mac]["download"] += packet_len
                    self.device_traffic[mac]["ip"] = src_ip

                    # Update persistence buffer
                    if mac not in self.daily_traffic_buffer:
                        self.daily_traffic_buffer[mac] = {"upload": 0, "download": 0}
                    self.daily_traffic_buffer[mac]["download"] += packet_len


                # Packet log for live stream
                log_entry = {
                    "time": datetime.now().strftime("%H:%M:%S.%f")[:-3],
                    "proto": proto,
                    "src": f"{src_ip}:{src_port}" if src_port else src_ip,
                    "dst": f"{dst_ip}:{dst_port}" if dst_port else dst_ip,
                    "size": packet_len
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
                if not self._is_private_ip(dst_ip):
                    self._track_external_connection(dst_ip, packet_len)

        except Exception as e:
            logger.error(f"Error in packet callback: {e}")

    def _run(self):
        """Main sniffer loop."""
        if not SCAPY_AVAILABLE:
            logger.error("Scapy is not available. Falling back to mock data.")
            self._run_mock()
            return

        try:
            # Note: sniff() is blocking, so we run it in a loop with count or timeout
            while self.running:
                sniff(
                    iface=self.interface,
                    prn=self._packet_callback,
                    count=100,
                    timeout=2,
                    store=0 # Don't keep packets in memory
                )
        except Exception as e:
            logger.error(f"Sniffer crashed: {e}")
            self._run_mock()

    def _run_mock(self):
        """Mock traffic generator for development."""
        import random
        mock_macs = ["00:15:5D:01:02:03", "00:15:5D:04:05:06", "74:AC:5F:E1:D2:C3",
                     "AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02", "AA:BB:CC:DD:EE:03"]
        mock_hostnames = {"AA:BB:CC:DD:EE:01": "iPhone-13", "AA:BB:CC:DD:EE:02": "Galaxy-S24",
                          "AA:BB:CC:DD:EE:03": "Desktop-PC", "00:15:5D:01:02:03": "NAS-Server",
                          "00:15:5D:04:05:06": "Smart-TV", "74:AC:5F:E1:D2:C3": "Laptop-Air"}
        protocols = ["TCP", "UDP", "HTTP", "HTTPS", "DNS", "ICMP", "SSH", "FTP"]
        proto_weights = [30, 20, 15, 25, 8, 5, 3, 2]  # weighted distribution
        mock_ext_ips = ["142.250.72.14", "104.16.132.229", "166.34.161.67", "151.101.1.140",
                        "13.107.42.14", "31.13.65.36", "52.94.236.248", "185.199.108.153"]

        while self.running:
            with self.stats_lock:
                up = random.randint(100, 2000)
                down = random.randint(1000, 10000)
                self.upload_acc += up
                self.download_acc += down

                # Pick a random device and protocol
                mac = random.choice(mock_macs)
                proto = random.choices(protocols, weights=proto_weights, k=1)[0]
                device_ip = f"192.168.1.{10 + mock_macs.index(mac)}"
                ext_ip = random.choice(mock_ext_ips)
                src_port = random.randint(1024, 65535)
                dst_port = {"HTTP": 80, "HTTPS": 443, "DNS": 53, "SSH": 22, "FTP": 21}.get(proto, random.randint(1024, 65535))
                pkt_size = random.randint(64, 1500)

                self.active_devices[mac] = {
                    "last_seen": time.time(),
                    "ip": device_ip
                }

                # Track per-device traffic
                if mac not in self.device_traffic:
                    self.device_traffic[mac] = {"upload": 0, "download": 0, "ip": device_ip, "hostname": mock_hostnames.get(mac, mac[-5:])}
                self.device_traffic[mac]["download"] += down
                self.device_traffic[mac]["upload"] += up

                # Update persistence buffer
                if mac not in self.daily_traffic_buffer:
                    self.daily_traffic_buffer[mac] = {"upload": 0, "download": 0}
                self.daily_traffic_buffer[mac]["download"] += down
                self.daily_traffic_buffer[mac]["upload"] += up


                # Track protocol
                self.protocol_counts[proto] = self.protocol_counts.get(proto, 0) + 1
                self.total_packets += 1
                self.total_bytes += pkt_size
                self._pps_packet_count += 1
                self.bytes_per_protocol[proto] = self.bytes_per_protocol.get(proto, 0) + pkt_size

                # Packet size distribution
                if pkt_size < 128:
                    self.packet_size_buckets["tiny (<128B)"] += 1
                elif pkt_size < 512:
                    self.packet_size_buckets["small (128-512B)"] += 1
                elif pkt_size < 1024:
                    self.packet_size_buckets["medium (512-1024B)"] += 1
                else:
                    self.packet_size_buckets["large (1024B+)"] += 1

                # DNS/HTTP counters
                if proto == "DNS":
                    self.dns_queries += 1
                if proto in ("HTTP", "HTTPS"):
                    self.http_requests += 1

                # Active sessions tracking
                session_key = f"{device_ip}:{src_port}->{ext_ip}:{dst_port}"
                self.active_sessions[session_key] = time.time()
                # Prune stale sessions
                cutoff = time.time() - self.SESSION_TIMEOUT
                self.active_sessions = {k: v for k, v in self.active_sessions.items() if v > cutoff}

                # Connection type
                self.connection_types["external"] += 1
                if random.random() < 0.3:  # 30% chance internal
                    self.connection_types["internal"] += 1

                # Suspicious detection (random small chance)
                is_suspicious = random.random() < 0.02
                if is_suspicious:
                    self.suspicious_count += 1

                # Compute packets/sec
                now = time.time()
                elapsed = now - self._last_pps_time
                if elapsed >= 1.0:
                    self.packets_per_sec = self._pps_packet_count / elapsed
                    self._pps_packet_count = 0
                    self._last_pps_time = now

                # Bandwidth history snapshot (every 2 seconds)
                self._bw_snapshot_up += up
                self._bw_snapshot_down += down
                bw_elapsed = now - self._last_bw_snapshot
                if bw_elapsed >= 2.0:
                    self.bandwidth_history.append({
                        "time": datetime.now().strftime("%H:%M:%S"),
                        "up": self._bw_snapshot_up,
                        "down": self._bw_snapshot_down
                    })
                    if len(self.bandwidth_history) > self.BANDWIDTH_HISTORY_SIZE:
                        self.bandwidth_history.pop(0)
                    self._bw_snapshot_up = 0
                    self._bw_snapshot_down = 0
                    self._last_bw_snapshot = now

                # Packet log entry
                log_entry = {
                    "time": datetime.now().strftime("%H:%M:%S.%f")[:-3],
                    "proto": proto,
                    "src": f"{device_ip}:{src_port}",
                    "dst": f"{ext_ip}:{dst_port}",
                    "size": pkt_size,
                    "suspicious": is_suspicious
                }
                self.packet_log.append(log_entry)
                if len(self.packet_log) > self.PACKET_LOG_SIZE:
                    self.packet_log.pop(0)

                # External connection tracking
                if ext_ip not in self.external_connections:
                    threading.Thread(target=self._resolve_geoip, args=(ext_ip,), daemon=True).start()
                    self.external_connections[ext_ip] = {
                        "bytes": 0, "hits": 0, "last_seen": 0,
                        "city": "Resolving...", "country": "", "lat": 0, "lon": 0
                    }
                conn = self.external_connections[ext_ip]
                conn["bytes"] += pkt_size
                conn["hits"] += 1
                conn["last_seen"] = time.time()

            time.sleep(random.uniform(0.3, 1.0))

    def get_current_stats(self):
        """Returns and resets the accumulated bitrates."""
        with self.stats_lock:
            stats = {
                "u": self.upload_acc,
                "d": self.download_acc,
                "active_device_count": len(self.active_devices)
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
            except Exception as e:
                logger.error(f"Error in persistence loop: {e}")
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
                    device = Device(
                        mac_address=mac,
                        ip_address=data["ip"],
                        is_online=True,
                        last_seen=datetime.fromtimestamp(data["last_seen"])
                    )
                    db.add(device)
                    # Trigger alert for truly new devices
                    self._trigger_new_device_alert(mac, data["ip"])
                    logger.info(f"New device discovered and persisted: {mac} ({data['ip']})")
                else:
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
                    continue # Should have been created by _flush_devices already

                # Check for existing summary for today
                summary = db.query(DeviceDailySummary).filter(
                    DeviceDailySummary.device_id == device.id,
                    DeviceDailySummary.date == today
                ).first()

                if not summary:
                    summary = DeviceDailySummary(
                        device_id=device.id,
                        date=today,
                        upload_bytes=0,
                        download_bytes=0
                    )
                    db.add(summary)
                
                summary.upload_bytes += traffic["upload"]
                summary.download_bytes += traffic["download"]
            
            db.commit()
            # logger.info(f"Persisted daily stats for {len(buffer_copy)} devices")
        except Exception as e:
            logger.error(f"Error persisting daily stats: {e}")
            # Restore buffer on error? Naah, simpler to drop data than complex recovery for now.
        finally:
            db.close()


    def _trigger_new_device_alert(self, mac, ip):
        """Triggers a security alert for a new device."""
        db = SessionLocal()
        try:
            device = db.query(Device).filter(Device.mac_address == mac).first()
            alert = SecurityAlert(
                severity="info",
                title="New Device Detected",
                description=f"A new device with MAC {mac} and IP {ip} has joined the network.",
                device_id=device.id if device else None
            )
            db.add(alert)
            db.commit()
            
            if self.event_callback and self._loop:
                event_data = {
                    "type": "NEW_DEVICE",
                    "severity": "info",
                    "title": "New Device Detected",
                    "description": f"New device {mac} discovered.",
                    "mac": mac,
                    "ip": ip,
                    "timestamp": time.time()
                }
                # Call async callback from sync thread
                self._loop.call_soon_threadsafe(
                    lambda: asyncio.ensure_future(self.event_callback(event_data))
                )
        finally:
            db.close()

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
                "lon": 0
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
                response = requests.get(f"http://ip-api.com/json/{ip}?fields=status,country,city,lat,lon", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "success":
                        self.geoip_cache[ip] = data
                    else:
                        return
                else:
                    return
            except Exception as e:
                logger.error(f"GeoIP resolution error for {ip}: {e}")
                return

        with self.stats_lock:
            if ip in self.external_connections:
                self.external_connections[ip].update({
                    "city": data.get("city", "Unknown"),
                    "country": data.get("country", "Unknown"),
                    "lat": data.get("lat", 0),
                    "lon": data.get("lon", 0)
                })

    def get_external_connections(self) -> List[Dict]:
        """Returns geo-located external connections for the frontend."""
        with self.stats_lock:
            # Return only resolved connections with location data
            return [
                {"ip": ip, **data} 
                for ip, data in self.external_connections.items() 
                if data.get("lat") != 0
            ]

    def get_analytics_summary(self) -> Dict:
        """Returns comprehensive analytics data for the Traffic Analyzer page."""
        with self.stats_lock:
            # Top devices by total traffic
            top_devices = sorted(
                [
                    {"mac": mac, **data, "total": data.get("upload", 0) + data.get("download", 0)}
                    for mac, data in self.device_traffic.items()
                ],
                key=lambda x: x["total"],
                reverse=True
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
                "bytes_per_protocol": dict(self.bytes_per_protocol)
            }

# Global collector instance
global_collector = PacketCollector()
