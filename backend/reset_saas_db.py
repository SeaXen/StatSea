import os
import sys

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import Base, engine
from app.models import models
from seed_org import seed_org
from seed_db import seed

def reset_db():
    db_path = "./data/statsea_saas.db"
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print(f"Removed existing database: {db_path}")
        except PermissionError:
            print(f"Error: Could not remove {db_path}. It might be in use.")
            return

    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

    print("Seeding organization...")
    seed_org()

    print("Seeding devices...")
    seed()
    
    print("Database reset and seeded successfully.")

if __name__ == "__main__":
    reset_db()
