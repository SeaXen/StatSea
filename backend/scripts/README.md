# Backend Utility Scripts

This directory contains standalone database administration and maintenance utilities:

- **`init_db.py`**: Initializes database tables using SQLAlchemy models.
- **`check_db.py`**: Queries and prints registered devices from `data/statsea.db`.
- **`inspect_db.py`**: Inspects database tables and schema.
- **`seed_db.py`**: Seeds sample metrics, devices, and traffic categories for local development.
- **`seed_org.py`**: Seeds an organization with initial admin credentials.
- **`reset_saas_db.py`**: Clears and re-seeds the multi-tenant SaaS tables.
- **`generate_vapid_keys.py`**: Generates VAPID key pairs for Web Push notifications.

## Usage
Run with python from the `backend/` directory:
```bash
python scripts/init_db.py
python scripts/seed_db.py
```
