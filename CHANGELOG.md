# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-24

### Added
- **Notifications**: Multi-channel notification system (Email, Slack, Discord, Telegram, ntfy, Web Push)
- **Docker**: Container management with stats, logs, actions (start/stop/restart)
- **Docker**: Image update checker for Docker Hub and GHCR
- **Agents**: Multi-node/remote agent support for distributed monitoring
- **Security**: Login rate limiting (5 requests/minute per IP)
- **Security**: Account lockout after failed login attempts
- **Security**: Password complexity policy (uppercase, number, special char)
- **Security**: Session management with revoke-others capability
- **Security**: Forced password change on first admin login
- **System**: Health checks with uptime monitoring
- **System**: Certificate expiration monitoring
- **System**: Database backup service
- **System**: System resource forecasting (RAM/disk trend analysis)
- **UI/UX**: Command palette (Ctrl+K) for quick navigation
- **UI/UX**: Onboarding tour for first-time users
- **UI/UX**: Connection globe with geolocation
- **UI/UX**: Session manager page
- **UI/UX**: Theme system with dark mode
- **Real-Time**: WebSocket heartbeat with exponential backoff reconnect
- **Analytics**: Bandwidth tracking per device and per group
- **Analytics**: DNS query logging
- **Analytics**: AI-based traffic predictions
- **Speedtest**: Ookla and Cloudflare providers with WebSocket progress
- **DevOps**: `.env.example` with all configuration variables documented
- **DevOps**: Deployment guide (`docs/DEPLOY.md`)

### Changed
- **Performance**: React Query for all data fetching (staleTime, caching, retries)
- **Performance**: Cursor-based pagination for device lists
- **Performance**: WebSocket throttling (max 2 updates/sec)
- **Architecture**: Modular route structure (`api/routes/*.py`)
- **Config**: Project version bumped to 1.0.0

### Fixed
- **Bug**: Duplicate timestamp filter in alerts query
- **Bug**: Naive `datetime.now()` → `datetime.now(timezone.utc)` in alerts and Docker update service
- **Bug**: Unterminated string literal in Docker monitor
- **Cleanup**: Removed unused `import random` from Docker monitor
- **Cleanup**: Removed stale mock data docstrings and comments
- **Cleanup**: Removed debug `console.log` from SpeedtestPage

### Security
- JWT secret validation prevents startup with default key in production
- Security headers middleware (CSP, HSTS, X-Frame-Options)
- Input sanitization module
- Global rate limiting via slowapi

## [0.9.0] - 2024-05-20

### Added
- Initial release of Phase 9 features.
- Basic dashboard structure.
- Network device scanning with Scapy.
