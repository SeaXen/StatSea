# StatSea — 10/10 Audit & Fixes Plan

**Audited:** branch `main` @ HEAD
**Method:** six parallel sector audits, every claim verified by reading the code or running it (`pytest` = 60 passed, `tsc --noEmit` exit 0, `npm run lint` exit 0, bundle measured from `frontend/dist`).

---

## 1. The honest verdict

**StatSea is not 10/10 in any sector. Weighted overall: ~4.5/10.**

| Sector | Score | Headline reason |
|---|---|---|
| Security & Abuse | **4/10** | The JWT-secret guard misses the placeholder the repo itself ships; Docker socket + `docker` group = root on the host; container logs readable by any user; forced-password-change is never enforced |
| Product UX & Accessibility | **5/10** | Not one modal has focus management; `--faint` text fails WCAG AA in all six themes; the Map view is mouse-only; hardcoded hex colors break theme sync |
| Performance & Bundle | **5/10** | Bundle claim understated 4.5×; the device list eager-loads an unbounded `traffic_logs` relation; the whole React tree re-renders 2×/sec; collector N+1 |
| Testing & CI | **4/10** | The suite only passes by alphabetical order; three tests are literal fakes; zero RBAC negative tests; CI has `\|\| true` on every gate; no coverage tooling at all |
| Correctness & Telemetry | **4/10** | 10+ hardcoded fake values reach the production UI; DNS logs are never persisted; the WebSocket drains the bandwidth counters; eight analytics fields are never populated |
| Docs / Architecture / Observability | **Docs 6 / Arch 7.5 / Obs 6** | No LICENSE file exists; 4 of 6 theme tables in the README are wrong; the JSON log formatter silently drops every structured field; capture failure never alerts |
| Visual / Browser / Compatibility | **5/10** | Audited 2026-11-05 by running the app. At 390px, 7 of 12 nav destinations are off-screen with no hamburger; the NIC table is pure fiction; TanStack devtools ship in the UI; 13px base type. Desktop layout, theme switching and empty states are genuinely good |

**What is genuinely good** (so an agent doesn't "fix" it): TypeScript strictness with zero `as any`/`@ts-ignore`; real route-level code splitting with `vendor-three` correctly deferred; no SQL or command injection surface; CORS is correctly locked down in production; request-ID middleware with contextvar propagation; graceful lifespan shutdown; the SIMULATION MODE badge is truthful about its own synthetic data. Confirmed by running it on 2026-11-05: theme switching works, no console errors on any page walked, the analytics summary honestly returns zeros rather than inventing numbers, and the empty states are well written.

The pattern to notice: **the engineering is better than the honesty of the numbers on screen.** The app is better built than it is truthful.

---

## 2. Myth-busting — claims that are provably false

Before fixing code, an agent must know which documents lie. Each row is a claim with the file:line that disproves it.

| # | Claim | Disproved by |
|---|---|---|
| M1 | `statsea-10-out-of-10-remediation.md` scorecard: all 11 sectors at 10/10 | This audit; see §1 |
| M2 | "single consistent port configuration (`8001`)" | `docker-compose.yml:15` `PORT=21081`, `backend/Dockerfile` CMD `--port 21081`, `frontend/nginx.conf:20` `proxy_pass 127.0.0.1:21081`. (README is consistent; the *remediation doc* is the wrong one) |
| M3 | "zero blocking alert modals" | `AnalyticsDashboard.tsx:341`, `SettingsPage.tsx:68`, `UserManagement.tsx:125` — three live `window.confirm()` calls |
| M4 | "100% synchronized themes" | `OnboardingTour.tsx:71,85` `text-white` on `bg-card` (white-on-white in Daylight); `ErrorBoundary.tsx:41`; `DevicesPage.tsx:165` `bg-[#0A0B0E]`; `NotificationCenter.tsx:33`; `App.tsx:41`; `LoginPage.tsx:168` |
| M5 | "zero mock data in production" | §4 Phase 1 fake-data inventory — 10+ ungated values |
| M6 | Badge `License: MIT` linking `./LICENSE`; `CONTRIBUTING.md:60` links `LICENSE` | **No LICENSE file exists** (`git ls-files` returns nothing) |
| M7 | README theme table: Cyberpunk accent `#00ffcc`, bg `#08080f` | `themes.ts:114` accent is `#facc15`; `themes.ts:130` bg is `#0a0e17`. Also Dracula (`:158`,`:174`), Nord (`:218`), Midnight (`:262`) — **4 of 6 themes wrong**. Same staleness in `DESIGN.md:117-120` |
| M8 | README badge "Playwright E2E: 11/11 Passing" vs remediation doc "8/8 phases passed" | Contradictory counts; `tests/test_statsea_e2e_playwright.py:131-134,207,223` wrap assertions in `if is_visible()` soft-skips; `:25` hardcodes an absolute artifact path `C:\Users\Sagar-EB\.gemini\...` |
| M9 | README:239 — `/api/health` reports "sniffer state" | `backend/app/api/routes/health.py:32-41` returns only `status`/`database`/`memory` |
| M10 | "41.77 kB" bundle | Real initial gzip transfer from `frontend/dist`: entry 42.6 + `vendor-ui` 80.9 + `vendor-motion` 37.7 + `vendor-query` 15.0 + CSS 11.9 = **~188 kB**, i.e. 4.5× the claim |

---

## 3. How to run these fixes safely

The six phases below are ordered by risk-to-users, not by convenience. **Phases 0 and 1 should land before anything else.**

**Shared-file conflicts.** Several files are touched by more than one phase. If you hand a single phase to an agent, tell it which lines belong to it; if you run two agents in parallel, keep them off the same file.

| File | Phases that touch it |
|---|---|
| `backend/app/main.py` | 0 (JWT guard, docs exposure, admin seed), 6 (create_all/alembic, config) |
| `backend/app/core/collector.py` | 1 (DNS flush, rate division, heatmap, datetime, N+1), 2 (N+1 batching), 6 (failure alerting) |
| `backend/app/api/routes/websockets.py` | 0 (query-string JWTs), 1 (bandwidth drain, frame throttle, session leak) |
| `docker-compose.yml` | 0 (socket/group), 2 (healthcheck), 6 (healthcheck wiring) |
| `frontend/src/App.tsx` | 1 (fake packet count, fake interface), 2 (lazy OnboardingTour) |
| `backend/app/api/routes/metrics.py` | 0 (unauth write), 6 (Prometheus) |
| `frontend/vite.config.ts` | 2 (chunkSizeWarningLimit), 3 (manifest icons) |
| `backend/requirements.txt` | 0 (pin/migrate), 4 (pytest-cov, pytest-mock) |
| `backend/app/models.py` | 0 (`token_version` column — **requires an Alembic revision**, see Phase 6) |

**Sequencing constraint that matters:** Phase 0's `token_version` column adds a migration, and Phase 6 decides the Alembic-vs-`create_all` policy. Do Phase 6's Alembic decision *before* Phase 0's migration, or Phase 0's new revision will be orphaned.

---

## PHASE 0 — Security & Abuse (score 4/10)

**Goal: close the paths that let someone become admin or root without credentials.**

### P0-1 [CRITICAL] Production JWT-secret guard misses the shipped placeholder
**`backend/app/main.py:111`** — the startup check compares only against `"statsea-jwt-secret-key-change-me-at-least-thirty-two-chars"`, but `backend/.env.example:9` ships `JWT_SECRET_KEY=CHANGE-ME-to-a-random-string-at-least-32-chars-long`. Copying the example (as `.env.example:2` instructs) with `ENVIRONMENT=production` (line 5) **passes the guard** and signs HS256 tokens with a publicly-known secret → forge `{"sub":"admin"}` for instant admin.

**Change:** replace the single-string comparison with a real validation that fails closed.
```python
# backend/app/main.py, replace the block at :111
import secrets as _secrets

_PLACEHOLDER_PATTERNS = ("change-me", "changeme", "change_me", "your-secret",
                         "placeholder", "example", "todo", "xxx", "secret-key-change")

def _validate_jwt_secret(secret: str | None) -> str:
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not set. Refusing to start.")
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters.")
    lowered = secret.lower()
    if any(p in lowered for p in _PLACEHOLDER_PATTERNS):
        raise RuntimeError(
            "JWT_SECRET_KEY looks like a placeholder. Generate one with "
            "`python -c \"import secrets; print(secrets.token_urlsafe(48))\"`."
        )
    return secret
```
Call it unconditionally at startup (not only in production — a missing key must never silently randomise, see P0-10). **Effort: S.**

**Verify:** `cp backend/.env.example backend/.env` then start the backend → it must refuse to boot with the placeholder error. Then set a real secret and confirm it boots.

### P0-2 [CRITICAL] Docker socket + `docker` group = root on the host
**`docker-compose.yml:12`** mounts `/var/run/docker.sock:ro` while **`backend/Dockerfile:31`** adds the app user to the `docker` group, plus `network_mode: host` and `cap_add: NET_RAW/NET_ADMIN` (`:6-9`). `:ro` is meaningless — the Docker API is writable regardless, so any admin can call `/api/docker/containers/{id}/action` or `/prune` to spawn a privileged container mounting `/`.

**Change:** (a) delete `RUN groupadd -f docker && usermod -aG docker $APP_USER` from `Dockerfile:31`; (b) delete the `volumes:` docker.sock entry from `docker-compose.yml:12`; (c) add a `docker-socket-proxy` service exposing only `GET` on `containers`, `images`, `info`, `version` and point the backend at `http://docker-proxy:2375` via a `DOCKER_HOST` setting.

