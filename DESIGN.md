---
name: StatSea
description: Enterprise real-time network surveillance, telemetry visualization, and bandwidth monitoring design system.
colors:
  background: "#020617"
  foreground: "#f8fafc"
  primary: "#3b82f6"
  primary-hover: "#2563eb"
  primary-foreground: "#ffffff"
  secondary: "#1e293b"
  secondary-foreground: "#f8fafc"
  accent: "#06b6d4"
  accent-foreground: "#ffffff"
  muted: "#1e293b"
  muted-foreground: "#94a3b8"
  border: "#1e293b"
  card: "#020617"
  card-foreground: "#f8fafc"
  success: "#10b981"
  warning: "#f59e0b"
  destructive: "#ef4444"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, Cascadia Code, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-foreground}"
  card-surface:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge-status:
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# StatSea Design System

## Overview

StatSea is an enterprise-grade real-time network intelligence, packet surveillance, and infrastructure monitoring platform. The visual world is precision-engineered for continuous operations (NOC / SecOps environments) where data density, visual scanability, tactile physical responsiveness, and zero telemetry jitter take precedence over casual decoration.

The system is designed in accordance with **Impeccable** standards and the **Vercel Web Interface Guidelines**, delivering tactile active feedback, seamless light/dark dual-theming via HSL tokens, balanced typography, and tabular numeric alignment across all streaming metrics.

---

## Colors

StatSea uses a semantic, dual-tier token hierarchy powered by CSS custom properties and Tailwind tokens.

### Dark Mode (Primary NOC Atmosphere)
* **Background (`--background`)**: `hsl(222.2, 84%, 4.9%)` (`#020617`) — Deepest obsidian slate, engineered to minimize eye strain in 24/7 operating environments.
* **Surface Card (`--card`)**: `hsl(222.2, 84%, 4.9% / 85%)` with backdrop-filter blur (`16px`).
* **Foreground (`--foreground`)**: `hsl(210, 40%, 98%)` (`#f8fafc`) — High-contrast off-white for crisp, readable data.
* **Muted Foreground (`--muted-foreground`)**: `hsl(215, 20.2%, 65.1%)` (`#94a3b8`) — Neutral slate for secondary descriptions, timestamps, and column labels.
* **Borders (`--border`)**: `hsl(217.2, 32.6%, 17.5%)` (`#1e293b`) — Delicate 1px structural boundaries.

### Light Mode (Auditing & Daylight Mode)
* **Background (`--background`)**: `hsl(0, 0%, 100%)` (`#ffffff`) — Pure white surface.
* **Card (`--card`)**: `hsl(0, 0%, 100%)` with soft 1px border.
* **Foreground (`--foreground`)**: `hsl(222.2, 84%, 4.9%)` (`#020617`) — Dark navy charcoal.
* **Primary Accent (`--primary`)**: `hsl(221.2, 83.2%, 53.3%)` (`#2563eb`) — Vivid cobalt blue.

### Semantic Status Palette
* **Live / Online / Secure**: `hsl(142.1, 76.2%, 36.3%)` (`#10b981`) — Emerald green.
* **Telemetry Streaming / Download**: `hsl(217.2, 91.2%, 59.8%)` (`#3b82f6`) — Cobalt blue.
* **Upload / WAN**: `hsl(173.4, 80.4%, 40%)` (`#14b8a6`) — Teal cyan.
* **Warning / Throttling**: `hsl(37.7, 92.1%, 50.2%)` (`#f59e0b`) — Amber warning.
* **Critical Alert / Offline**: `hsl(0, 84.2%, 60.2%)` (`#ef4444`) — Crimson red.

---

## Typography

The typography is built around clean visual rhythm and zero layout jitter during high-frequency real-time updates.

* **Primary Body & Headings**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  * Headings enforce `text-wrap: balance` to eliminate awkward single-word widows.
  * Headings use solid, semantic `text-foreground` — gradient text is strictly banned.
