# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Working alert rules**: `SecurityRule` conditions are now evaluated by a safe restricted parser (no `eval`) on a 5-minute schedule; matches create org-scoped `SecurityAlert`s, send notifications and broadcast over WebSocket. Legacy `bytes`/`proto` rule text is aliased to the real traffic fields.
- **Alert resolution**: `PATCH /api/alerts/{id}/resolve` clears the 404 from the existing "Resolve alert" button.
- **Anomaly alerting**: hourly job persists detected usage anomalies as alerts (deduped per device/day); the anomalies endpoint is now organization-scoped.
- **Capture/engine watchdog**: `/api/health` now reports collector/capture/scheduler state, and a 5-minute job alerts on capture failure or a stopped scheduler.
- **Scheduled email reports**: real settings endpoints (`GET|POST /api/reports/settings`), an hourly sender with frequency dedupe, org-scoped report/export queries, and PDF aliases for the four report card IDs.
- **Backup restore & download**: `POST /api/system/backups/{id}/restore` (path-traversal guarded) and `GET /api/system/backups/{id}/download`, with matching UI actions in System → Backups.
- **Data retention settings**: new Settings section exposing all five `retention_days_*` keys.
- **Mobile navigation parity**: BottomNav "More" sheet exposes the 8 destinations previously reachable only by desktop or the command palette.
- **Settings export**: `GET /api/settings/export` backs the existing Export Data button.

### Fixed
- **CI typecheck step**: Added the missing `npm run tsc` script so the frontend CI typecheck gate no longer fails with "missing script".
- **Frontend test setup**: Configured a jsdom URL and an in-memory `localStorage` shim, fixing 5 tests that crashed on `localStorage.getItem`. All 30 Vitest tests now pass.
- **Single test config**: Removed the dead `test` block from `vite.config.ts` and deleted `frontend/src/test/setup.ts`; `vitest.config.ts` is now the only test config.
- **Docker Compose production deploy**: Added a required `JWT_SECRET_KEY` (fails fast if unset) and a backend healthcheck on `/api/health` so the frontend's `service_healthy` dependency can be satisfied.
- **One-command deploy**: `deploy.sh` now generates a random `JWT_SECRET_KEY` in `.env` on first run.
- **Documentation drift**: Aligned `.env.example` files and `docs/DEPLOY.md` with code defaults (Python 3.11+, UI `:21080` / API `:21081`, `statsea_saas.db`, 30-minute tokens) and documented all environment variables.
- **Benchmark honesty**: Removed hardcoded pass-count badges/scorecards from `README.md` and the remediation record; the Playwright script is now labelled an 11-step manual script not run in CI.

## [1.1.0] - 2026-11-05

### Security & Authentication
- **Token Version Revocation**: Added `token_version` column to `users` schema (Alembic migration `7a1e2f3b4c5d`) for instant, cluster-wide session and refresh token invalidation on password reset or manual session termination.
- **Strict RBAC Route Protection**: Secured administrative endpoints (`/api/v1/users`, `/api/v1/auth/tokens`, `/api/v1/audit-logs`) with `require_admin` dependency; enforced non-admin 403 authorization guards on container logs (`/api/v1/docker/logs`).
- **Refresh Token Reuse Detection**: Implemented replay detection in `AuthService.refresh_token` with immediate revocation of all active family sessions on token reuse.
- **WebSocket Protocol Authentication**: Migrated WebSocket handshake to use `Sec-WebSocket-Protocol` header alongside cookie/query token extraction with full `_extract_user_from_token` validation.
- **Cache Isolation**: Fixed endpoint cache control header from `public` to `private, max-age={max_age}` in `app/api/deps.py` to prevent multi-user proxy cache poisoning.

