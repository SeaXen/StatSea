from sqlalchemy.orm import Session
from app.models import models
import uuid

class BillingService:
    @staticmethod
    def create_customer_stub(db: Session, organization_id: int):
        org = db.query(models.Organization).filter(models.Organization.id == organization_id).first()
        if not org:
            return None
        
        # Initialize Stripe Customer ID Stub
        if not org.stripe_customer_id:
            org.stripe_customer_id = f"cus_{uuid.uuid4().hex[:14]}"
            db.commit()
            db.refresh(org)
        
        return org.stripe_customer_id

    @staticmethod
    def subscribe_org(db: Session, organization_id: int, plan: str):
        # Valid plans: free, pro, enterprise
        if plan not in ["free", "pro", "enterprise"]:
            raise ValueError("Invalid plan tier")

        org = db.query(models.Organization).filter(models.Organization.id == organization_id).first()
        if org:
            org.plan_tier = plan
            org.subscription_status = "active"
            # In a real app, we'd create a checkout session or subscription here
            db.commit()
            db.refresh(org)
        return org

    @staticmethod
    def get_portal_url(organization_id: int):
        # Return a placeholder portal URL
        return f"https://billing.stripe.com/p/session/stub_{organization_id}"
