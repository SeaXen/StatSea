import sqlalchemy.exc
from sqlalchemy.orm import Session, selectinload

from ..schemas import defaults as schemas
from ..core.exceptions import DeviceNotFoundException, StatSeaException
from ..core.logging import get_logger
from ..core.monitor import wake_device
from ..models import models
from .audit_service import AuditService

logger = get_logger("DeviceService")


class DeviceService:
    @staticmethod
    def get_devices(db: Session, organization_id: int, cursor: int | None = None, limit: int = 100) -> schemas.CursorPage[schemas.Device]:
        """
        Retrieves devices from the database with cursor pagination for a specific organization.
        """
        try:
            query = db.query(models.Device).filter(models.Device.organization_id == organization_id).options(
                selectinload(models.Device.traffic_logs),
                selectinload(models.Device.ports)
            )
            
            if cursor is not None:
                query = query.filter(models.Device.id > cursor)
            
            devices = query.order_by(models.Device.id.asc()).limit(limit).all()
            next_cursor = devices[-1].id if len(devices) == limit else None
            return schemas.CursorPage(items=devices, next_cursor=next_cursor)
        except sqlalchemy.exc.SQLAlchemyError:
            logger.exception("Database error retrieving/seeding devices")
            db.rollback()
            return schemas.CursorPage(items=[], next_cursor=None)

    @staticmethod
    def get_device(db: Session, device_id: int, organization_id: int) -> models.Device:
        """
        Retrieves a specific device by ID, ensuring it belongs to the organization.
        """
        device = db.query(models.Device).filter(
            models.Device.id == device_id, 
            models.Device.organization_id == organization_id
        ).options(
            selectinload(models.Device.traffic_logs),
            selectinload(models.Device.ports)
        ).first()
        if not device:
            raise DeviceNotFoundException(str(device_id))
        return device

    @staticmethod
    def update_device(
        db: Session, device_id: int, organization_id: int, device_update: schemas.DeviceUpdate, actor_id: int | None = None
    ) -> models.Device:
        """
        Updates a device's information.
        """
        device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.organization_id == organization_id).first()
        if not device:
            raise DeviceNotFoundException(str(device_id))

        if device_update.nickname is not None:
            device.nickname = device_update.nickname
        if device_update.icon_type is not None:
            device.icon_type = device_update.icon_type
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
        
        AuditService.log_action(
            db=db,
            actor_id=actor_id,
            action="UPDATE",
            resource_type="DEVICE",
            resource_id=str(device.id),
            organization_id=organization_id,
            details={"updates": device_update.model_dump(exclude_unset=True)}
        )
        return device

    @staticmethod
    def wake_host(db: Session, mac: str, organization_id: int, actor_id: int | None = None) -> bool:
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
            
        AuditService.log_action(
            db=db,
            actor_id=actor_id,
            action="WAKE",
            resource_type="DEVICE",
            resource_id=str(device.id),
            organization_id=organization_id,
            details={"mac": mac}
        )
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
        db: Session, device_id: int, organization_id: int, quota_data: schemas.BandwidthQuotaBase, actor_id: int | None = None
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
            
            AuditService.log_action(
                db=db,
                actor_id=actor_id,
                action="UPDATE_QUOTA",
                resource_type="DEVICE",
                resource_id=str(device_id),
                organization_id=organization_id,
                details=quota_data.model_dump()
            )
            return quota
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error setting quota for device {device_id}")
            db.rollback()
            raise StatSeaException("Could not set quota", status_code=500) from e

    @staticmethod
    def delete_quota(db: Session, device_id: int, organization_id: int, actor_id: int | None = None):
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
            
            AuditService.log_action(
                db=db,
                actor_id=actor_id,
                action="DELETE_QUOTA",
                resource_type="DEVICE",
                resource_id=str(device_id),
                organization_id=organization_id,
            )
        except sqlalchemy.exc.SQLAlchemyError as e:
            logger.exception(f"Database error deleting quota for {device_id}")
            db.rollback()
            raise StatSeaException("Could not delete quota", status_code=500) from e
