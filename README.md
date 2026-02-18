# 🌊 StatSea - Real-time Network Intelligence

StatSea is a premium, real-time network monitoring dashboard designed for home enthusiasts and developers. It uses Scapy for deep packet inspection and a React-based glassmorphism UI for a stunning visual experience.

---

## 🚀 Deployment Guide (Linux Mint / CasaOS)

### 1. System Requirements
- **OS**: Linux (Optimized for Linux Mint 21+)
- **Tools**: Docker & Docker Compose v2
- **Permissions**: Root/Sudo access (required for raw packet capture)

### 2. Quick Install
We've provided a one-click deployment script.

```bash
# Set permissions
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

### 3. Port Information
To avoid conflicts with common services, StatSea uses uncommon ports:
- **Frontend Dashboard**: `http://<your-ip>:21080`
- **Backend API**: `http://<your-ip>:21081`

---

## 🏠 CasaOS Setup

If you are using CasaOS, you can easily add StatSea as a custom app:

1.  **Open CasaOS Dashboard**.
2.  Go to **App Store** > **Custom Install**.
3.  Fill in the following:
    - **App Name**: `Statsea`
    - **Icon URL**: `https://raw.githubusercontent.com/lucide-react/lucide/main/icons/network.svg` (or your favorite)
    - **WebUI Port**: `21080`
4.  Click **Install**.

---

## 🛠️ Advanced Configuration

### Docker Compose
The system runs in **Host Network Mode** for the backend engine. This allows the application to "see" your router's traffic directly.

- **Frontend Image**: Multi-stage Nginx build.
- **Backend Image**: Python 3.11-slim with `libpcap-dev`.

### Data Persistence
Telemetry data and discovered devices are stored in the `./backend/data/` directory. This ensures your data survives container updates or restarts.

---

## ❓ Troubleshooting

**Q: Why do I see "Mock Data" on the dashboard?**
**A**: This happens if `libpcap` or `Npcap` is not detected. On Linux, ensure you have the `libpcap-dev` dependency (the Dockerfile installs this automatically).

**Q: Why doesn't the WebSocket connect from my phone?**
**A**: Ensure your phone is on the same network and that you are using the Server's IP address (e.g., `http://192.168.1.50:21080`).

---

## 📖 API Documentation

The backend provides a RESTful API documented via Swagger UI.

- **Docs:** `http://localhost:21081/docs`
- **ReDoc:** `http://localhost:21081/redoc`

### Key Endpoints

- `GET /api/devices`: List all tracked devices
- `GET /api/traffic/history`: Network traffic history
- `POST /api/speedtest/run`: Trigger a speed test
- `GET /api/system/stats`: System resource usage

## 🧪 Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test
```

---

*Made with ❤️ by Antigravity*
