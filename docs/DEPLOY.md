# StatSea Deployment Guide

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+ with npm
- **Docker** (optional, for container monitoring)
- Linux recommended for production (network monitoring uses raw sockets)

## Quick Start (Docker)

```bash
docker compose up -d
```

The app will be available at `http://localhost:8001`.

---

## Manual Deployment

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# .\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# IMPORTANT: Edit .env and set JWT_SECRET_KEY to a random 32+ char string
```

### 2. Database Setup

```bash
# Run migrations
alembic upgrade head
```

The database file will be created at `data/statsea_saas.db`.

### 3. Frontend Build

```bash
cd frontend
npm install
npm run build
```

The built files will be in `frontend/dist/`.

### 4. Start the Server

```bash
cd backend

# Development
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 1
```

> **Note**: SQLite requires `--workers 1`. For multi-worker setups, migrate to PostgreSQL.

### 5. First Login

- **URL**: `http://localhost:8001`
- **Username**: `admin`
- **Password**: `admin123`
- You will be prompted to change your password on first login.

---

## Production Checklist

| Item | How |
|------|-----|
| ✅ Change JWT secret | Set `JWT_SECRET_KEY` in `.env` |
| ✅ Change admin password | Login and change on first use |
| ✅ Set ENVIRONMENT | `ENVIRONMENT=production` in `.env` |
| ✅ Configure CORS | Set `CORS_ORIGINS` to your domain |
| ✅ Enable HTTPS | Use a reverse proxy (nginx, Caddy) |
| ⭐ Push notifications | Generate VAPID keys, set in `.env` |
| ⭐ Backups | Configure scheduled database backups |

---

## Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name statsea.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ws/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

---

## Network Monitoring

Network traffic capture requires elevated privileges:

```bash
# Linux: grant raw socket capability
sudo setcap cap_net_raw+ep $(which python3)

# Or run with sudo (not recommended for production)
sudo uvicorn app.main:app --host 0.0.0.0 --port 8001
```

On **Windows**, network monitoring uses limited functionality. Full monitoring requires a Linux host.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `JWT_SECRET_KEY` error on startup | Set a custom key in `.env` |
| Docker monitoring shows "unavailable" | Ensure Docker daemon is running and accessible |
| WebSocket disconnects | Check reverse proxy WebSocket config (see nginx example above) |
| Permission denied on network capture | Grant `cap_net_raw` or run as root |
| Database locked errors | Ensure only one worker process (`--workers 1`) |
