import secrets
import hashlib
from sqlalchemy.orm import Session
from app.models import models
from datetime import datetime, timezone

class ApiKeyService:
    @staticmethod
    def generate_api_key(db: Session, user_id: int, organization_id: int, name: str, permissions: str = "read"):
        """
        Generates a new API key. Returns the raw key (only time it's visible) and stores the hash.
        """
        raw_key = f"sk_live_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        
        api_key = models.ApiKey(
            key_hash=key_hash,
            name=name,
            user_id=user_id,
            organization_id=organization_id,
            permissions=permissions,
            created_at=datetime.now(timezone.utc)
        )
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
        
        return api_key, raw_key

    @staticmethod
    def verify_api_key(db: Session, raw_key: str):
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        api_key = db.query(models.ApiKey).filter(models.ApiKey.key_hash == key_hash).first()
        
        if api_key:
            api_key.last_used = datetime.now(timezone.utc)
            db.commit()
            return api_key
        return None

    @staticmethod
    def list_keys(db: Session, organization_id: int):
        return db.query(models.ApiKey).filter(models.ApiKey.organization_id == organization_id).all()

    @staticmethod
    def revoke_key(db: Session, key_id: int, organization_id: int):
        key = db.query(models.ApiKey).filter(models.ApiKey.id == key_id, models.ApiKey.organization_id == organization_id).first()
        if key:
            db.delete(key)
            db.commit()
            return True
        return False
