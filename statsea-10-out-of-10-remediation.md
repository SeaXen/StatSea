# StatSea 10/10 Comprehensive Remediation Plan

> **Objective:** Systematically remediate all 11 sectors of the StatSea application to achieve a verified 10/10 score across Security, Correctness, Performance, Architecture, Quality, UX, Testing, Telemetry, API, Docs, and Scope.

---

## 📋 Gravitas Planning Policy Record

```json
{
  "planning": "deep",
  "context_depth": "dependency",
  "verification_depth": "full",
  "delegation": "review-team",
  "reason_codes": [
    "multi-file-refactor",
    "security-hardening",
    "bundle-optimization",
    "lint-and-quality-remediation",
    "test-discovery-fix"
  ]
}
```

---

## 🎯 Target Verification Criteria (The 10/10 Standard)

1. **Frontend Linter:** `npm run lint` in `frontend/` exits with code `0` (0 errors, 0 cascading render bugs).
2. **Frontend Type Check:** `npx tsc --noEmit` in `frontend/` exits with code `0`.
3. **Frontend Tests:** `npm test -- --run` in `frontend/` passes with 100% success and extended coverage for major views.
4. **Frontend Bundle Build:** `npm run build` generates 0 circular chunk warnings, and vendor chunks adhere to budget (<800KB).
5. **Backend Linter:** `python -m ruff check app/` exits with code `0` (221 errors remediated).
6. **Backend Pytest (Root & Tests):** `python -m pytest` and `python -m pytest tests/` both execute cleanly with 0 collection errors and 0 test failures.
7. **Security Baseline:** No Bandit `S104` (0.0.0.0 binding in core), `S105` (hardcoded JWT secret), `S110` (bare try-except-pass), or permissive CORS credential leaks.
8. **E2E Playwright Suite:** Automated headless validation verifying authentication, live/synthetic telemetry rendering, dashboard metrics, and theme toggling.

---

## 🗺️ Execution Phases

### Phase 1: Security Hardening & Vulnerability Remediation
- [ ] **1.1 Restrict CORS:** Replace `allow_origin_regex=".*"` with explicit whitelist matching configured frontend origins in `app/main.py`.
- [ ] **1.2 Refresh Token Security:** Move `refresh_token` from URL query parameter (`Query(...)`) to POST JSON body schema in `app/api/routes/auth.py`.
- [ ] **1.3 Ephemeral Secret Fallback:** In `app/core/config.py`, generate a secure random hex key (`secrets.token_hex(32)`) if no JWT secret is provided, preventing hardcoded defaults.
- [ ] **1.4 Logging Exception Swallowing (S110):** Add structured logging to bare `except Exception: pass` blocks in `port_scanner.py`, `speedtest_service.py`, `backup_service.py`, and `system_stats.py`.
- [ ] **1.5 Host Binding:** Default local development server to `127.0.0.1` instead of `0.0.0.0` unless explicitly commanded.

### Phase 2: Frontend Correctness & Code Quality
- [ ] **2.1 QuotaManager React Invariant Fix:** Eliminate synchronous `setState` in `useEffect` on lines 22 & 47 of `frontend/src/components/QuotaManager.tsx` to stop cascading re-renders.
- [ ] **2.2 ESLint Zero-Error Pass:** Fix Fast Refresh exports and remove unsafe `any` types across components, hooks, and tests.
- [ ] **2.3 Verification:** Verify `npm run lint` exits with code `0`.

### Phase 3: Performance & Bundle Optimization
- [ ] **3.1 Lazy Loading Heavy 3D Assets:** Dynamically import `ConnectionGlobe.tsx` and `NetworkMap.tsx` (`React.lazy()`) so Three.js and D3 only load when navigated to.
- [ ] **3.2 Fix Circular Chunking in Rollup:** Refactor `vite.config.ts` manual chunking to eliminate circular dependency (`vendor-3d <-> vendor-charts`).
- [ ] **3.3 SQLite WAL Mode & Concurrency:** Configure SQLAlchemy engine connect hook in `app/db/database.py` to enable `PRAGMA journal_mode=WAL;` and `PRAGMA busy_timeout=5000;`.

### Phase 4: Telemetry Transparency (Live vs Synthetic)
- [ ] **4.1 Telemetry State Attribute:** Add `telemetry_mode: "live" | "synthetic"` to WebSocket broadcast state in `app/core/collector.py`.
- [ ] **4.2 Frontend Status Indicator:** Add a telemetry status badge in the dashboard header indicating `● LIVE SNIFFING` or `⚡ SIMULATION MODE (Npcap Missing)`.

### Phase 5: Test Discovery & Suite Expansion
- [ ] **5.1 Pytest Root Configuration:** Add `testpaths = ["tests"]` and ignore non-test patterns in `backend/pyproject.toml`.
- [ ] **5.2 Root Cleanliness:** Remove or move root `test_sni.py` into `tests/test_sni.py` with mock guards.
- [ ] **5.3 Frontend Unit Test Expansion:** Add unit tests for `AnalyticsDashboard`, `SettingsPage`, and `SpeedtestPage`.
- [ ] **5.4 Headless Playwright E2E Suite:** Create `tests/test_webapp_suite.py` verifying login, navigation, theme toggle, and websocket telemetry stream.

### Phase 6: Code Quality, Deprecations & Repo Hygiene
- [ ] **6.1 Ruff Auto-fix & Formatting:** Run `python -m ruff check app/ --fix` and resolve remaining typing deprecations (`UP006`, `UP045`).
- [ ] **6.2 Pydantic v2 Migration:** Upgrade `class Config:` to `model_config = ConfigDict(...)` across schemas to eliminate 23 deprecation warnings.
- [ ] **6.3 Purge Garbage Files:** Delete misplaced `backend/package.json`, `backend/package-lock.json`, and stray text/log files (`ruff_errors.txt`, `test_errors*.txt`, `backend.log`).
- [ ] **6.4 README Polish:** Replace developer placeholders with accurate feature descriptions and usage guides.

### Phase 7: Final Gravitas Verification & Review Fleet Re-Audit
- [ ] **7.1 Run full test matrix:** Backend pytest, frontend vitest, TypeScript compiler, ESLint, and E2E Playwright suite.
- [ ] **7.2 Re-run all 11 Review Team personas** to confirm a verified 10/10 across every sector.
