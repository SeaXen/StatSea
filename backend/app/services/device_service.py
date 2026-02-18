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
    def get_devices(db: Session, organization_id: int, skip: int = 0, limit: int = 100) -> list[models.Device]:
        """
        Retrieves devices from the database with pagination for a specific organization.
        If empty, seeds mock devices for initial setup.
        """
        try:
            devices = db.query(models.Device).filter(models.Device.organization_id == organization_id).offset(skip).limit(limit).all()
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
                        organization_id=organization_id,
                    ),
                    models.Device(
                        mac_address="AA:BB:CC:DD:EE:02",
                        ip_address="192.168.1.11",
                        hostname="Galaxy-S24",
                        vendor="Samsung",
                        type="Mobile",
                        is_online=False,
                        organization_id=organization_id,
                    ),
                    models.Device(
                        mac_address="AA:BB:CC:DD:EE:03",
                        ip_address="192.168.1.20",
                        hostname="Desktop-PC",
                        vendor="Microsoft",
                        type="PC",
                        is_online=True,
                        organization_id=organization_id,
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
    def get_device(db: Session, device_id: int, organization_id: int) -> models.Device:
        """
        Retrieves a specific device by ID, ensuring it belongs to the organization.
        """
        device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.organization_id == organization_id).first()
        if not device:
            raise DeviceNotFoundException(str(device_id))
        return device

    @staticmethod
    def update_device(
        db: Session, device_id: int, organization_id: int, device_update: schemas.DeviceUpdate
    ) -> models.Device:
        """
        Updates a device's information.
        """
        device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.organization_id == organization_id).first()
        if not device:
            raise DeviceNotFoundException(str(device_id))

        if device_update.hostname is not None:
            device.hostname = device_update.hostname
        if device_update.nickname is not None:
            device.nickname = device_update.nickname
        if device_update.notes is not None:
            device.notes = device_update.notes
        # if device_update.tags is not None:
        #    device.tags = device_update.tags
        if device_update.type is not None:
            device.type = device_update.type
        if device_update.group_id is not None:
            device.group_id = device_update.group_id    

        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def wake_host(db: Session, mac: str, organization_id: int) -> bool:
        """
        Sends a Wake-on-LAN magic packet to the specified MAC address.
        First verifies that the device belongs to the user's organization.
        """
        device = db.query(models.Device).filter(models.Device.mac_address == mac, models.Device.organization_id == organization_id).first()
        if not device:
            logger.warning(f"Unauthorized wake attempt for {mac} by org {organization_id}")
            raise DeviceNotFoundException(mac)

        logger.info(f"Sending WoL packet to {mac}")
        success = wake_device(mac)
        if not success:
            logger.warning(f"Failed to wake device {mac}")
            raise StatSeaException("Failed to send WoL packet", status_code=500)
        return True

    @staticmethod
    def get_quota(db: Session, device_id: int, organization_id: int) -> models.BandwidthQuota:
        # Check ownership
        device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.organization_id == organization_id).first()
        if not device:
            raise DeviceNotFoundException(str(device_id))

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
        db: Session, device_id: int, organization_id: int, quota_data: schemas.BandwidthQuotaBase
    ) -> models.BandwidthQuota:
        """
        Sets or updates a bandwidth quota for a specific device.
        """
        device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.organization_id == organization_id).first()
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
    def delete_quota(db: Session, device_id: int, organization_id: int):
        """
        Removes a bandwidth quota from a device.
        """
        # Check ownership
        device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.organization_id == organization_id).first()
        if not device:
            raise DeviceNotFoundException(str(device_id))

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