* **Monospace & Telemetry Numbers**: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`
  * Applied across IP addresses, MAC addresses, port mappings, and JSON/packet dumps.
* **Tabular Numerals**: All streaming data cells, byte counters, and gauges enforce `font-variant-numeric: tabular-nums;` to guarantee fixed character widths and prevent horizontal layout shifts as metrics tick.
* **Mobile Touch Protection**: Inputs, selects, and textareas enforce `font-size: 16px !important` on coarse pointers (`@media (pointer: coarse)`) to prevent iOS Safari auto-zooming.

---

## Layout

StatSea follows an adaptive dual-column layout with rigid content containers:

* **Sidebar Navigation**: Fixed 260px collapsible drawer (collapsible to 72px icon rail) with immediate navigation tabs.
* **Top Navigation Bar**: Sticky 64px header containing simulation status pill, global command palette trigger (⌘K), real-time notifications, theme toggle, and authenticated user profile.
* **Grid Hierarchy**:
  * **Top Stats Row**: 4-column balanced grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`).
  * **Primary Visualization Arena**: Split 8-column / 4-column layout (`lg:grid-cols-12`) pairing real-time Area charts with host system gauges (CPU, RAM, DISK).
  * **Secondary Data Matrix**: 2-column split for Bandwidth Summary and Active Device ranking.
  * **Event Log / Alerts Feed**: Full-width data table with filter chips and live status badges.
* **Spacing Scale**: Consistent 8px base grid (`8px`, `16px`, `24px`, `32px`, `48px`).

---

## Elevation & Depth

StatSea eschews heavy drop-shadows and neobrutalist block-shadows in favor of subtle translucent layering and glassmorphism:

* **Card Layering**: `bg-card/85` with `backdrop-blur-xl` and `border border-border/70`.
* **Hover Elevation**: Micro-lift `-translate-y-1` on hover paired with soft ambient shadow:
  ```css
  box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.1);
  ```
* **Scroll Containment**: Modals, drawer panels, and slide-overs enforce `overscroll-behavior: contain;` to isolate overlay gestures from background document scrolling.

---

## Shapes

* **Corner Radii Hierarchy**:
  * **Action Controls & Inputs**: `rounded-md` (`8px`) or `rounded-lg` (`12px`).
  * **Cards & Panels**: `rounded-2xl` (`16px`) for clean, modern framing.
  * **Outer Modals & Dialogs**: `rounded-3xl` (`24px`).
  * **Status Pills & Chips**: `rounded-full` (`9999px`) for high legibility.
* **Selection Protection**: All buttons, links, and navigation items enforce `user-select: none;` to prevent unwanted text highlighting on quick double-clicks.

---

## Components

### 1. Buttons & Interactive Controls
* **Active Press Physics**: Buttons and interactive controls feature tactile micro-press feedback:
  ```css
  button:active:not(:disabled), [role="button"]:active:not(:disabled), a:active {
    transform: scale(0.98);
    transition: transform 80ms ease-out;
  }
  ```
* **Explicit Transitions**: All hover states use explicit `transition-colors` or `transition-transform` over 150ms–200ms instead of unconstrained `transition-all`.

### 2. Metrics & Gauges
* Host resource widgets utilize radial progress arcs with explicit percentage readouts, current usage, and total capacity.
* All cards carry typographic ellipsis (`…`) during loading or truncation instead of raw three dots (`...`).

### 3. Forms & Inputs
* Every `<input>` explicitly pairs with a `<label htmlFor="...">`.
* Login inputs provide `autoComplete`, `spellCheck={false}`, and `autoCapitalize="none"`.
* Validation errors render with `role="alert"` and `aria-live="polite"`.

---

## Do's and Don'ts

### Do:
* **DO** use `font-variant-numeric: tabular-nums` on any value that streams, updates, or ticks in real time.
* **DO** maintain 4.5:1 text contrast for body copy and 3:1 for large display titles.
* **DO** use semantic `text-foreground` and `text-muted-foreground` for all titles and body copy.
* **DO** use `@media (prefers-reduced-motion: reduce)` to respect user accessibility preferences.
* **DO** use `touch-action: manipulation` on mobile touch targets to eliminate 300ms latency.

### Don't:
* **DON'T** use gradient text (`bg-clip-text text-transparent bg-gradient-...`) on headings or metrics.
* **DON'T** hardcode raw `text-white` or `bg-black` in components; use theme tokens (`text-foreground`, `bg-card`, `bg-background`).
* **DON'T** use unconstrained `transition-all` on large container cards.
* **DON'T** let inputs drop below `16px` on coarse pointers (iOS auto-zoom prevention).
* **DON'T** use nested cards inside existing cards.
