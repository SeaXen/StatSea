---
name: StatSea
description: Enterprise real-time network surveillance, telemetry visualization, and bandwidth monitoring console design system.
colors:
  bg: "#0f1115"
  bar: "#12151a"
  panel: "#15181e"
  raised: "#1a1e26"
  line: "#242933"
  line-soft: "#1e232c"
  line-strong: "#2b3140"
  text: "#e7e9ee"
  text-soft: "#b6bcc9"
  muted: "#8b93a3"
  faint: "#5d6574"
  accent: "#7c8cff"
  accent-soft: "rgba(124, 140, 255, 0.10)"
  upload: "#4fd1e8"
  ok: "#3dd68c"
  warn: "#f5a524"
  danger: "#f5604f"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  control: "7px"
  panel: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  gap: "12px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#0b0d11"
    rounded: "{rounded.control}"
    padding: "6px 14px"
  panel-surface:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "16px"
  badge-status:
    textColor: "{colors.text}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# StatSea Design System

## Overview

StatSea is an enterprise-grade real-time network intelligence, packet surveillance, and infrastructure monitoring platform. The visual world is precision-engineered for continuous operations (NOC / SecOps environments) where data density, visual scanability, tactile physical responsiveness, and zero telemetry jitter take precedence over casual decoration.

The system is designed in accordance with **Impeccable** standards and Emil Kowalski design engineering principles:
* **Tactile active feedback** with micro-press physics.
* **100% full-surface theme synchronization** across 6 presets (`dark`, `light`, `cyberpunk`, `dracula`, `nord`, `midnight`).
* **Zero AMOLED/pitch black traps** — using cohesive tonal elevation (`--bg`, `--panel`, `--raised`, `--bar`).
* **Tabular numeric alignment** across all streaming metrics, byte counters, and historical records.
* **Themed browser surfaces**: styled selection, caret colors, focus rings, and slim scrollbars.

---

## Colors

StatSea uses a unified two-tier token hierarchy powered by CSS custom properties and Tailwind tokens.

### Core Console Tokens (Dark Ops Default)
* **Background (`--bg`)**: `#0f1115` — Soft dark obsidian canvas preventing eye fatigue in low-light environments.
* **Top Bar (`--bar`)**: `#12151a` — Anchor header layer with 1px border separation.
* **Panel Surface (`--panel`)**: `#15181e` — Primary card container providing clear contrast against the canvas.
* **Raised Surface (`--raised`)**: `#1a1e26` — Elevated interactive controls, dropdowns, input backgrounds, and table headers.
* **Structural Borders (`--line`)**: `#242933` — Subtle 1px structural boundaries.
* **Dividers (`--line-soft`)**: `#1e232c` — Gentle intra-panel separators.
* **Emphasis Borders (`--line-strong`)**: `#2b3140` — Input and active focus borders.
* **Primary Text (`--text`)**: `#e7e9ee` — Crisp, high-contrast readable typography.
* **Secondary Text (`--text-soft`)**: `#b6bcc9` — Clear sub-headings and active labels.
* **Muted Text (`--muted`)**: `#8b93a3` — Column headers, units, and timestamps.
* **Faint Text (`--faint`)**: `#5d6574` — Subtle hints, secondary labels, and inactive indicators.

### 6 Synchronized Theme Presets
1. **Dark Ops (`dark`)**: Precision NOC console (`#0f1115` canvas / `#15181e` panel / `#7c8cff` periwinkle accent).
2. **Daylight (`light`)**: Clean high-contrast audit mode (`#f5f6fa` canvas / `#ffffff` panel / `#4f5ce6` cobalt accent).
3. **Cyberpunk (`cyberpunk`)**: Neon terminal theme (`#08080f` canvas / `#121224` panel / `#00ffcc` teal neon accent).
4. **Dracula (`dracula`)**: Iconic gothic palette (`#282a36` canvas / `#343746` panel / `#bd93f9` purple accent).
5. **Nord (`nord`)**: Arctic blue tones (`#2e3440` canvas / `#3b4252` panel / `#88c0d0` ice blue accent).
6. **Midnight (`midnight`)**: Deep marine theme (`#060913` canvas / `#0e1424` panel / `#38bdf8` sky blue accent).

### Semantic Status Tokens
* **Download / Telemetry**: `var(--accent)` (`#7c8cff`)
* **Upload / WAN**: `var(--upload)` (`#4fd1e8`)
* **Healthy / OK / Secure**: `var(--ok)` (`#3dd68c`)
* **Warning / Throttling**: `var(--warn)` (`#f5a524`)
* **Critical / Danger / Offline**: `var(--danger)` (`#f5604f`)

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
