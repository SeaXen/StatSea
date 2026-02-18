
import os
import sqlite3

db_path = r"d:\Gravity\StatSea\data\statsea.db"
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables:", [t[0] for t in tables])
    
    # Check alembic_version
    try:
        cursor.execute("SELECT * FROM alembic_version")
        print("Alembic version:", cursor.fetchall())
    except sqlite3.OperationalError:
        print("alembic_version table not found")
        
    conn.close()