`NET_ADMIN` is also broader than the app needs — narrow to `NET_RAW` only unless a feature requires more. **Effort: M.**

**Verify:** `docker compose up -d`, then `curl -X POST localhost:21080/api/docker/prune` as admin → must return 503/501, not a prune result. Confirm the Map/ping features still work.

### P0-3 [HIGH] Container logs exposed to all authenticated users
**`backend/app/api/routes/docker.py:65`** — `get_container_logs` depends on `get_current_user`, while the mutating actions in the same file correctly require admin. Container logs routinely carry env vars and secrets.

**Change:** swap the dependency to `get_current_admin_user`, and add a redaction pass:
```python
_REDACT = re.compile(r"(?i)(password|secret|token|api[_-]?key|authorization)\s*[:=]\s*\S+")
def _redact(text: str) -> str:
    return _REDACT.sub(lambda m: m.group(1) + "=***REDACTED***", text)
```
**Effort: S.**

**Verify:** add a backend test asserting 403 for a non-admin token on `GET /api/docker/containers/{id}/logs`.

### P0-4 [HIGH] Seeded `admin/admin123` never forced to rotate, and written to the log
**`backend/app/main.py:76-84`** creates admin with `must_change_password=True` and logs `"Default admin user created: admin / admin123"` into `logs/statsea.log`. Nothing consumes the flag anywhere — only a schema default at `backend/app/schemas/defaults.py:219`.

**Change:** (a) remove the credentials from the log line — log only `"Default admin user created; password rotation required"`; (b) enforce the flag: in the token-issuing path (`backend/app/core/auth_jwt.py`), refuse access tokens while `must_change_password` is set, returning 403 with a message pointing at `POST /api/auth/change-password`; (c) add a test that a login for a flagged user yields no usable access token.

**Effort: M.**

### P0-5 [MEDIUM] Access tokens are unrevocable
**`backend/app/core/auth_jwt.py:44-58`** has no `jti`/token-version check, so logout, `change_password`, and `revoke_other_sessions` all leave valid access tokens for up to 30 minutes.

**Change:** add `token_version = Column(Integer, default=1, nullable=False)` to `User` (`backend/app/models.py`), embed `"tv": user.token_version` in the claims, and in `get_current_user` reject a mismatch. Increment `token_version` in `change_password` and in the revoke-sessions endpoint. **Requires an Alembic revision — see the Phase 6 note.** **Effort: M.**

### P0-6 [MEDIUM] Refresh tokens stored plaintext, no reuse detection
**`backend/app/services/auth_service.py:67-73`** writes the raw token; rotation at `:127` revokes but doesn't invalidate the whole family.

**Change:** store `hashlib.sha256(raw.encode()).hexdigest()` — exactly what `backend/app/services/api_key_service.py:17` already does — and on rotation, if the presented token was already used, revoke every session for that user (classic refresh-reuse detection). **Effort: S.**

### P0-7 [MEDIUM] JWTs passed in query strings
**`backend/app/api/routes/websockets.py:76,115,130`** and `routes/auth.py:77` accept tokens as query params. nginx logs `$request` by default, so tokens land in access logs.

**Change:** accept the token in the `Sec-WebSocket-Protocol` header (the standard trick for browser WebSockets, which cannot set headers) and delete the `current_token` query param. Update `frontend/src/contexts/WebSocketContext.tsx` to pass `new WebSocket(url, ["Bearer", token])`. **Effort: M.**

### P0-8 [MEDIUM] `/docs`, `/redoc`, `/openapi.json` exposed in production
**`backend/app/main.py:137-142`** never disables them while compose sets `ENVIRONMENT=production`.

**Change:**
```python
_is_dev = settings.ENVIRONMENT.lower() in ("development", "dev", "local")
app = FastAPI(
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,
)
```
**Effort: S.**

### P0-9 [MEDIUM] Unauthenticated unlimited log-write endpoint
**`backend/app/api/routes/metrics.py:30-47`** — `POST /api/metrics/client-errors` has no auth, no rate limit, writes arbitrary JSON to disk, and returns `str(e)` at `:47`.

**Change:** require `get_current_user`, cap the body (e.g. 4 KB via a length check before parsing), apply `@limiter.limit("20/minute")`, and replace `detail=f"...{str(e)}"` with a generic message logged server-side. **Effort: S.**

### P0-10 [MEDIUM] Missing JWT secret silently randomises
**`backend/app/core/config.py:14`** — a missing `JWT_SECRET_KEY` yields a per-process random key, invalidating every session on restart with no warning. Fold this into the P0-1 validator so it can never happen. **Effort: S.**

### P0-11 [MEDIUM] Dependency CVEs
**`backend/requirements.txt:28`** — `python-jose` unpinned and in an affected range (CVE-2024-33663 <3.4.0, CVE-2026-85394 ≤3.5.0 CVSS 9.3). `requests==2.31.0` is CVE-2024-35195. `aiosqlite>=0.19.0`, `bcrypt>=4.1.0`, `bleach>=6.0.0`, `python-multipart>=0.0.6` (CVE-2024-47874) all float.

**Change:** pin every dependency with `==`; migrate `python-jose` → `PyJWT` (`jwt.encode`/`jwt.decode` with `algorithms=["HS256"]`) — the call sites in `auth_jwt.py` are few. **Effort: S.**

### P0-12 [LOW] In-memory rate limiter applied to almost nothing
**`backend/app/core/limiter.py:4`** — only `/auth/login`, `/auth/refresh` and two docker endpoints are limited; the single-worker Dockerfile (`backend/Dockerfile:46`) is the only thing preventing a multi-worker bypass. Add a Redis backend and default limits on all mutating routes. **Effort: M.**

### P0-13 [LOW] Dead API-key auth
**`backend/app/core/auth.py:14`** defines `_DEFAULT_KEY = "statsea-default-secret-key-change-me"` but no route imports `verify_api_key`, and `backend/app/services/api_key_service.py:34`'s verifier is never called — so `/api/keys` mints keys that authenticate nothing while accepting an unvalidated `permissions` string (`backend/app/api/api_keys.py:16`).

**Change:** either delete the API-key surface entirely, or wire the verifier in and validate `permissions` against an enum. Do not leave a mint button that produces dead credentials. **Effort: S.**

### P0-14 [LOW] Tokens in localStorage with a weak CSP
**`frontend/src/context/AuthContext.tsx:26-27`** stores tokens in `localStorage`; **`backend/app/main.py:206-213`** allows `'unsafe-inline' 'unsafe-eval'` in `script-src`. Move to httpOnly cookies and drop `unsafe-eval`. **Effort: M.**

### P0-15 [CRITICAL — raised from LOW by the browser audit] Tenant isolation deletes the device fleet
**`backend/app/api/deps.py:19-26`** — `get_current_org_id` returns the *first* membership, so org-scoped reads such as `/api/network/topology` aren't bound to a real selection. Also fixes the cross-tenant leakage in P1-7.

**Why this is CRITICAL, not LOW:** the collector never sets `organization_id` (`collector.py:547-555`), so every device row is `NULL`, while `device_service.py:21` filters `organization_id == 1`. Proven at runtime on 2026-11-05: the database holds 3 devices and `GET /api/devices` returns `items: []`. No tenant can see any device, ever. **Fix together with P7-1** — set `organization_id` on write, backfill `NULL` rows with a migration, and make `get_devices` treat `organization_id IS NULL` as globally visible rather than invisible. **Effort: M.**

### P0-16 [LOW] Internal exception text leaked to clients
`routes/reports.py:66` (`detail=f"Failed to generate PDF: {str(e)}"`), `backend/app/core/ip_intel.py:63`, `backend/app/core/docker_monitor.py:235`. Return a generic message; log the detail server-side. **Effort: S.**

