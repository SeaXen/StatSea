import os
import sys

# Ensure backend directory and script directory are in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.append(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from seed_db import seed
from seed_org import seed_org

from app.db.database import Base, engine
from app.models import models


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
