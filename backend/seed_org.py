from app.db.database import SessionLocal
from app.models import models

def seed_org():
    db = SessionLocal()
    try:
        # 1. Create default Organization
        org = db.query(models.Organization).filter(models.Organization.name == "Default Organization").first()
        if not org:
            org = models.Organization(name="Default Organization", plan_tier="enterprise")
            db.add(org)
            db.commit()
            db.refresh(org)
            print("Default Organization created.")
        else:
            print("Default Organization already exists.")

        # 2. Create Admin User
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin:
            hashed_pw = models.User.get_password_hash("admin123")
            admin = models.User(
                username="admin",
                email="admin@statsea.local",
                hashed_password=hashed_pw,
                full_name="StatSea Admin",
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print("Default admin user created: admin / admin123")
        else:
            print("Admin user already exists.")
        
        # 3. Add Admin to Organization
        member = db.query(models.OrganizationMember).filter(
            models.OrganizationMember.user_id == admin.id, 
            models.OrganizationMember.organization_id == org.id
        ).first()
        
        if not member:
            member = models.OrganizationMember(user_id=admin.id, organization_id=org.id, role="owner")
            db.add(member)
            db.commit()
            print("Admin added to Default Organization.")
        else:
            print("Admin already in Default Organization.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_org()
