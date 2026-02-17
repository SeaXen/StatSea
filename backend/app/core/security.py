from sqlalchemy.orm import Session
from ..models import models
import datetime
import psutil
import socket

class SecurityEngine:
    def __init__(self):
        self.known_ports = set()
        self.baseline_established = False

    def detect_port_changes(self, db: Session):
        """
        Scans local open ports and compares against a baseline.
        Detects new listening ports which could indicate backdoors or unauthorized services.
        """
        current_ports = set()
        try:
            # Get all listening TCP ports
            connections = psutil.net_connections(kind='tcp')
            for conn in connections:
                if conn.status == psutil.CONN_LISTEN:
                    # Identifier: (port, ip)
                    # Use IP to distinguish localhost only vs 0.0.0.0
                    port_id = (conn.laddr.port, conn.laddr.ip)
                    current_ports.add(port_id)

            if not self.baseline_established:
                self.known_ports = current_ports
                self.baseline_established = True
                print(f"Security Baseline: Established {len(self.known_ports)} known listening ports.")
                return

            # Check for new ports
            new_ports = current_ports - self.known_ports
            for port, ip in new_ports:
                # Log security event
                desc = f"New listening port detected: {port} on {ip}"
                self.log_security_event(
                    db,
                    event_type="NEW_OPEN_PORT",
                    severity="MEDIUM",
                    description=desc,
                    source_ip=ip
                )
                print(f"SECURITY ALERT: {desc}")
                # Send Notification
                notification_service.send_alert(
                    title="New Open Port Detected",
                    description=desc,
                    severity="MEDIUM",
                    fields=[{"name": "Port", "value": str(port)}, {"name": "IP", "value": ip}]
                )
            
            # Update known ports (so we don't alert repeatedly for the same one)
            self.known_ports = current_ports

        except Exception as e:
            print(f"Port scan error: {e}")

    def detect_rogue_dhcp(self, db: Session):
        """
        Placeholder for Rogue DHCP detection.
        Requires raw packet capture to see DHCP OFFERs from unknown IPs.
        """
        pass

    def log_security_event(self, db: Session, event_type: str, severity: str, description: str, source_ip: str = None, mac_address: str = None):
        """
        Logs a security event to the database.
        """
        try:
            event = models.SecurityEvent(
                event_type=event_type,
                severity=severity,
                description=description,
                source_ip=source_ip,
                mac_address=mac_address
            )
            db.add(event)
            db.commit()
        except Exception as e:
            print(f"Security logging error: {e}")
            db.rollback()

security_engine = SecurityEngine()