**Phase 0 verified clean** (don't touch): SQL injection (no raw interpolation; only `text("SELECT 1")` and PRAGMAs); command injection (`docker.py:83` whitelists actions, `monitor.py:32` uses hardcoded ping targets, speedtest `provider` is string-compared only, `server_id` is typed `int`); SSRF (`ip_intel.py:21` blocks private/loopback/link-local); committed secrets (`.gitignore:18`, only `.env.example` tracked); CORS wildcard-with-credentials (`main.py:181-193` blocks `*` in production, localhost regex is dev-only); admin RBAC on `admin.py`, `alerts.py`, `groups.py`, `system.py`.

---

## PHASE 1 — Correctness & Telemetry (score 4/10)

**Goal: every number on screen is either real or honestly absent.**

### P1-1 [CRITICAL] DNS telemetry is never persisted
**`backend/app/core/collector.py:158-159, 267-274`** — `dns_log_buffer` is appended to but no flush exists anywhere; `models.DnsLog` is never inserted. The DNS feature silently returns empty and the buffer grows unbounded in the packet hot path.

**Change:** add `_flush_dns_logs()` mirroring `_flush_app_traffic` (one bulk `insert` of buffered dicts, then clear), call it from `_persistence_loop`, and cap the buffer at e.g. 10 000 entries with drop-oldest. **Effort: M.**

**Verify:** capture traffic with DNS queries, then `GET /api/dns/logs` returns rows.

### P1-2 [CRITICAL] The WebSocket reader destroys bandwidth accounting
**`backend/app/api/routes/websockets.py:90`** calls `get_current_stats()`, which zeroes `upload_acc`/`download_acc` at **`collector.py:495-496`**. So `_persist_daily_stats` (`collector.py:620-630`) computes a negative delta and never writes `BandwidthHistory`. `/network/history`, the Dashboard chart and NetworkComparison starve whenever any client is connected.

**Change:** keep two separate fields — `total_upload`/`total_download` as monotonic lifetime counters, and `interval_upload`/`interval_download` as per-window deltas. `get_current_stats()` returns the deltas and resets *only* those; `_persist_daily_stats` reads the lifetime counters. **Effort: M.**

**Verify:** open the dashboard, wait 2 minutes, confirm `GET /api/network/history` has new rows (before the fix it has none while a client is connected).

### P1-3 [CRITICAL] Live gauges read a counter the WebSocket drains
**`collector.py:831-832`** — `upload_rate`/`download_rate` return the raw accumulators with no time division, reset every second by the WS loop, so they read ≈0.

**Change:** return `delta_bytes / elapsed_seconds`, tracking `_last_rate_ts`. **Effort: S.**

### P1-4 [CRITICAL] Eight analytics fields are declared, charted, and never populated
**`collector.py:135-151` vs `:826-845`** — `bandwidth_history`, `packet_size_buckets`, `dns_queries`, `http_requests`, `active_sessions`, `connection_types`, `bytes_per_protocol`, `suspicious_count` all appear in the summary payload and in `AnalyticsDashboard` charts but nothing in `_packet_callback` ever updates them.

**Change:** either implement the increments in `_packet_callback` (preferred — these are the product) or delete the widgets. Do not ship a chart of a constant. **Effort: L.**

### P1-5 [HIGH] The events socket never reconnects
**`frontend/src/contexts/WebSocketContext.tsx:66-88`** — only the live socket registers `onclose`; `eventWs` has none, so a dropped `/ws/events` kills all notifications until reload. Mirror the backoff logic. **Effort: S.**

### P1-6 [HIGH] The frame throttle discards telemetry
**`WebSocketContext.tsx:94-96`** — dropping sub-500 ms frames permanently loses that second's bytes because the server resets counters per send. Either raise the server send rate or accumulate deltas server-side and flush on a fixed cadence. **Effort: M.**

### P1-7 [HIGH] Cross-tenant data leakage
**`backend/app/api/routes/analytics.py:74`** and **`routes/network.py:30`** call `detect_anomalies()` and `get_network_history()` with no org id, skipping the `BandwidthHistory.organization_id` filter that exists at `models.py:233`. Pass `get_current_org_id`. **Effort: S.** (Depends on P0-15 for a correct org id.)

### P1-8 [HIGH] Unbounded thread/memory growth
**`collector.py:747-765`** — a new thread per unique external IP, no cap, no rate limit, and `external_connections` is never pruned. Use a bounded worker pool plus TTL eviction on the map. **Effort: M.**

### P1-9 [HIGH] Comparison chart guesses sum-vs-delta
**`NetworkComparison.tsx:109-118`** — `SystemNetworkHistory` stores per-minute *deltas*, so the `isCounter` branch computes `last − first` and discards all intermediate traffic. Always sum. **Effort: S.**

### P1-10 Fake data reaching the production UI
Every row below ships to users today. **This is the single biggest credibility problem in the app.**

| file:line | fake value | exact fix |
|---|---|---|
| `frontend/src/components/AnalyticsDashboard.tsx:814-817` | 4 interfaces (eth0/wlan0/docker0/tun0) with fixed IPs, byte totals, 10-point sparklines | call `useInterfaces()` and `/bandwidth/{summary,hourly}` |
| `AnalyticsDashboard.tsx:798-804` | CSV export of the same fiction | export the real interface data |
| `frontend/src/App.tsx:181` | `'1,842,510'` packets; `wsData.length * 1542` | read `analyticsData.total_packets` |
| `frontend/src/App.tsx:179` | `Capturing on eth0` | derive from `/system/info` |
| `frontend/src/components/Dashboard.tsx:137` | `'< 15'` ms latency whenever `/health` responds | read `LatencyLog` |
| `Dashboard.tsx:145` + `hooks/useSystem.ts:24-25` | always `100%` / `'Excellent'` | compute a real score or hide the card |
| `Dashboard.tsx:131` | PPS = `throughput × 125` | use `packets_per_sec` |
| `frontend/src/components/TopNav.tsx:42-48` | 5 networks, device counts 24/42/16/8/9 | toast-only and filters nothing — remove the switcher |
| `frontend/src/components/SpeedtestPage.tsx:207` | `Global Avg = 150 Mbps` | drop the bar |
| `frontend/src/components/NetworkMap.tsx:211`, `analytics_service.py:62` | gateway `192.168.1.1` | derive from device data |
| `frontend/src/components/UptimeTimeline.tsx:124` | `uptimePercent: … : 100` | render `—` when there is no data |
| `frontend/src/components/Dashboard.tsx:38-42` | `generateBaselineTimeline` fabricates past timestamps | show an empty state |
| `collector.py:887-894` | `get_analytics_heatmap()` returns a hardcoded all-zero 7×24 matrix | compute from history |
| `speedtest_service.py:197-230` | Ookla progress `synthetic_progress += 10` every 1.5 s | hide the bar until the run completes |
| `backend/app/core/system_stats.py:48` | `cpu_pct / 10` load average | dead code, never called — delete |

**Keep** (already honest): `collector.py:442-484` `_run_synthetic_loop` is dev-gated by `ALLOW_SYNTHETIC_TRAFFIC=false` and surfaces a SIMULATION MODE badge over the WebSocket at `websockets.py:96`. **Effort: M** for the table as a whole.

### P1-11 [MEDIUM] Naive/aware datetime mixing
**`collector.py:269, 554, 578, 671`** write naive `datetime.now()`/`fromtimestamp()` into `DateTime(timezone=True)` columns, then compare against `datetime.now(timezone.utc)` at `uptime.py:23`. Breaks offline detection and range filters on any non-UTC host. Normalize everything to aware UTC. **Effort: M.**

### P1-12 [MEDIUM] DB session shared across threads
**`collector.py:703-722` vs `:580-582`** — `dispatch_alert` queries the caller's session while that session commits and closes. Open a fresh `SessionLocal()` inside the worker thread. **Effort: S.**

### P1-13 [MEDIUM] `setState` inside `useMemo`
**`UptimeTimeline.tsx:123`** — extra render pass plus a StrictMode warning. Move to `useEffect`. **Effort: S.**

### P1-14 [MEDIUM] Unguarded `JSON.parse` on localStorage
**`AnalyticsDashboard.tsx:284, 384-387`** — one corrupt key throws during render and blanks the app through the root ErrorBoundary. Wrap in `try { … } catch { return null }`. **Effort: S.**

### P1-15 [MEDIUM] Prediction math is wrong
**`ai_predictor.py:48-59`** — `days_in_month = 30` hardcoded and `data[:today.day]` assumes `data[0]` is the 1st. Use `calendar.monthrange` and filter rows by month. **Effort: S.**

### P1-16 [MEDIUM] Session leak
**`websockets.py:152`** — `next(get_db())` never exhausts the generator, so `db.close()` never runs. Use `with SessionLocal() as db:`. **Effort: S.**

### P1-17 [MEDIUM] Top-process CPU always 0
**`system_metrics.py:16-24`** — `cpu_percent` called with no priming `interval`, so the first read is 0 and the list sorts by RSS. Prime once at startup with `psutil.cpu_percent(interval=None)`. **Effort: S.**

### P1-18 [MEDIUM] ZeroDivisionError
**`system_metrics.py:92`** — `(total − current) / slope` with `total` from `ram_total_gb` unguarded. Guard `if total <= 0: return None`. **Effort: S.**

### P1-19 [LOW] Swallowed error detail
`CertMonitor.tsx:29,38`, `UserManagement.tsx:110,119,130`, `AnalyticsDashboard.tsx:273-277` — failures invisible to the user. Surface `err.response?.data?.detail`. **Effort: S.**

### P1-20 [LOW] Index keys on data rows
`AnalyticsDashboard.tsx:915, 1279`, `BandwidthPage.tsx:414,436,461`, `DnsQueryLog.tsx:56`, `SpeedtestPage.tsx:582` — reorder/filter corruption. Key by id/ip/timestamp. **Effort: S.**

### P1-21 [LOW] O(n²) heatmap
**`AnalyticsDashboard.tsx:1161`** — `Math.max(...)` recomputed per cell (168×). Hoist above the `.map`. **Effort: S.**

### P1-22 [LOW] No client heartbeat timeout
**`WebSocketContext.tsx:102`** — server pings are ignored, so a half-open socket reports "connected" forever. Track last-message time and force reconnect after ~30 s of silence. **Effort: S.**

### P1-23 [LOW] Interval churn on search
**`AnalyticsDashboard.tsx:467`** — every keystroke recreates the 1 s poll. Debounce the input. **Effort: S.**

### P1-24 [LOW] `stop()` never joins the persistence thread
**`collector.py:190-194`** — in-flight writes continue after shutdown. Join both threads with a timeout. **Effort: S.**

**Phase 1 verified clean:** error boundaries present at `App.tsx:56`; no other backend division-by-zero; SQLite WAL concurrency is sound.

---

## PHASE 2 — Performance & Bundle (score 5/10)

### P2-1 [CRITICAL] Unbounded eager-load of `traffic_logs`
**`backend/app/services/device_service.py:21-31`** — `get_devices` does `selectinload(Device.traffic_logs)`, and `Device` serializes `traffic_logs: list[TrafficLog]` with no LIMIT (`backend/app/schemas/defaults.py:51`). The collector writes one `TrafficLog` per device **per app category every 30 s** (`collector.py:646`) → ~2 880 rows/device/day; with 30-day retention that's ~86 k rows/device. A 100-device page is **millions of ORM rows and megabytes of JSON per request.**

**Change:** add a `DeviceListItem` schema without `traffic_logs`, use it for the list endpoint, and keep the full relation only on the detail endpoint with `.limit(200)`. **Effort: M.**

**Verify:** `curl /api/devices | jq '.[0] | keys'` must not contain `traffic_logs`; response time drops from seconds to milliseconds on a seeded DB.

### P2-2 [HIGH] Whole React tree re-renders 2×/sec
**`frontend/src/contexts/WebSocketContext.tsx:185-194`** — the provider `value={{...}}` object is recreated every render and `wsData` updates on a 500 ms throttle (`:91-95`). `AppContent` (`frontend/src/App.tsx:82`) consumes it, so `Dashboard`, `TopNav` and the entire active tab subtree re-render twice per second with zero `memo()`.

**Change:** split into `WsDataContext` and `WsActionsContext`, `useMemo` the data value, and wrap page components in `React.memo`. **Effort: M.**

### P2-3 [HIGH] `filteredDevices` recomputed every render; no virtualization
**`frontend/src/components/DevicesPage.tsx:96-132, 328, 413`** — filter + regex-parsing sort runs un-memoized on every keystroke *and* on every WS-driven re-render. All rows (up to 100) sit inside `<AnimatePresence mode="popLayout">`, forcing layout-animation measurement across the whole table. No virtualization library is installed.

**Change:** `useMemo` the pipeline, extract a `memo`ized `<DeviceRow>`, drop `AnimatePresence` from the table body (or cap it to the visible page), and paginate to 25 rows/page. **Effort: M.**

### P2-4 [HIGH] `sw.js` served with a 1-year immutable cache; no `skipWaiting`
**`frontend/nginx.conf:42-45`** — the regex location matches `/sw.js` and `/manifest.webmanifest`, so they get `Cache-Control: public, immutable; expires 1y`. The custom worker (`frontend/src/sw.ts:10`) calls `precacheAndRoute` with no `skipWaiting()`/`clientsClaim()`, so stale shells persist until every tab closes.

**Change:**
```nginx
location = /sw.js { add_header Cache-Control "no-cache, no-store, must-revalidate"; }
location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }
```
before the regex block, and add `self.skipWaiting(); self.clients.claim();` to `sw.ts`. **Effort: S.**

### P2-5 [MEDIUM] Collector N+1 in three flush loops
**`collector.py:521, 597, 660`** — `_flush_devices`, `_persist_daily_stats` and `_flush_app_traffic` each run `db.query(Device).filter(mac_address == mac).first()` inside a per-device loop, plus a second query per device for the daily summary. 100 devices ⇒ **~400 SQLite queries every 30 s.**

**Change:** one bulk `SELECT ... WHERE mac_address IN (...)` into a dict before each loop. Same fix applies at `aggregator.py:189-217, 262-288`. **Effort: M.** (Overlaps Phase 1 — batch both at once.)

### P2-6 [MEDIUM] WAL backup copies only the main DB file
**`backend/app/services/backup_service.py:27`** — `shutil.copy2(DB_FILE, temp_file)` with `journal_mode=WAL` (`backend/app/db/database.py:20`) ignores the `-wal` sidecar, so daily backups can miss recent commits or tear. Backups also land on the same volume (`./data/backups`) as the DB — a single failure domain.

**Change:** use `sqlite3.Connection.backup()` or `VACUUM INTO`, and ship backups off-volume. **Effort: S.**

### P2-7 [MEDIUM] ~5-6 authenticated requests/second from polling, no dedup
`frontend/src/hooks/useAnalytics.ts:13-82`, `useDocker.ts:13-55`, `useDns.ts:17,29`, `AnalyticsDashboard.tsx:431,467` — `refetchInterval` of 3-5 s across ~15 queries plus two raw `setInterval` axios polls (2 s + 1 s) that bypass TanStack Query entirely. Every request costs a `User` query plus an `OrganizationMember` query (`backend/app/api/deps.py:19-23`, `core/auth_jwt.py:53`) with no user cache.

**Change:** consolidate into one `/analytics/summary` poll fed by the existing WebSocket; cache `get_current_user` per token; debounce the packet-log search. **Effort: M.**

### P2-8 [MEDIUM] `packet_log.pop(0)` is O(n) in the packet hot path
**`collector.py:362-364`** — shifting a 1 000-element list per packet; at 5 k pps that's ~5 M pointer moves/s. Use `collections.deque(maxlen=1000)`. **Effort: S.**

### P2-9 [MEDIUM] Unlocked dict mutation shared with the sniff thread
**`collector.py:228`** writes `self.ip_app_map[dst_ip]` outside `stats_lock` while `_flush_app_traffic` (`:656`) and `get_analytics_summary` iterate it under the lock — intermittent `RuntimeError: dictionary changed size during iteration` in the persistence thread. Move the write inside the lock or use a concurrent map. **Effort: S.**

### P2-10 [LOW] `Cache-Control: public` on authenticated responses
**`backend/app/api/deps.py:34`** — `public, max-age=60` on per-user data. No shared cache exists today, but this leaks the moment a CDN is added. Change to `private, max-age=…` and add ETag/`Last-Modified` on list endpoints. **Effort: S.**

### P2-11 [LOW] `chunkSizeWarningLimit: 2000` silences the size budget
**`frontend/vite.config.ts:66`** plus `.github/workflows/ci.yml` — the 5× raised threshold hides the 1.83 MB `vendor-three` chunk, and CI runs `npm run build` with no size assertion. Restore 500 kB and add a `size-limit` budget to CI. **Effort: S.**

### P2-12 [LOW] No backend healthcheck/readiness; `framer-motion` in the eager graph
`docker-compose.yml:2-13` has no `healthcheck` and `depends_on` has no `condition: service_healthy`. `frontend/src/App.tsx:13,109` statically imports `OnboardingTour`, which imports `framer-motion`, pulling 37.7 kB gzip into first paint though only lazy pages need it. Lazy-load `OnboardingTour`; add the healthcheck wiring. **Effort: S.**

**Phase 2 verified clean:** three/react-globe.gl tree-shaking and lazy routes; `run_in_executor` offload in `speedtest_service.run_speedtest`; graceful lifespan shutdown in `main.py`; gzip config is correct (note `gzip_static on` is a no-op — Vite emits no `.gz`, and there is no brotli).

---

## PHASE 3 — UX & Accessibility (score 5/10)

### P3-1 [HIGH] No focus management in any modal or dialog
`SystemDetailOverlay.tsx:101`, `DeviceDetail.tsx:154`, `NotificationCenter.tsx:37`, `analytics/RulesModal.tsx:29`, `SpeedtestSettingsModal.tsx:78`, `OnboardingTour.tsx:66`, `UserManagement.tsx:341` — **zero** modals have `role="dialog"`, `aria-modal`, Escape-to-close, a focus trap, or focus restore. (cmdk's `CommandPalette` and the TopNav dropdowns do handle Escape.)

**Change:** add one shared hook `frontend/src/hooks/useModalA11y.ts` and use it in all seven:
```ts
export function useModalA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusable = ref.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return ref;
}
```
Then on each overlay wrapper:
```tsx
<div ref={ref} role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1}>
```
**Effort: M.**

### P3-2 [HIGH] Mouse-only interactive elements
`NetworkMap.tsx:222-231` (draggable node divs with `onClick`, no `role`/`tabIndex`/`onKeyDown` — **the entire Map view is mouse-only**), `DevicesPage.tsx:332` (`<tr onClick>`), `DevicesPage.tsx:417` (card div), `Dashboard.tsx:142` (`cell cursor-pointer` div), `NotificationCenter.tsx:95`, `SystemDetailOverlay.tsx:160,168,175` (`<th onClick>` sort).

**Change:** convert to real `<button>` elements, and on sortable headers expose state:
```tsx
<th aria-sort={sortField === 'cpu' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
  <button type="button" onClick={() => toggleSort('cpu')}>CPU %</button>
</th>
```
For `NetworkMap`, give each node `role="button" tabIndex={0}` and an `onKeyDown` that fires on Enter/Space. **Effort: M.**

### P3-3 [HIGH] Contrast fails WCAG AA in all six themes
`frontend/src/index.css:21,75` and `frontend/src/themes.ts:139,183,227,271` — `--faint` on `--panel` measures ≈3.0:1 (dark), 2.6:1 (light), 3.6:1 (cyberpunk), 3.0:1 (dracula), 3.5:1 (nord), 2.3:1 (midnight), and it's used for 10-12 px text (`.chart .axis`, `th`, `.statusbar`, `text-faint` labels). `--muted-foreground` also fails in dracula (3.0:1) and midnight (2.3:1).

**Change:** dark `--faint: #7d8698` (≈4.6:1); light `--faint: #6e7690` (≈4.6:1); midnight `--faint: #8296b3`; dracula `--muted-foreground: #8b9bc9`. Then verify with a contrast script across all six themes × all text tokens. **Effort: S.**

### P3-4 [HIGH] Theme sync broken by hardcoded colors
`OnboardingTour.tsx:71,85` (`bg-card` + `text-white` → white-on-white, invisible in Daylight), `ErrorBoundary.tsx:41` (`text-white`), `DevicesPage.tsx:165` (`bg-[#0A0B0E] border-white/5` dark skeleton in light mode), `NotificationCenter.tsx:33` (`bg-[#0f1115]/75`), `App.tsx:41` (`bg-[#0f1115]` auth loading flash), `LoginPage.tsx:168` (`text-[#0f1115]` on a light accent = 3.6:1).

**Change:** replace every one with a token — `text-foreground`, `bg-raised`, `text-accent-foreground`, `bg-background`. Add a CI grep that fails on `text-white|bg-\[#` outside `themes.ts` and `index.css`. **Effort: S.**

### P3-5 [HIGH] Icon-only buttons without accessible names
`NotificationCenter.tsx:59-80` (mark-all, clear, close — `title` only, and close is a 22 px target), `SystemDetailOverlay.tsx:118` (close), `DockerManager.tsx:251,286` (back, restart), `OnboardingTour.tsx:74` (close), `SettingsPage.tsx:375-387` (accent swatches: `title` only, and no selected state exposed).

**Change:** add `aria-label="Close notifications"` etc., and on the swatches expose selection — `aria-pressed={isSelected}` plus a visible ring on the selected one. **Effort: S.**

### P3-6 [MEDIUM] Missing error states / silent failures
`DevicesPage.tsx:23` — `useDevices`'s error is never checked, so on API failure `loading` goes false and the page renders "No devices found matching query." — **an error masquerading as an empty state.** Same at `AnalyticsDashboard.tsx:461` (packet logs), `SpeedtestPage.tsx:58`, `NetworkMap.tsx:78` (`console.error` only).

**Change:**
```tsx
if (isError) return <ErrorState onRetry={refetch} message="Could not load devices." />;
```
**Effort: M.**

### P3-7 [MEDIUM] Blocking `window.confirm()` still present
`AnalyticsDashboard.tsx:341`, `SettingsPage.tsx:68`, `UserManagement.tsx:125`. Route through the existing sonner toast pattern with an undo, or a custom dialog (which P3-1 then makes accessible). **Effort: M.**

### P3-8 [MEDIUM] Form labels not programmatically associated
`SettingsPage.tsx:249,260,271,418,442` and `RulesModal.tsx:115,126,138,148` — `<label>` siblings with no `htmlFor`; inputs lack `id`.

**Change:** `<label htmlFor="cur-pw">Current Password</label><input id="cur-pw" autoComplete="current-password" …>`. **Effort: S.**

### P3-9 [MEDIUM] No `aria-live` for async status
Only `LoginPage.tsx:151` has `role="alert"`. Live-capture status (`AnalyticsDashboard.tsx:562`), WS connection state (`App.tsx:183-185`) and all loading skeletons lack `role="status"`/`aria-busy`. Add `<span role="status" aria-live="polite">` to status chips. **Effort: S.**

### P3-10 [MEDIUM] Raw backend/dev error text shown to users
`LoginPage.tsx:40` (`data.detail` string), `SettingsPage.tsx:123`, `DevicesPage.tsx:89`, `ErrorBoundary.tsx:50` (raw `error.message` in a code block). Map to friendly copy, e.g. `setError('Invalid credentials. Check your Operator ID and access key.')`. **Effort: S.**

### P3-11 [LOW] Heading hierarchy
`Dashboard.tsx:114-289` starts at `<h2>` with no `<h1>` on the page. Make the first panel head an `h1`, or add a visually-hidden `h1`. **Effort: S.**

### P3-12 [LOW] Dead controls
`DevicesPage.tsx:216` (SCAN), `:227` (+ ADD DEVICE), `:390` (More options) have no `onClick`. Wire them up or remove them — a button that does nothing is worse than no button. **Effort: S.**

### P3-13 [LOW] Touch targets < 24 px
`DeviceDetail.tsx:302` (tag remove ≈12 px), `NotificationCenter.tsx:75-80` (≈22 px). Use `className="p-2 -m-1"` to reach 24×24. **Effort: S.**

### P3-14 [LOW] `h-screen` on the mobile sidebar
`Sidebar.tsx:86` — the 100 vh bug on mobile browsers. Use `h-dvh` or `inset-y-0`. **Effort: S.**

### P3-15 PWA manifest is thin
`frontend/vite.config.ts:25-32` — a single 512×512 icon and no 192 px entry; `theme_color #0f1014` doesn't match the actual `--bg #0f1115`. Add 192/512 icon entries and correct the color. The offline fallback itself (Workbox precache of index.html) is adequate. **Effort: S.**

### P3-16 Duplicated fetch logic
`SpeedtestPage.tsx:51-78` — the `fetchHistory` `useCallback` is duplicated verbatim inside the `useEffect`; dead code. **Effort: S.**

### P3-17 Misleading icon
`NetworkMap.tsx:292` — the "Close detail modal" button renders a `ShieldCheck` icon instead of `X`. **Effort: S.**

**Phase 3 verified clean:** TypeScript strictness (`strict: true`, `noUnusedLocals/Parameters`, zero `as any`, zero `@ts-ignore`, one guarded non-null at `DeviceDetail.tsx:106`); empty/loading states are broadly present — the gap is error-state *breadth*, not absence of the pattern. Note `no-explicit-any` is only `'warn'` (`frontend/eslint.config.js:41`).

---

## PHASE 4 — Testing & CI (score 4/10)

The counts are real (60 backend + 31 frontend, all green). **The protection is not.**

### P4-1 [HIGH] Order-dependent suite — it passes by alphabetical luck
`backend/tests/test_agent_api.py:34-37` plus `backend/tests/conftest.py:86` — module-level `app.dependency_overrides[...]` is never cleared; the `client` fixture's teardown calls `.clear()` on the shared dict. Verified: `pytest tests/test_analytics.py tests/test_agent_api.py` → **5 failed, 7 passed** (all 401s). The full suite passes only because `test_agent_api` sorts first.

**Change:** move every override into a fixture with proper teardown, so order cannot matter. **Effort: S.**

### P4-2 [HIGH] Fake tests
`frontend/src/App.test.tsx:10` (`expect(true).toBe(true)`), `backend/tests/test_simple.py:2` (`assert 1+1==2`), `tests/test_packet_filtering.py:16-68` (body is `pass`, zero assertions). Delete all three. **Effort: S.**

### P4-3 [HIGH] No RBAC negative tests
`backend/tests/conftest.py:105,115` — every fixture is `is_admin=True, role="owner"`. `check_admin` (`backend/app/api/deps.py:37`) guards 13 `system.py` endpoints and nothing asserts a non-admin gets 403. No multi-tenant isolation test either (`test_devices.py:19` hardcodes `organization_id=1`), and the login rate limit (`auth.py:23`, `5/minute`) is unverified.

**Change:** add non-admin and cross-org fixtures; assert 403/404 on every admin-gated route; add a test that user A cannot read org B's data. **Effort: M.**

### P4-4 [HIGH] The core product is mocked out of existence
`backend/tests/conftest.py:5-8` replaces `scapy` with a `MagicMock` process-wide, and `:37-64` monkeypatches every background singleton for the whole session. The packet collector — the actual product — never executes.

**Change:** narrow to per-test patches, and unit-test `get_packet_log` and the aggregation against synthetic packet dicts. **Effort: M.**

### P4-5 [MEDIUM] Assertions that pass when the code is broken
`test_devices.py:51` (`in (200, 404)`), `test_docker.py:11` (`in (200, 500)`), `test_devices.py:59` (`isinstance(list)`), `test_initial.py:36-47` (status only). Assert exact status plus payload shape. **Effort: S.**

### P4-6 [MEDIUM] Tautological service test
`backend/tests/test_certificate_service.py:44-53` patches `get_certificate_details` then asserts on the patched return value. Patch only `ssl.get_server_certificate` and let the real parser run. **Effort: M.**

### P4-7 [MEDIUM] Real DB touched
`backend/tests/test_e2e_remediation.py:38` imports `app.db.database.engine` (the live `backend/statsea.db`); `test_agent_api.py:14` uses the file DB `./test_statsea.db`. Use in-memory SQLite only. **Effort: S.**

### P4-8 [MEDIUM] Time-boundary hedge
`test_certificate_service.py:67` — `in (19, 20)`. Freeze time with `freezegun`. **Effort: S.**

### P4-9 [LOW] Frontend assertions are mostly "text is in the document"
Real logic (`formatBytes` at `BandwidthPage.test.tsx:99`) is barely exercised; no hook or data-transform tests. Extract transforms to `lib/` and unit-test them. **Effort: M.**

### P4-10 Zero-coverage areas (highest risk first)
| Area | File(s) | Risk if it breaks | Priority |
|---|---|---|---|
| Bandwidth API (8 endpoints) | `backend/app/api/routes/bandwidth.py` | The primary user-facing feature silently returns wrong numbers | P0 |
| WebSockets (3 endpoints) | `backend/app/api/routes/websockets.py` | Live telemetry dies; no test notices | P0 |
| System API (19 endpoints, 13 admin-gated) | `backend/app/api/routes/system.py` | Backups and health-check CRUD unverified | P0 |
| Docker (5 endpoints, destructive start/stop/remove) | `backend/app/api/routes/docker.py` | Container destruction unguarded | P0 |
| `backend/app/core/*` (24 modules) | `auth_jwt.py`, `auth.py`, `security.py`, `limiter.py`, `sanitization.py`, `aggregator.py`, `ai_predictor.py`, `quotas.py` | Auth, rate limiting and input sanitization all untested | P0 |
| Login page | `frontend/src/pages/LoginPage.tsx` | Zero tests on the auth surface | P0 |
| Destructive admin UI | `DockerManager.tsx`, `SystemManager.tsx`, `UserManagement.tsx`, `SessionManager.tsx`, `QuotaManager.tsx`, `GroupManager.tsx` | Zero tests | P0 |
| Speedtest / Security events / Export / Metrics | `speedtests.py`, `security.py`, `export.py`, `metrics.py` | ZERO tests each | P1 |
| `backend/app/services/*` | only `certificate_service`, `notification_service`, `docker_update_service` touched | 16 services untested | P1 |
| Heavy render paths | `NetworkTopology.tsx`, `NetworkMap.tsx`, `ConnectionGlobe.tsx`, `Dashboard.tsx`, `CommandPalette.tsx`, `CertMonitor.tsx` | Zero tests | P1 |
| All 17 hooks | `frontend/src/hooks/*` | Zero tests | P1 |

### P4-11 CI cannot fail
1. `.github/workflows/ci.yml:34,38,55` — `mypy --strict || true`, `pytest tests/ -v || true`, `npm run tsc || true`. **Remove all three `|| true`.**
2. Frontend tests never run in CI — the `frontend` job does install/tsc/build only. Add `npm test -- --run`.
3. Root `tests/` is never collected: `testpaths = ["tests"]` with `working-directory: ./backend` excludes `tests/test_quotas.py` and `test_packet_filtering.py`, and `test_quotas.py:8` needs `pytest-mock`, absent from `backend/requirements.txt`. Point `testpaths` at the real root or move those files into `backend/tests/`, and add `pytest-mock`.
4. No coverage tooling at all — no `pytest-cov`, no `@vitest/coverage-v8`, no thresholds. Add `pytest-cov` with `--cov=app --cov-fail-under=70` and `@vitest/coverage-v8` with `thresholds: { lines: 60 }`.
5. No pre-commit hook. Add `.pre-commit-config.yaml` with ruff plus a fast pytest subset.

### P4-12 The "11-phase E2E suite" is not a test suite
`tests/test_statsea_e2e_playwright.py` has no `test_` functions — only `run_e2e_tests()` gated by `__main__`, with ~20 hardcoded `wait_for_timeout` calls and screenshots written to a hardcoded absolute path (`:25`). It collects 0 tests and runs nowhere. Convert to `@pytest.mark.e2e` with explicit waits and an env-var artifact dir, or delete it from the scorecard. **Effort: M.**

---

## PHASE 5 — Docs (score 6/10)

### P5-1 [HIGH] No LICENSE file exists
The README badge links `./LICENSE`, `CONTRIBUTING.md:60` links `LICENSE`, and the badge claims MIT — but `git ls-files` shows no LICENSE. Add an MIT LICENSE with the correct copyright holder and year. **Effort: S.**

### P5-2 [HIGH] 4 of 6 theme tables are wrong
`README.md` lists Cyberpunk accent `#00ffcc` / bg `#08080f`, but `themes.ts:114` has accent `#facc15` and `:130` has bg `#0a0e17`. Dracula (`:158`, `:174`), Nord (`:218`) and Midnight (`:262`) are also wrong. `DESIGN.md:117-120` carries the same staleness. Regenerate both tables directly from `themes.ts` rather than editing by hand. **Effort: S.**

### P5-3 [MEDIUM] README overstates `/api/health`
README:239 says it reports "sniffer state"; `backend/app/api/routes/health.py:32-41` returns only `status`/`database`/`memory`. Either add sniffer/docker/collector component states (better — it also fixes the P6-4 observability gap) or correct the README. **Effort: S.**

### P5-4 [MEDIUM] The remediation doc's port claim is wrong
`statsea-10-out-of-10-remediation.md` claims "single consistent port configuration (`8001`)"; the Docker deployment actually uses 21081 (compose `:15`, Dockerfile CMD, `nginx.conf:20`) and 21080 for nginx. The README is right; the remediation doc is wrong. Correct it. **Effort: S.**

### P5-5 [MEDIUM] E2E counts contradict each other
README badge says "11/11 Passing"; the remediation doc says "8/8 phases passed". Reconcile, and make `tests/test_statsea_e2e_playwright.py` use hard assertions instead of the `if is_visible()` soft-skips at `:131-134, 207, 223`. **Effort: S.**

### P5-6 [MEDIUM] CHANGELOG is stale
`[1.0.0] - 2026-02-24` is listed as latest, but three commits dated 2026-11-04 (10/10 remediation, docker enforcement, UI unification) are undocumented and there is no `[Unreleased]` section. Update it. **Effort: S.**

### P5-7 [MEDIUM] Missing documentation sections
The README documents no env vars, no backup procedure, no troubleshooting and no uninstall. `backend/.env.example` (`JWT_SECRET_KEY`, `DATABASE_URL`, `VAPID`) is never referenced anywhere. `docs/DEPLOY.md` and `docs/remote-access.md` exist but are unlinked from the README. There is also an orphan `statsea-console/` prototype directory referenced by nothing.

**Change:** add the four sections, link the two docs, and either delete `statsea-console/` or document it. **Effort: S.**

### P5-8 Correct the false claims
Update `statsea-10-out-of-10-remediation.md` and `README.md` to match §2 of this plan — or delete the scorecard section entirely rather than shipping numbers that are wrong. **Effort: S.**

---

## PHASE 6 — Architecture & Observability (Arch 7.5/10, Obs 6/10)

### P6-1 [MEDIUM] Business logic in the API layer
`backend/app/api/routes/bandwidth.py:58-230` — a 432-line router computes today/yesterday/month/all-time aggregation, rate formatting and monthly projection inline in the handler, while the sibling `devices.py:28` correctly delegates to `DeviceService`. Inconsistent layering, and the logic can't be tested without HTTP. Extract a `BandwidthAggregationService`. **Effort: M.**

### P6-2 [MEDIUM] Migration drift / bypassed Alembic
`backend/app/main.py:105` — the lifespan calls `Base.metadata.create_all()`, so the 7 migrations in `backend/alembic/versions` are never the source of truth (last migration commit 64d7b563; `models.py` changed again in 3f505fdc with no matching revision). Schema truth is unverifiable, and a fresh deploy via Alembic would diverge from what the app actually created.

**Change:** decide one path — autogenerate a revision from the current models, and gate `create_all` to development only. **Do this before Phase 0's `token_version` migration.** **Effort: M.**

### P6-3 [HIGH] The JSON log formatter silently drops every structured field
`backend/app/core/logging.py:38` — `JsonFormatter` checks `hasattr(record, "extra")`, but stdlib `logger.error(..., extra={...})` sets the keys directly on the record, so `record.extra` never exists. Proven: formatting a record with `error_id`/`path` emits neither. **Every** `error_id` (`main.py:166`) and every `client_error`/`event_type` (`routes/metrics.py:36-39`) is lost.

**Change:** iterate `record.__dict__` and skip the standard `LogRecord` attribute names:
```python
_RESERVED = set(vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys()) | {"message", "asctime"}
extras = {k: v for k, v in record.__dict__.items() if k not in _RESERVED}
```
**Effort: S.**

### P6-4 [MEDIUM] `/metrics` isn't Prometheus and half its counters are dead
`routes/metrics.py:19` returns auth-gated JSON, which doesn't scale without a JWT. And `core/metrics.py:37-43` — `increment_packet`, `increment_dns_query`, `increment_alert`, `increment_connection` — are **never called anywhere** (grep-verified); only request/failed counters are live. Add Prometheus text exposition and either wire or delete the dead counters. **Effort: M.**

### P6-5 [MEDIUM] No alerting on capture, disk or DB failure
`core/collector.py:417-439` logs a sniffer failure and sleeps — no `NotificationService` call, in contrast to `collector.py:711` which *does* alert on new devices. There is no disk-full or DB-growth monitoring at all (`core/cleanup.py` logs errors only). Emit alerts from the `_run` failure branches and add a disk/DB-size threshold job. **Effort: M.**

### P6-6 [MEDIUM] The audit log is not tamper-evident
`services/audit_service.py:26-37` — a plain INSERT with no hash chain, checksum or append-only constraint, so rows are mutable through any DB session. The UI can query it (`AuditLogTab.tsx`, admin-only), but the service supports filtering beyond org/action that the route (`api/audit.py:24`) never exposes. Add a `prev_hash` chain and expose the filters. **Effort: M.**

### P6-7 [LOW] Config authority split
`backend/app/main.py:243-244` reads `os.getenv("HOST"/"PORT")` directly instead of going through `Settings`. Add both to `backend/app/core/config.py`. **Effort: S.**

### P6-8 [LOW] compose lacks healthcheck wiring
`docker-compose.yml` has no `healthcheck` key and `depends_on` has no `condition: service_healthy` — although the Dockerfiles *do* define HEALTHCHECKs (backend hits `/api/health`, frontend uses `wget`). This is wiring, not absence. Add `condition: service_healthy`. **Effort: S.** (Overlaps P2-12.)

### God files worth splitting
`frontend/src/components/AnalyticsDashboard.tsx` **1282 lines**, `SystemManager.tsx` 602, `SettingsPage.tsx` 585, `SpeedtestPage.tsx` 583, `DeviceDetail.tsx` 578, `DockerManager.tsx` 494; backend `core/collector.py` **799** (sniffer + persistence + GeoIP + synthetic generator in one class). No route file exceeds 500. Split opportunistically while touching them for other phases — not as a standalone rewrite.

**Phase 6 verified clean:** no `core → api` imports, no circular imports, no raw SQL sprawl (only `health.py:23` `SELECT 1`), no copy-paste helpers across routers, `config.py` is a single 42-line Settings class, structured JSON logging with a rotating file handler, request-ID middleware with `X-Request-ID` echo (`main.py:149-158`) and contextvar propagation, uvicorn access log active, a real DB check in `/health`, and honest degradation when capture is unavailable (`collector.py:390-396` idles with `ALLOW_SYNTHETIC_TRAFFIC=false`).

---

## PHASE 7 — Visual, Browser & Compatibility (score 5/10 — audited 2026-11-05)

**Status: executed 2026-11-05.** Sectors 0–6 were produced by reading code and running the two test suites. This sector was closed by actually starting the app and driving a browser through it — see P7-A for the procedure and P7-* for what it found. The single most serious defect in the whole audit (P7-1) was invisible to code reading and only appeared once the app ran. **Do not skip this sector on a re-audit.**

### P7-A How to run it (agent-executable)

**Step 1 — start the app.**
```powershell
# backend, from D:\Repo\StatSea\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
# frontend, from D:\Repo\StatSea\frontend
npm run dev
```
Confirm `http://127.0.0.1:8001/api/health` returns JSON and the Vite URL prints. If the backend refuses to boot because of P0-1/P0-10 (JWT secret), set `JWT_SECRET_KEY` to a 64-char random string in `backend/.env` first — that is a local dev run, not a security change.

**Step 2 — log in.** Seeded credentials are `admin` / `admin123` (see P0-4 — these exist and are never forced to rotate). Note whether the login page renders correctly *before* credentials are entered, since that is the first thing a real user sees.

**Step 3 — walk every route and capture.** Use the browser panel at three viewports: `desktop` (1280×800), `tablet` (768×1024), `mobile` (390×844). For each: `open` → `snapshot` → `scroll` to the bottom → `capture` with a `label` naming the route and viewport (e.g. `dashboard-mobile`). Save all captures into `C:\Users\Sagar-EB\AppData\Local\Temp\opencode\`.

Routes to cover: `/login`, `/` (Dashboard), `/devices`, `/analytics`, `/bandwidth`, `/network`, `/map`, `/speedtest`, `/dns`, `/docker`, `/system`, `/settings`, plus the Command Palette (Cmd/Ctrl-K) and the Notification Center.

**Step 4 — for each capture, record these specific checks** (this is the list that turns into `P7-*` items):
1. **Layout integrity** — horizontal scrollbar present? Any element wider than the viewport? Text clipped or overlapping? Chart SVG overflowing its card?
2. **Theme correctness** — repeat the whole walk with each of the six themes (dark, light, cyberpunk, dracula, nord, midnight) from Settings. Look specifically for the known suspects in P3-4: white-on-white in `OnboardingTour.tsx`, the dark skeleton in `DevicesPage.tsx:165`, the `bg-[#0f1115]` flash in `App.tsx:41`. If any of those reproduce visually, P3-4 is confirmed and should be re-prioritised.
3. **Contrast as rendered** — the ratios in P3-3 were computed from CSS values. Now read the actual rendered colours with `inspect` on `.chart .axis`, `th`, `.statusbar` and any `text-faint` label, and confirm the computed ratio against the theme's `--panel` background.
4. **Keyboard-only navigation** — put the mouse down. Tab through the login page, then each page. Record every place focus disappears, focus order is illogical, or an interactive element cannot be reached. Open each modal and confirm Escape closes it (P3-1 predicts none do).
5. **Screen-reader surface** — `snapshot` returns the accessibility tree. Check that icon-only buttons expose a name (P3-5), tables expose sort state, and the page has an `h1` (P3-11).
6. **Console errors** — `snapshot` reports logged errors. Record every one with its route; a clean render with console errors is still a bug.
7. **Responsive breakpoints** — at `mobile` specifically check `Sidebar.tsx:86` (`h-screen`, the known 100vh bug) and whether the device table and analytics charts remain usable or become unreadable.
8. **Lighthouse** — run against the built `frontend/dist` served by `frontend/nginx.conf` (not the dev server, which is unminified), for Performance, Accessibility, Best Practices and SEO. Record the four scores and the top three failing audits per category.
9. **Cross-browser** — if more than one engine is available, repeat steps 3–6 in each. Minimum expectation: Chromium plus one of Firefox/WebKit. Record per-engine differences, especially anything relying on `backdrop-blur`, `dvh` units, or the WebSocket query-string auth in P0-7.
10. **Live capture path** — this is the one thing static analysis cannot judge. On Dashboard and Analytics, watch for ~10 seconds and record whether the numbers move, whether they look plausible against `SpeedtestPage`, and whether the WS connection indicator stays green. P1-2/P1-3 predict the bandwidth counters read ~0 while a client is connected — confirm or refute by eye.

**Step 5 — write the results back into this file.** Each confirmed issue becomes a `### P7-n [SEVERITY] Title` entry below, with `file:line`, the exact change, and effort S/M/L, in the same format as the other phases. If the audit confirms an existing item (P3-1, P3-3, P3-4, P3-5, P3-11, P3-14, P0-7), add a line to that item saying "confirmed visually at <route>, <viewport> on <date>" rather than duplicating it. Only add a *new* `P7-*` item when the problem is not already listed.

**Step 6 — assign the sector score.** Only after steps 1–5, score this sector out of 10 with a one-line justification and update the table in §1. Until then it stays "UNAUDITED" — do not let a green Lighthouse score stand in for the whole audit, and do not let a bad one override the code-reading findings.

### P7-* Findings

**Audit executed 2026-11-05.** Backend on `127.0.0.1:8001`, Vite dev server on `5173`, logged in as `admin` / `admin123`. Walked: login, Dashboard, Devices, Analytics (Interfaces tab), plus desktop (1440×900), tablet and mobile (390×844) viewports and the light theme. Captures are in `.openchamber/screenshots/` (`login-desktop`, `dashboard-tour-desktop`, `dashboard-desktop`, `devices-desktop`, `analytics-bottom`, `analytics-interfaces-fake`, `dashboard-mobile-nav-overflow`, `dashboard-mobile-light-theme`).

**The single most important finding of the whole audit came from running the app, not reading it:**

### P7-1 [CRITICAL] The device fleet is permanently empty — the collector never sets `organization_id`
`backend/app/core/collector.py:547-555` constructs the device without the field:
```python
device = Device(
    mac_address=mac, ip_address=data["ip"], vendor=vendor,
    type=device_type, icon_type=icon_type, is_online=True,
    last_seen=datetime.fromtimestamp(data["last_seen"]),   # also: naive local time
)
```
`organization_id` is never passed, so every discovered device is written as `NULL`. But `backend/app/services/device_service.py:21` reads with `filter(models.Device.organization_id == organization_id)`, and `get_current_org_id` returns `1`. In SQL `NULL == 1` is never true, so **the row is always excluded**.

Runtime proof: the live database holds **3 devices**, yet `GET /api/devices` returns `items: []` and the UI shows "No devices found matching query." / "0 managed endpoints on subnet". No user of any organization can ever see a device. This is the app's headline feature, structurally dead.

Note the same block mixes naive and aware datetimes — `datetime.fromtimestamp(...)` (naive, local) at `:554` against `datetime.now(timezone.utc)` (aware) at `:561` — which is P1-11 reproduced in one screen of code.

**Fix:** resolve the owning org in the collector (there is already a pattern at `collector.py:708-709` — `db.query(Organization).first()`) and pass `organization_id=org_id` into the `Device(...)` call; then backfill existing rows with a migration (`UPDATE devices SET organization_id = 1 WHERE organization_id IS NULL`). Separately, make `get_devices` treat `organization_id IS NULL` as globally visible rather than invisible, so orphaned rows degrade to "visible" instead of "lost". **Effort: M.** Fix this **before** trusting any other device-related finding.

### P7-2 [HIGH] At 390px the nav overflows and 7 of 12 destinations are unreachable
The 12-item nav (`Overview … Settings`) is a single horizontal row at `y=93`. At 1440px it fits. At 390px its buttons run from `x=16` to `x=990`, so **Analytics, Bandwidth, Speed, System, Sessions, Users and Settings are entirely off-screen** — with no hamburger, no wrap, and no overflow affordance. `body` bounds read `x: -74`, confirming real horizontal overflow. The header does adapt (the `/ Dashboard` breadcrumb and the operator name drop out), so the responsive intent exists; the nav was simply missed. **Effort: M.**

### P7-3 [MEDIUM] TanStack Query devtools ship in the UI
`button[aria-label="Open Tanstack query devtools"]` renders bottom-right on **every** page at every viewport, including mobile where it sits at `x:324, y:778` over content. Gate it behind `import.meta.env.DEV`. **Effort: S.**

### P7-4 [MEDIUM] Base font size is 13px
`body` computes to `font-size: 13px; line-height: 19.5px`. That is below the ~16px floor for comfortable mobile reading, and any input focused at <16px triggers iOS Safari's automatic zoom-in on focus. Raise the root size or scale type up at the mobile breakpoint. **Effort: S.**

### P7-5 [LOW] Mobile horizontal overflow
`body` bounds `x: -74, width: 380` inside a 390px viewport. Fixing P7-2 should resolve it; re-measure after.

### Fake data confirmed on screen (upgrades P1-10 from "found in code" to "proven in production")
Each of these was read off the running UI:
- **Fabricated NIC table** — Analytics → Interfaces renders `eth0 / 192.168.1.100 / 8.31 GB RX`, `wlan0 / 192.168.1.101`, `docker0 / 172.17.0.1`, `tun0`. This host's real adapters are `Ethernet 2` (192.168.56.2), `Ethernet` (192.168.56.1), `WiFi` (192.168.0.111), `Tailscale` (169.254.83.107), Bluetooth, and two `Local Area Connection*`. **No `eth0`, no `wlan0`, no `docker0`, no `tun0`, and no `192.168.1.100` exists on this machine.** The table is fiction, and the adjacent "Export CSV" button exports the fiction.
- **Packet counter is arithmetic, not telemetry** — the status bar read `9,252 packets`, then `30,840 packets` ~90s later. `9252 = 6 × 1542` and `30840 = 20 × 1542`: it is `wsData.length * 1542` from `App.tsx:181`, counting WebSocket frames, not packets.
- **`Latency < 15 ms / Nominal`** and **`System health 100% / healthy`** render unconditionally.
- **`AI MONTHLY FORECAST — 97.4% TREND — PREDICTED TOTAL BANDWIDTH 3.8 TB`** renders while `total_bytes` is `0`.
- **`Capturing on eth0`** is hardcoded in the status bar.

### Confirmed dead or misleading (existing items, now proven at runtime)
- **P1-3 / P1-4** — `LIVE BANDWIDTH 0% / 0 B/s` on both gauges, and all eight analytics counters (`PACKETS`, `DATA`, `PPS`, `SUSPICIOUS`, `DNS`, `HTTP`, `SESSIONS`, `DEVICES`) read `0`. Confirmed against the API: `/api/analytics/summary` returns `total_packets: 0, total_bytes: 0, packets_per_sec: 0.0, protocols: {}, top_devices: [], packet_log: [], active_device_count: 0`.
- **P3-8** — `#username`, `#password` and the "Remember key" checkbox on login, the Devices filter input, and both Analytics search inputs all report `missingAccessibleName: true`.
- **P3-12** — `SCAN` and `+ ADD DEVICE` render on the Devices page with no handler.
- **P0-4** — the admin row carries `must_change_password = 1`, yet login returned a working 124-char access token with no prompt and no challenge. The flag is decorative.
- **P5-3** — `/api/health` returns exactly `{status, timestamp, database, memory}`. No sniffer, collector or docker state, as the README claims.
- **P2-1 is currently latent, not active** — the unbounded `traffic_logs` eager-load cannot blow up while P7-1 keeps the device list empty. Fixing P7-1 *activates* P2-1. Ship both together or the device page will fall over the moment devices appear.

### Corrections to earlier findings (the audit was wrong on these; do not "fix" them as written)
- **P0-15 tenant isolation is not LOW — it is CRITICAL.** Static reading called it "nominal". Runtime proves it deletes the device fleet entirely. Its severity in Phase 0 must be raised and its fix merged into P7-1.
- **P1-1 (DNS never persisted) is half wrong.** It is true that no code path inserts a `DnsLog` (the only references are the model, the schema, reads in `log_service.py`/`report_service.py`, and the `cleanup.py` delete). But the database holds **6,287 legacy `dns_logs` rows** and `/api/analytics/dns-logs` returns them correctly — that endpoint has **no org filter**, unlike devices. So the DNS tab may well display data. Re-scope P1-1 to "the buffer is never flushed, so *new* DNS traffic is lost while old rows remain visible" rather than "DNS returns empty".
- **P1-2 (BandwidthHistory never written) is likely wrong.** `bandwidth_history` holds **1,828 rows** and `/api/network/history` returns **60 real rows with real byte values** (`upload: 47896, download: 259092`). The counter-drain bug may only bite while a WebSocket client is attached. Re-verify before changing code.
- **"SECURITY EVENTS 3" is real, not fake.** It comes from the API (`/api/security/events` → 3 rows), not from a hardcoded value. The dashboard showed 146 `security_events` rows in the table but the endpoint returns 3 — worth a look, but it is not fabricated data.

### What the browser audit confirms is genuinely good
Theme switching works (light theme computed to `background: rgb(245,246,250)`, `color: rgb(21,24,38)`); **no console errors on any page walked**; the analytics summary honestly returns zeros instead of inventing numbers; the empty states are well written ("No network devices discovered yet", "No security or anomalous events recorded", "Safe seas! 🌊"); and the Dashboard settings button does carry an `aria-label`.

### P7-6 Still not covered
Keyboard-only navigation and screen-reader walkthrough (the browser panel cannot dispatch raw key events, so Escape-to-close and focus traps from P3-1 remain unverified — use the Playwright CLI for this); Lighthouse/Core Web Vitals; Firefox/WebKit runs; and the live-capture path, which cannot be exercised on this Windows host because scapy has no capture surface here.

---

## 4. Suggested delivery order

1. **Phase 0** — the only phase where a stranger can become admin or root. Land it first and alone.
2. **Phase 1** — stop lying to users about the numbers. Highest trust impact, and several items are small.
3. **Phase 2** — the unbounded `traffic_logs` load (P2-1) is the single change that most improves felt performance.
4. **Phase 4** — make CI able to fail *before* the refactors in 5 and 6, so regressions get caught.
5. **Phase 3** — accessibility; mostly mechanical once the shared hook exists.
6. **Phase 6** — architecture and observability; includes the Alembic decision that Phase 0's migration depends on.
7. **Phase 5** — docs last, so they describe the code as it ends up.
8. **Phase 7** — the visual/browser audit has now been run once (2026-11-05); its findings are recorded in place. Re-run it after Phase 1 and again after Phase 3.

**One sequencing change this audit forces:** `P7-1` (the device fleet is permanently empty because the collector never sets `organization_id`) must land **with or before** `P2-1`. Right now `P2-1`'s unbounded `traffic_logs` load is dormant precisely because the device list is always empty — the moment `P7-1` makes devices appear, `P2-1` becomes live and the device page falls over. Treat them as one change. `P7-1` also raises `P0-15` from LOW to CRITICAL, since "tenant isolation is nominal" turns out to mean "no tenant can see any device".

Each phase is independently executable: give an agent the phase section plus the shared-file table in §3, and it can work without reading the rest of the audit.
