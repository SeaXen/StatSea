# StatSea 10/10 Master Remediation Plan (Gravitas Standard)

> **Objective:** Systematically remediate all gaps across the 11 Review Team sectors to achieve an authentic 10/10 score across Correctness, Security, Architecture, Quality, Simplicity, UX, Performance, Telemetry, Testing, API, and Documentation.

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
    "bundle-optimization",
    "lint-and-quality-remediation",
    "security-hardening",
    "test-expansion",
    "doc-alignment"
  ]
}
```

---

## 🎯 Verification Criteria (The True 10/10 Standard)

1. **Frontend Linting:** `npm run lint` exits with code `0` and **0 problems (0 errors, 0 warnings)**.
2. **Frontend Type Check:** `npx tsc --noEmit` exits with code `0`.
3. **Frontend Bundle Budget:** `npm run build` generates 0 oversized chunk warnings (all chunks <800 KB, with `vendor-three` cleanly isolated).
4. **Frontend Unit Tests:** `npm test -- --run` passes 100% of tests with expanded coverage across key components (`DevicesPage`, `SettingsPage`, `SpeedtestPage`, `AnalyticsDashboard`).
5. **Backend Linting:** `python -m ruff check app/` exits with code `0`.
6. **Backend Pytest:** `python -m pytest` in `backend/` (60 tests) and `python -m pytest tests/` in root (4 tests) execute cleanly with 100% pass rate.
7. **Security Baseline:** Ephemeral cryptographic secret fallback in `config.py`; tokens disallowed in URL query parameters.
8. **E2E Playwright Suite:** `python tests/test_statsea_e2e_playwright.py` executes 8/8 phases cleanly against live running stack.
9. **Zero Fake Telemetry:** Honest 0.0 Mbps / 0 device empty states in `Dashboard.tsx` without hardcoded constants or mocked history curves.
10. **Developer Experience:** `README.md` setup instructions match `vite.config.ts` port 8001 exactly.

---

## 🗺️ Execution Phases

### Phase 1: Correctness & Telemetry Truth in Dashboard & DockerManager
- [ ] 1.1 Remove hardcoded fallback metrics (`'184.6'`, `'42.3'`, `23`, `9`) from `Dashboard.tsx`, displaying honest 0.0 Mbps / 0 device states.
- [ ] 1.2 Wire historical time ranges in `Dashboard.tsx` to authentic history data or clean baseline interpolation rather than static fake curves.
- [ ] 1.3 Fix unstable empty array references in `DockerManager.tsx` to prevent `useMemo` dependency thrashing.
- [ ] 1.4 Replace blocking browser `window.confirm()` in `DockerManager.tsx` and `AnalyticsDashboard.tsx` with accessible toast/dialog flows.

### Phase 2: Security Hardening & Secret Protection
- [ ] 2.1 Replace static default JWT secret in `app/core/config.py` with secure ephemeral fallback `secrets.token_hex(32)`.
- [ ] 2.2 Deprecate and remove token acceptance via URL query parameters in `app/api/routes/auth.py` (`refresh_token` and `current_token`).

### Phase 3: Performance, WebGL & Bundle Optimization
- [ ] 3.1 Configure `vendor-three` in `frontend/vite.config.ts` manualChunks to isolate `three`, `three-globe`, and `react-globe.gl`.
- [ ] 3.2 Ensure `ConnectionGlobe.tsx` and `NetworkMap.tsx` are lazy-loaded via `React.lazy()` with `<Suspense>`.
- [ ] 3.3 Verify bundle size drops below warning thresholds (<800 KB).

### Phase 4: Code Quality & Zero-Warning ESLint Pass
- [ ] 4.1 Fix misplaced `import` at line 210 in `AnalyticsDashboard.tsx`.
- [ ] 4.2 Separate Context hooks (`useAuth`, `useTheme`, `useWebSocket`) from Provider files to eliminate `react-refresh/only-export-components` warnings.
- [ ] 4.3 Replace all remaining `@typescript-eslint/no-explicit-any` instances with strict TypeScript interfaces across hooks and views.
- [ ] 4.4 Run `npm run lint` until 0 errors and 0 warnings are achieved.

### Phase 5: Documentation & Repo Cleanliness
- [ ] 5.1 Synchronize setup instructions in `README.md` to port `8001` to match Vite proxy and live dev server.
- [ ] 5.2 Relocate loose DB scratch scripts (`check_db.py`, `inspect_db.py`, `seed_db.py`, `seed_org.py`, `reset_saas_db.py`) into `backend/scripts/`.

### Phase 6: Frontend Test Suite Expansion
- [ ] 6.1 Create unit tests for `DevicesPage.test.tsx`.
- [ ] 6.2 Create unit tests for `SettingsPage.test.tsx`.
- [ ] 6.3 Create unit tests for `SpeedtestPage.test.tsx`.
- [ ] 6.4 Create unit tests for `AnalyticsDashboard.test.tsx`.
- [ ] 6.5 Run `npm test -- --run` and verify all tests pass.

### Phase 7: Full Verification & 11-Sector Fleet Re-Audit
- [ ] 7.1 Run backend pytest, frontend vitest, TypeScript compiler, ESLint, and E2E Playwright tests.
- [ ] 7.2 Score all 11 sectors to confirm 10/10 across all disciplines.
