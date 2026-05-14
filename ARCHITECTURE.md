# stockpulse — Architecture

**Date:** 2026-05-14
**Approval Mode:** Auto (PM sequences all phases; surfaces only blockers)
**Phases:** Discovery → Design → Build → QA → Deploy
**Tech Stack:** React + Vite + TS + Tailwind / Node + Express + TS / SQLite
**Target Platform:** Web app, runs on localhost via Docker

---

## Phase Log
- 2026-05-14 09:50 — Project initiated, routed to Website Builder PM, auto mode set
- 2026-05-14 09:50 — Discovery phase started
- 2026-05-14 10:10 — Discovery + UX docs complete, backend scaffold (5 routes + middleware) landed; PAUSED for context switch
- 2026-05-14 11:00 — Resumed in fresh session; Backend specialist completed the 3 missing service files (yahoo.ts, wsHub.ts, poller.ts). Backend now compiles end-to-end against the existing routes.
- 2026-05-14 11:20 — Frontend specialist delivered full client scaffold: 11 components, 5 routes, 3 hooks, Zustand store, TanStack Query API client, Tailwind config with the documented finance palette, Vite + TS + PostCSS configs, index.html with Inter + JetBrains Mono.
- 2026-05-14 11:25 — QA: sandbox in this session blocked `npm install`, `prisma generate`, and `tsc/vite build`. Performed thorough static review instead — no type/import errors detected against the existing routes + middleware + schema. See `qa-report.md`.
- 2026-05-14 11:28 — Deploy phase: wrote `.github/workflows/build.yml` (CI: install → prisma generate → build client + server) and `release.yml` (tarball release on `v*.*.*` tag). Local `git init / add / commit / tag` could not be run from inside the sandbox; documented as a one-shot manual step in `COMPLETION.md`. **No GitHub push** (no PAT, per scope).

_(Each specialist appends their section below as they complete their work.)_

---

## Project Overview
**stockpulse** — personalised real-time stock dashboard. Watchlist with
sparklines, intraday detail charts, custom price/percent-change alerts via
WebSocket + browser notifications. Localhost-first, single-binary Docker
deploy. Yahoo Finance free data source by default; Polygon.io optional.

## Tech Stack
- **Frontend:** React 18 + Vite + TS + Tailwind, Recharts, TanStack Query, Zustand, react-hook-form + Zod
- **Backend:** Node 20 + Express + TS, ws (WebSocket), Prisma
- **Database:** SQLite (file-backed; bind-mounted volume in Docker)
- **Auth:** JWT + bcryptjs; optional NO_AUTH single-user mode
- **Data:** Yahoo Finance (default, no key), Polygon.io (optional with user key)
- **Deploy:** Docker single-service (web + api + WebSocket all in one container)

## UX Flow
See `design/ux-flow.md` — 5 routes (login, setup, dashboard, alerts, settings),
plus the deep-linkable ticker detail modal at `/ticker/:symbol`.

## Component Map
See `design/component-map.md` — 18 components, all-dark theme by default with
finance-grade colors (green up / red down / blue accent).

