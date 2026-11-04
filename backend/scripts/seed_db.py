from app.db.database import SessionLocal
from app.models import models


def seed():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(models.Device).count() > 0:
            print("Database already has devices.")
            return

        # Get Default Organization
        org = db.query(models.Organization).filter(models.Organization.name == "Default Organization").first()
        if not org:
            print("Default Organization not found. Please run main.py seeding first.")
            return

        devices = [
            models.Device(mac_address="AA:BB:CC:DD:EE:01", ip_address="192.168.1.10", hostname="iPhone-13", vendor="Apple", type="Mobile", is_online=True, organization_id=org.id),
            models.Device(mac_address="AA:BB:CC:DD:EE:02", ip_address="192.168.1.11", hostname="Galaxy-S24", vendor="Samsung", type="Mobile", is_online=False, organization_id=org.id),
            models.Device(mac_address="AA:BB:CC:DD:EE:03", ip_address="192.168.1.20", hostname="Desktop-PC", vendor="Microsoft", type="PC", is_online=True, organization_id=org.id),
        ]
        db.add_all(devices)
        db.commit()
        print("Seeded 3 mock devices.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
