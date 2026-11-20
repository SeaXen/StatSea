# AGENTS.md — StatSea

Network-traffic surveillance and bandwidth-telemetry console. Two deployable apps plus scripts:
- `backend/` — FastAPI (Python 3.11+), SQLite, Scapy/psutil/Docker telemetry. Entry: `backend/app/main.py`.
- `frontend/` — React 18 + Vite 5 + TypeScript SPA / PWA. Entry: `frontend/src/main.tsx`.
- `statsea-console/` — standalone static prototype (`index.html`, `PROMPT.md`); **not** part of the build.
- `scripts/statsea_agent.py` — standalone agent script.

## Exact dev commands
Backend — run from `backend/` (the default SQLite URL is relative to cwd):
- `pip install -r requirements.txt`
- `uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload`
- `python -m ruff check app/ scripts/ tests/`
- `mypy app/ --ignore-missing-imports`
- `pytest tests/ -v` (65 tests; in-memory SQLite, background services mocked)

Frontend — run from `frontend/`:
- `npm install`; `npm run dev` (port 5173, Vite proxies `/api` + WS → `localhost:8001`)
- `npm test -- --run` (Vitest); `npm run lint` (ESLint 9 flat config)
- `npx tsc --noEmit` — **do not use `npm run tsc`**: CI calls that, but `package.json` has no `tsc` script. `npm run build` (`tsc && vite build`) is the working typecheck+build.

Root integration tests: `python -m pytest tests/ -v` (CI runs this *in addition* to the backend suite).
E2E: `python tests/test_statsea_e2e_playwright.py` — not standalone: needs a live frontend at `STATSEA_FRONTEND_URL` (default `http://localhost:5173`) + running backend, login `admin` / `admin123`, and Playwright installed separately (it is **not** in `requirements.txt`). Writes screenshots to `artifacts/`. CI does not run it.

## Verify order / CI
`.github/workflows/ci.yml` (Node 20, Python 3.11, `libpcap-dev` for Scapy): backend `ruff → mypy → pytest` (backend suite then root suite); frontend `lint → typecheck → test → build`; then both Docker images build. Docker image build also needs `network: host` at build time.

## Ports & deployment
- Dev: backend `8001`, Vite `5173` (API/WS through Vite proxy).
- Docker: `./deploy.sh` or `docker compose up -d --build` → UI Nginx on `21080`, backend `21081`. `network_mode: host` + `NET_RAW` cap are required for raw packet capture and host metrics. A `docker-socket-proxy` exposes the host socket read-only at `127.0.0.1:2375`.
- Data lives in `backend/data` (`sqlite:///./data/statsea_saas.db`); preserve this volume on updates.

## Config / env quirks
- `pydantic-settings` reads `.env` and `backend/.env`, `case_sensitive=True`; start from `.env.example`.
- `JWT_SECRET_KEY` fails closed in production (placeholder raises). `/docs`, `/redoc`, `/openapi.json` are disabled outside development.
- `ALLOW_SYNTHETIC_TRAFFIC=false` in prod — no mock/synthetic telemetry; real capture needs `libpcap` + `NET_RAW`.
- Frontend API/WS hosts are resolved at runtime in `frontend/src/config/apiConfig.ts` from `window.location` (overridable via `VITE_API_URL` / `VITE_WS_URL`) — don't hardcode a backend host.

## Testing traps
- `backend/tests/conftest.py` injects `MagicMock` scapy modules into `sys.modules` **before** importing the app. `monitor.start` is async and must stay `AsyncMock`; swapping in `MagicMock` hangs the whole suite. Tests use in-memory SQLite with `StaticPool`.
- Root `tests/` append `../backend` to `sys.path` to import `app.*`.
- `.gitignore` ignores `*.txt`, `frontend/dist/`, `data/`, `*.db` — don't assume those are tracked.

## Layout notes (non-obvious)
- Backend: `app/api/routes/` are the main feature routers, all mounted under `/api` in `main.py`; SaaS extras (audit, billing, api_keys, notifications, status-settings, certificates) live directly in `app/api/` and get their own prefixes; public status is under `/status`. Telemetry engines are in `app/core/`, business logic in `app/services/`, models in `app/models/models.py`, Alembic migrations in `backend/alembic/`.
- Frontend: `src/hooks/` are TanStack Query data hooks; `src/context/` and `src/contexts/` both exist (Auth/Theme vs WebSocket); theme tokens live in `src/lib/themes.ts` + `src/index.css`; PWA service worker is `src/sw.ts`. Design spec: `DESIGN.md`.
- `statsea-fixes-plan.md`, `statsea-10-out-of-10-remediation.md`, and `docs/PLAN-...` are historical audit/plan records, **not** live instructions to follow.

## Knowledge graph (graphify)
- Build with the `/graphify` skill → outputs in `graphify-out/`. If `graphify-out/graph.json` already exists and the task is a question about the codebase, run `graphify query "<question>"` instead of rebuilding.
- The corpus is large; graphify's size warning may ask which subfolder to scan — choose `backend/` or `frontend/` for a focused graph.