### Performance & Optimization
- **Heatmap Memoization ($O(1)$ Rendering)**: Eliminated 168 redundant `Math.max` and array scans per render in `AnalyticsDashboard.tsx` via precomputed lookup `Map` and hoisted `maxHeatmapVal`.
- **WebSocket Context Decoupling**: Split monolithic WebSocket context into `WsDataContext` and `WsActionsContext` (with `useWsData()` and `useWsActions()`), preventing high-frequency streaming packet re-renders in static action buttons.
- **Devices List Pagination**: Added 25 rows/page client pagination controls to `DevicesPage.tsx` with memoized device filtering and instant query invalidation.
- **Code Splitting**: Lazy-loaded `OnboardingTour` via `React.lazy()` and `Suspense`, trimming the initial critical JS bundle.
- **Database Session Safety**: Guarded long-running background speedtest execution with `with SessionLocal() as db:` context manager to eliminate leaked SQLite connections.

### UI, UX & Accessibility
- **Accessible Toast Confirmations**: Eliminated all blocking native browser `window.confirm()` dialogs across User Management, Settings, Notifications, Groups, Docker, and Analytics rules in favor of non-blocking, accessible Sonner toast actions.
- **Modal Focus Management**: Implemented `useModalA11y` hook with keyboard focus trap, Escape key dismiss, initial focus setting, and focus restoration to trigger elements (`RulesModal`, `GroupManager`, `SystemDetailOverlay`).
- **Web Design Guidelines Polish**: Replaced native HTML `<select>` elements with fully keyboard-accessible custom `CustomSelect` dropdown components; enforced standardized typographical ellipsis (`…`) on all truncated UI text; set explicit dimensions (`width`, `height`) on all images to eliminate Cumulative Layout Shift (CLS); refined CSS transitions from unconstrained `transition-all` to GPU-accelerated `transition-colors` and `transition-transform`.
- **WCAG AA Contrast Compliance**: Darkened Daylight theme `--faint` token from `#98a0b5` to `#68728d` (exceeding 4.6:1 contrast ratio against `#ffffff`).
- **Mobile Touch Safeguards**: Enforced `16px` minimum font size on input elements on `<768px` viewports in `index.css` to prevent mobile Safari auto-zoom; responsive topbar wrapping on 390px screens.
- **Semantic Token Refactoring**: Purged hardcoded `text-white` on `bg-panel`/`bg-raised` across `TopStatsRow`, `CertMonitor`, `ErrorBoundary`, and `OnboardingTour`.
- **Playwright E2E Test Suite**: Added 11-phase automated browser test suite (`tests/test_statsea_e2e_playwright.py`) validating unauthenticated redirection, credential verification, telemetry sniffer badges, 12 navigation tabs, timeline horizons, theme presets, search filtering, and clean logout.

### Telemetry & Real Data Integrity
- **Zero Mock Metrics Policy**: Replaced hardcoded fake 4-adapter NIC table (`eth0`, `wlan0`, `docker0`, `tun0`) with real dynamic interfaces from `useInterfaces()` / `useBandwidthSummary()`, with honest empty states when no metrics exist.
- **Real Analytics Aggregations**: Replaced hardcoded zero heatmap in `collector.py` with real 7x24 historical aggregations; fixed upload/download rate math; removed fake `totalThroughput * 125` packet calculation.
- **Accurate Calendar Days**: Updated `ai_predictor.py` to compute days in month dynamically via `calendar.monthrange` instead of assuming 30 days.
- **Host Metrics Calibration**: Primed `psutil.cpu_percent(interval=None)` on server startup; eliminated fake synthetic Windows CPU load formula.

### Infrastructure & Code Quality
- **Layered Service Architecture**: Extracted `BandwidthAggregationService` (`backend/app/services/bandwidth_service.py`) from route handlers.
- **Pinned Dependencies**: Pinned backend `requirements.txt` dependencies to exact versions.
- **CI Hardening**: Removed `|| true` suppressions from GitHub Actions workflow; enforced strict exit codes on pytest and typechecks.
- **Repository Governance**: Added official root MIT `LICENSE` and updated `README.md` test and theme scorecards.

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
