from sqlalchemy.orm import Session
from app.models import models
import secrets

class StatusPageService:
    @staticmethod
    def get_settings(db: Session, organization_id: int):
        settings = db.query(models.StatusPage).filter(models.StatusPage.organization_id == organization_id).first()
        if not settings:
            # Create default settings if not exist
            settings = models.StatusPage(
                organization_id=organization_id,
                title="System Status",
                slug=secrets.token_urlsafe(8), # Random initial slug
                is_public=False
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return settings

    @staticmethod
    def update_settings(db: Session, organization_id: int, title: str = None, slug: str = None, is_public: bool = None, description: str = None):
        settings = StatusPageService.get_settings(db, organization_id)
        if title:
            settings.title = title
        if slug:
            # Check uniqueness if changed
            if slug != settings.slug:
                existing = db.query(models.StatusPage).filter(models.StatusPage.slug == slug).first()
                if existing:
                    raise ValueError("Slug already taken")
                settings.slug = slug
        if is_public is not None:
            settings.is_public = is_public
        if description is not None:
            settings.description = description
        
        db.commit()
        db.refresh(settings)
        return settings

    @staticmethod
    def get_public_status(db: Session, slug: str):
        page = db.query(models.StatusPage).filter(models.StatusPage.slug == slug, models.StatusPage.is_public == True).first()
        if not page:
            return None
        
        # Get active outages or system health for this org
        # For now, just return basic info + recent uptime summaries if available
        org_id = page.organization_id
        
        # Simple health check based on online devices? or Security alerts?
        # Let's return a simple "All Systems Operational" for now unless there are critical alerts
        
        return {
            "title": page.title,
            "description": page.description,
            "status": "operational", # Mocked
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
