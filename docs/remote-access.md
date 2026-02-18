# 🌐 StatSea — Remote Access Guide

StatSea is designed to run on your local network, but sometimes you need to check your dashboard from the office, the airport, or on the go. This guide covers the most secure and reliable ways to access your instance remotely.

---

## 🔒 Security Best Practices (READ FIRST)

Before exposing StatSea to the internet, ensure you have:
1.  **A strong Login Password:** (Enabled after Phase 7.4 implementation).
2.  **Firewall Enabled:** Use `ufw` or `iptables` to restrict access.
3.  **SSH Hardening:** If accessing the host via SSH, use SSH keys and disable root password login.

---

## 🛠️ Method 1: Tailscale (Easiest & Most Secure)

Tailscale creates a secure Mesh VPN between your devices. No port forwarding required.

1.  **Install Tailscale** on your StatSea host:
    ```bash
    curl -fsSL https://tailscale.com/install.sh | sh
    ```
2.  **Authenticate** by running `sudo tailscale up`.
3.  **Install Tailscale** on your phone/laptop.
4.  **Access:** Open your browser and go to `http://<tailscale-ip>:21080`.

**Pros:** Zero configuration, works behind CGNAT, naturally encrypted.
**Cons:** Requires the Tailscale app on every client device.

---

## ☁️ Method 2: Cloudflare Tunnels (Best for Public URLs)

Access your dashboard via a custom domain (e.g., `stats.yourdomain.com`) without opening any ports on your router.

1.  **Login to Cloudflare Dashboard** and go to **Zero Trust > Networks > Tunnels**.
2.  **Create a Tunnel** and follow the instructions to install `cloudflared` on your host.
3.  **Configure Public Hostname:**
    -   **Subdomain:** `stats`
    -   **Domain:** `yourdomain.com`
    -   **Service:** `HTTP://localhost:21080`
4.  **Security:** Add an **Access Application** rule in Cloudflare to require Google/GitHub login *before* reaching your StatSea instance.

**Pros:** No port forwarding, provides a clean URL, free SSL.
**Cons:** Requires a domain name pointed to Cloudflare.

---

## 🔄 Method 3: Reverse Proxy (Nginx Proxy Manager)

If you already host other services and have ports 80/443 open.

1.  **Setup Nginx Proxy Manager** (NPM) in Docker.
2.  **Add a Proxy Host:**
    -   **Domain Names:** `stats.yourdomain.com`
    -   **Forward Host:** `<your-host-ip>`
    -   **Forward Port:** `21080`
    -   **SSL:** Request a new Let's Encrypt certificate.
    -   **Websockets Support:** Enable this! (Required for real-time traffic view).

**Pros:** High control, can host multiple services on one IP.
**Cons:** Requires port forwarding on your router (80/443), higher risk.

---

## ❓ Troubleshooting

### My Dashboard shows "Backend Unavailable"
-   Ensure you enabled **WebSockets support** in your reverse proxy config.
-   If using a VPN, ensure the VPN subnet is allowed in the backend CORS settings (`CORS_ORIGINS`).

### Charts are slow to load
-   Remote access speed depends heavily on your home **Upload Speed**.
