---
phase: 01-foundation
plan: 01
subsystem: api
tags: [express, sqlite, websocket, jwt, bcrypt, better-sqlite3, ws, vitest]

# Dependency graph
requires: []
provides:
  - "Express 5.2 HTTP server with JWT-authenticated REST API"
  - "SQLite database with users and presets tables, WAL mode, auto-seeding"
  - "WebSocket server in noServer mode for agent tunnel and frontend broadcast"
  - "ACK protocol: command requestId tracking, 15s stale rejection"
  - "POST /api/auth/login returning 12h JWT"
  - "POST /api/obs/scene, /api/ptz/preset/recall, /api/ptz/preset/save command relay"
  - "GET /api/agent/status and /api/command/:requestId polling endpoints"
affects: [01-02-agent, 01-03-frontend, 02-core-ui, 03-auto-director]

# Tech tracking
tech-stack:
  added:
    - "express@^5.2.0"
    - "ws@^8.21.0"
    - "better-sqlite3@^12.6.2"
    - "jsonwebtoken@^9.0.3"
    - "bcrypt@^6.0.0"
    - "vitest@^3.1.0"
    - "supertest (dev)"
    - "tsx@^4.19.0 (dev)"
    - "typescript@^5.7.0 (dev)"
  patterns:
    - "TDD with vitest + supertest for Express endpoints"
    - "WebSocket noServer mode shared with Express HTTP server"
    - "JWT HS256 12h expiry for operator auth"
    - "Shared secret token for agent WebSocket auth"
    - "ACK protocol: crypto.randomUUID requestId, pending Map, 15s stale cleanup"
    - "bcrypt hashSync for sync SQLite context seeding"

key-files:
  created:
    - "cloud/server/src/db/schema.ts"
    - "cloud/server/src/db/index.ts"
    - "cloud/server/src/middleware/auth.ts"
    - "cloud/server/src/routes/auth.ts"
    - "cloud/server/src/routes/commands.ts"
    - "cloud/server/src/ws/tunnel.ts"
    - "cloud/server/src/index.ts"
    - "cloud/server/src/__tests__/auth.test.ts"
    - "cloud/server/src/__tests__/tunnel.test.ts"
    - "cloud/server/src/__tests__/commands.test.ts"
    - "cloud/server/package.json"
    - "cloud/server/tsconfig.json"
    - "cloud/server/vitest.config.ts"
  modified: []

key-decisions:
  - "Used synchronous bcrypt.hashSync for DB seeding in better-sqlite3 context (sync API)"
  - "WS upgrade auth: agent uses shared secret (/ws), frontend uses JWT (/frontend)"
  - "Only one agent connection at a time — new connection replaces existing"
  - "Stale commands rejected after 15s (not per-command-type timeouts — those are agent-side)"

patterns-established:
  - "TDD: RED (failing test commit) → GREEN (implementation commit) per task"
  - "Express 5 native async handlers — no express-async-errors needed"
  - "ES module syntax throughout (type: module in package.json)"
  - "Test DB uses :memory: or tmpdir for isolation between test suites"
  - "supertest for HTTP assertions, raw ws client for WebSocket assertions"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, HWCTRL-01, HWCTRL-02, HWCTRL-03]

# Metrics
duration: 8min
completed: 2026-05-29
---

# Phase 01 Plan 01: Cloud Backend Summary

**Express 5.2 server with JWT auth, SQLite persistence, and WebSocket agent tunnel — 40 tests passing across 3 test suites**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-29T06:02:47Z
- **Completed:** 2026-05-29T06:11:00Z
- **Tasks:** 3
- **Files created:** 13

