from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.models import Device

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/statsea.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

devices = db.query(Device).all()
print(f"Total devices: {len(devices)}")
for d in devices:
    print(f"MAC: {d.mac_address} | IP: {d.ip_address} | Online: {d.is_online}")

db.close()
