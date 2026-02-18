import sqlalchemy.exc
from sqlalchemy.orm import Session

from ..schemas import defaults as schemas
from ..core.exceptions import DeviceNotFoundException, StatSeaException
from ..core.logging import get_logger
from ..core.monitor import wake_device
from ..models import models

logger = get_logger("DeviceService")


class DeviceService:
    @staticmethod
    def get_devices(db: Session, skip: int = 0, limit: int = 100) -> list[models.Device]:
        """
        Retrieves devices from the database with pagination.
        If empty, seeds mock devices for initial setup.
        """
        try:
            devices = db.query(models.Device).offset(skip).limit(limit).all()
            if not devices and skip == 0:
                logger.info("Seeding initial mock devices")
                defaults = [
                    models.Device(
                        mac_address="AA:BB:CC:DD:EE:01",
                        ip_address="192.168.1.10",
                        hostname="iPhone-13",
                        vendor="Apple",
                        type="Mobile",
                        is_online=True,
                    ),
                    models.Device(
                        mac_address="AA:BB:CC:DD:EE:02",
                        ip_address="192.168.1.11",
                        hostname="Galaxy-S24",
                        vendor="Samsung",
                        type="Mobile",
                        is_online=False,
                    ),
                    models.Device(
                        mac_address="AA:BB:CC:DD:EE:03",
                        ip_address="192.168.1.20",
                        hostname="Desktop-PC",
                        vendor="Microsoft",
                        type="PC",
                        is_online=True,
                    ),
                ]
                db.add_all(defaults)
                db.commit()
                devices = db.query(models.Device).offset(skip).limit(limit).all()
            return devices
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error retrieving/seeding devices")
            db.rollback()
            return []

    @staticmethod
    def wake_host(mac: str) -> bool:
        """
        Sends a Wake-on-LAN magic packet to the specified MAC address.
        """
        logger.info(f"Sending WoL packet to {mac}")
        success = wake_device(mac)
        if not success:
            logger.warning(f"Failed to wake device {mac}")
            raise StatSeaException("Failed to send WoL packet", status_code=500)
        return True

    @staticmethod
    def get_quota(db: Session, device_id: int) -> models.BandwidthQuota:
        quota = (
            db.query(models.BandwidthQuota)
            .filter(models.BandwidthQuota.device_id == device_id)
            .first()
        )
        if not quota:
            raise StatSeaException("Quota not found", status_code=404)
        return quota

    @staticmethod
    def set_quota(
        db: Session, device_id: int, quota_data: schemas.BandwidthQuotaBase
    ) -> models.BandwidthQuota:
        """
        Sets or updates a bandwidth quota for a specific device.
        """
        device = db.query(models.Device).filter(models.Device.id == device_id).first()
        if not device:
            logger.warning(f"Cannot set quota: Device {device_id} not found")
            raise DeviceNotFoundException(str(device_id))

        try:
            quota = (
                db.query(models.BandwidthQuota)
                .filter(models.BandwidthQuota.device_id == device_id)
                .first()
            )
            if not quota:
                quota = models.BandwidthQuota(device_id=device_id)
                db.add(quota)

            quota.daily_limit_bytes = quota_data.daily_limit_bytes
            quota.monthly_limit_bytes = quota_data.monthly_limit_bytes

            db.commit()
            db.refresh(quota)
            logger.info(f"Quota updated for device {device_id}")
            return quota
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error setting quota for device {device_id}")
            db.rollback()
            raise StatSeaException("Could not set quota", status_code=500) from e

    @staticmethod
    def delete_quota(db: Session, device_id: int):
        """
        Removes a bandwidth quota from a device.
        """
        quota = (
            db.query(models.BandwidthQuota)
            .filter(models.BandwidthQuota.device_id == device_id)
            .first()
        )
        if not quota:
            raise StatSeaException("Quota not found", status_code=404)

        try:
            db.delete(quota)
            db.commit()
            logger.info(f"Quota deleted for device {device_id}")
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error deleting quota for {device_id}")
            db.rollback()
            raise StatSeaException("Could not delete quota", status_code=500) from e
