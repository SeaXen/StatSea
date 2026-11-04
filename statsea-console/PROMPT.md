# StatSea redesign prompt

How to use: open your StatSea project in your AI coding tool (Claude Code, Cursor, etc.), attach `index.html` and `styles.css` from this folder as the visual reference, and paste everything inside the block below as one message. The prompt is complete on its own, so it still works if the files cannot be attached.

---

```
You are working inside my existing StatSea project, a network monitoring dashboard. Restyle the whole frontend to match a new design called "StatSea console": a dark, professional, data-dense ops console. I am attaching two reference files, index.html and styles.css. Treat them as the visual source of truth. If they are not attached, everything you need is described below.

PROJECT CONTEXT
- Frontend: React 18, Vite, Tailwind CSS 3.4, Recharts, Lucide React.
- Backend: FastAPI, Scapy, SQLAlchemy, REST plus WebSocket streaming. Docker and CasaOS deployment.
- Existing features: real-time bandwidth telemetry, protocol and packet-size analytics, device discovery (ARP/DHCP), external connections view, Docker container monitoring, DNS and security logs, theme-aware UI.

HARD RULES
1. Change presentation only. Do not change backend code, API routes, WebSocket message shapes, hooks, state logic, data fetching, or file/folder structure beyond what the restyle needs.
2. Keep existing component names, props, and exports. If you must restructure JSX, list each file where you did.
3. Never hard-code hex colors in components. Use the design tokens below through Tailwind theme tokens and CSS variables.
4. Do not invent data. Every number in the reference HTML is placeholder content. Bind each element to the real data my app already has. If a field in the design has no data source in my app (for example "MAC vendor" or "Packets per second"), show it only if I already collect it, otherwise omit that column or cell and tell me.
5. Remove the old look completely (old glassmorphism blur, old gradients, old sidebar) rather than layering the new style on top.

DESIGN TOKENS (define as CSS variables on :root and map into tailwind.config.js under theme.extend.colors, so classes like bg-panel, text-muted, border-line, text-accent work)
- bg #0f1115 (page)
- bar #12151a (top bar, tab row, status bar)
- panel #15181e (all panels)
- raised #1a1e26
- line #242933 (panel borders, dividers)
- line-soft #1e232c (table row dividers, chart gridlines)
- line-strong #2b3140 (inputs, selects)
- text #e7e9ee, text-soft #b6bcc9, muted #8b93a3, faint #5d6574
- accent #7c8cff (the single brand accent; also download series), accent-soft rgba(124,140,255,0.10) for row hover
- upload #4fd1e8 (upload series only)
- ok #3dd68c, warn #f5a524, danger #f5604f (status only, never decoration)
- Radii: panels 10px, controls 7px. Panel gap 12px.
- No gradients, no blur, no drop shadows, no glow. Depth comes from borders and surface steps only. One exception: the bandwidth area fill is a flat accent at 10% opacity.
- Provide a light theme only if my app already has a theme toggle: keep the toggle and define the same token names with light values (page #f5f6fa, panel #ffffff, line #e3e6ef, text #151826, muted #6b7391, accent #4f5ce6). If there is no toggle, ship dark only.

TYPOGRAPHY
- UI font: Inter (400, 500, 600) with system-ui fallback. Mono font: JetBrains Mono 400 with ui-monospace fallback, used only for IP addresses, MAC addresses, ports, and timestamps.
- Base size 13px, line-height 1.5. Panel titles 13px/600. Stat values 24px/600 with letter-spacing -0.02em. Labels 12px muted.
- Use tabular numbers (font-variant-numeric: tabular-nums) on every metric, table number, and timestamp.
- Sentence case everywhere. No all-caps labels. Buttons and labels use short verbs and plain words.

