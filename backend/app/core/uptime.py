import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from ..db.database import SessionLocal
from ..models.models import Device, DeviceStatusLog, Organization
from ..services.notification_service import NotificationService

logger = logging.getLogger("UptimeMonitor")

# Threshold in minutes after which a device is considered offline if not seen
OFFLINE_THRESHOLD_MINUTES = 5


def check_device_availability():
    """
    Checks for devices that haven't been seen recently and marks them as offline.
    Logs the status change to DeviceStatusLog.
    """
    db: Session = SessionLocal()
    try:
        threshold_time = datetime.now(timezone.utc) - timedelta(minutes=OFFLINE_THRESHOLD_MINUTES)

        # Find devices that are currently marked online but haven't been seen since threshold
        offline_candidates = (
            db.query(Device)
            .filter(Device.is_online == True, Device.last_seen < threshold_time)
            .all()
        )

        if not offline_candidates:
            return

        for device in offline_candidates:
            logger.info(
                f"Device {device.hostname or device.mac_address} ({device.ip_address}) is now OFFLINE. Last seen: {device.last_seen}"
            )

            # Mark as offline
            device.is_online = False

            # Log status change
            status_log = DeviceStatusLog(
                device_id=device.id, status="offline", timestamp=datetime.now(timezone.utc)
            )
            db.add(status_log)

        # Send notifications for each offline candidate
        try:
            org = db.query(Organization).first()
            org_id = org.id if org else 1
            
            for device in offline_candidates:
                notif_title = "Device Offline"
                notif_desc = (
                    f"Device **{device.alias or device.hostname or 'Unknown'}** is now offline.\n\n"
                    f"**MAC:** `{device.mac_address}`\n"
                    f"**Last Seen:** {device.last_seen.strftime('%Y-%m-%d %H:%M:%S') if device.last_seen else 'N/A'}"
                )
                NotificationService.send_alert(db, org_id, notif_title, notif_desc, "WARNING")
        except Exception as e:
            logger.error(f"Failed to send uptime notifications: {e}")

        db.commit()
        if len(offline_candidates) > 0:
            logger.info(f"Marked {len(offline_candidates)} devices as offline.")

    except Exception as e:
        logger.error(f"Error checking device availability: {e}")
        db.rollback()
    finally:
        db.close()
