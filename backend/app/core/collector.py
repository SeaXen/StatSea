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
from ..models.models import Device, SecurityAlert
from datetime import datetime
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
            
            # Simple aggregation logic for now
            with self.stats_lock:
                # In a real environment, we'd check against host IP to determine upload/download
                # For now, we'll assume traffic is roughly split or just track totals
                # In Phase 1.1 we'll refine this with local IP detection
                self.download_acc += packet_len
                
                # Check for MAC to update device activity
                if packet.src:
                    self.active_devices[packet.src] = {
                        "last_seen": time.time(),
                        "ip": packet[IP].src
                    }

                # External Traffic Tracking (Outgoing)
                dst_ip = packet[IP].dst
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
        mock_macs = ["00:15:5D:01:02:03", "00:15:5D:04:05:06", "74:AC:5F:E1:D2:C3"]
        while self.running:
            with self.stats_lock:
                self.upload_acc += random.randint(100, 2000)
                self.download_acc += random.randint(1000, 10000)
                
                # Randomly "see" a device
                mac = random.choice(mock_macs)
                self.active_devices[mac] = {
                    "last_seen": time.time(),
                    "ip": f"192.168.1.{random.randint(50, 100)}"
                }
            time.sleep(1)

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

# Global collector instance
global_collector = PacketCollector()
