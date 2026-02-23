import socket
import concurrent.futures
from datetime import datetime, timezone
import logging
from sqlalchemy.orm import Session
from ..db.database import SessionLocal
from ..models import models
from ..core.logging import get_logger

logger = get_logger("PortScanner")

COMMON_PORTS = [
    21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 
    993, 995, 1723, 3306, 3389, 5432, 5900, 8000, 8080, 8443
]

PORT_SERVICE_MAP = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    111: "RPC",
    135: "msrpc",
    139: "netbios-ssn",
    143: "IMAP",
    443: "HTTPS",
    445: "SMB",
    993: "IMAPS",
    995: "POP3S",
    1723: "PPTP",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    5900: "VNC",
    8000: "HTTP-ALT",
    8080: "HTTP-PROXY",
    8443: "HTTPS-ALT"
}

def scan_port(ip, port, timeout=1.0):
    """Checks if a port is open on a given IP."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            result = s.connect_ex((ip, port))
            if result == 0:
                return port, True
    except Exception:
        pass
    return port, False

def scan_device(ip):
    """Scans common ports for a single IP address."""
    open_ports = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        future_to_port = {executor.submit(scan_port, ip, port): port for port in COMMON_PORTS}
        for future in concurrent.futures.as_completed(future_to_port):
            port, is_open = future.result()
            if is_open:
                open_ports.append(port)
    return open_ports

def run_port_scan_job():
    """Background task to scan all online devices for open ports."""
    logger.info("Starting background port scan job...")
    db: Session = SessionLocal()
    try:
        # Get all devices that were recently seen online (or just all devices)
        devices = db.query(models.Device).filter(models.Device.is_online == True).all()
        
        for device in devices:
            if not device.ip_address:
                continue
                
            logger.info(f"Scanning device: {device.hostname or device.ip_address} ({device.ip_address})")
            open_ports = scan_device(device.ip_address)
            
            # Update the database
            # First, mark current ports for this device as potentially closed or just replace them
            # For simplicity, we'll delete old open ports and add the new ones, 
            # or update existing ones. Simple approach: delete and re-add for this scan.
            
            # Better approach: update specific ports or add new ones
            now = datetime.now(timezone.utc)
            
            # Get existing ports
            existing_ports = {p.port: p for p in device.ports}
            
            # Current open ports found in this scan
            found_ports = set(open_ports)
            
            # Remove ports that are no longer open
            for p_num, p_obj in list(existing_ports.items()):
                if p_num not in found_ports:
                    db.delete(p_obj)
            
            # Add or update open ports
            for p_num in found_ports:
                if p_num in existing_ports:
                    existing_ports[p_num].last_discovered = now
                    existing_ports[p_num].state = "open"
                else:
                    new_port = models.DevicePort(
                        device_id=device.id,
                        port=p_num,
                        protocol="TCP",
                        service=PORT_SERVICE_MAP.get(p_num, "unknown"),
                        state="open",
                        last_discovered=now
                    )
                    db.add(new_port)
            
            db.commit()
            logger.info(f"Finished scanning {device.ip_address}. Found {len(open_ports)} open ports.")
            
    except Exception as e:
        logger.error(f"Error during port scan job: {e}")
        db.rollback()
    finally:
        db.close()
        logger.info("Port scan job completed.")