## Accomplishments
- SQLite schema with users (bcrypt passphrase hash) and presets (8 slots, CHECK constraints) tables
- POST /api/auth/login validates shared passphrase via bcrypt, returns 12h JWT
- JWT middleware rejects expired/invalid/missing tokens with appropriate 401/403 codes
- WebSocket server in noServer mode: agent connects at /ws (shared secret), frontend at /frontend (JWT)
- Bidirectional command relay with requestId tracking, ACK resolution, and 15s stale rejection
- REST endpoints (POST /api/obs/scene, /api/ptz/preset/recall, /api/ptz/preset/save) queue commands to connected agent
- GET /api/agent/status reports connection health; GET /api/command/:requestId polls pending ACK status

## Task Commits

1. **task 1: database schema, auth endpoints, and JWT middleware** — `b89bb48` (test) → `e2369f4` (feat)
2. **task 2: WebSocket server with agent tunnel management** — `ae7b35e` (test) → `e3325a4` (feat)
3. **task 3: REST command endpoints for hardware control** — `e9bcac1` (test) → `c31b92d` (feat)

## Files Created/Modified
- `cloud/server/src/db/schema.ts` — SQLite CREATE TABLE statements for users and presets
- `cloud/server/src/db/index.ts` — better-sqlite3 init with WAL mode, seeding, passphrase hash helpers
- `cloud/server/src/middleware/auth.ts` — JWT Bearer token extraction and verification middleware
- `cloud/server/src/routes/auth.ts` — POST /api/auth/login (bcrypt compare + JWT sign)
- `cloud/server/src/routes/commands.ts` — OBS/PTZ command endpoints, agent status, command polling
- `cloud/server/src/ws/tunnel.ts` — WebSocket server with agent/frontend auth, message relay, stale rejection
- `cloud/server/src/index.ts` — Express app wiring: auth, commands, health, WebSocket setup
- `cloud/server/src/__tests__/auth.test.ts` — 14 tests for DB schema and auth endpoints
- `cloud/server/src/__tests__/tunnel.test.ts` — 9 tests for WebSocket connections and message relay
- `cloud/server/src/__tests__/commands.test.ts` — 17 tests for REST command endpoints

## Decisions Made
- Used synchronous `bcrypt.hashSync` for DB seeding (better-sqlite3 is synchronous)
- Agent WebSocket auth: direct shared secret comparison (not bcrypt) — agents are machines, not users
- Only one agent connection at a time; new connection replaces existing one
- Stale command rejection: single 15s threshold server-side; per-command-type timeouts are agent-side
- Test DB isolation: each test suite uses `:memory:` or temp files, cleaned up in `afterAll`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test expectation for malformed Authorization header**
- **Found during:** task 1 (auth middleware testing)
- **Issue:** Test expected 403 for Authorization header missing "Bearer " prefix; middleware correctly returns 401 (no token)
- **Fix:** Changed test expectation from 403 to 401
- **Files modified:** cloud/server/src/__tests__/auth.test.ts
- **Committed in:** e2369f4 (part of task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test expectation)
**Impact on plan:** Minimal — test expectation did not match middleware behavior specification.

## Issues Encountered
None — all three tasks completed cleanly with TDD RED→GREEN flow.

## User Setup Required

The cloud backend requires environment variables at deploy time (Railway). The plan's frontmatter specifies:
- `JWT_SECRET` — generate via `openssl rand -hex 32`
- `AGENT_SHARED_SECRET` — generate via `openssl rand -hex 32`
- `PASSPHRASE` — choose a shared operator passphrase
- Railway volume mount at `/data` for SQLite persistence

A Railway deployment `start` command of `npm start` runs `node dist/index.js`. The DB path defaults to `./data/camflow.db` which maps to the Railway volume mount.

## Next Phase Readiness
- Cloud backend is fully operational for Phase 01-02 (Local Agent) to connect its WebSocket client
- Agent tunnel expects shared secret in `/ws?token=<secret>` query param
- Frontend can connect at `/frontend?token=<jwt>` for Phase 01-03 (Frontend Core)
- All endpoints are documented in must_haves section of PLAN.md
- 40 tests provide regression safety for downstream phases

---
*Phase: 01-foundation*
*Completed: 2026-05-29*
