---
phase: 02-core-ui-preset-management
plan: "02-01"
subsystem: api
tags: [express, better-sqlite3, jwt, websocket, preset-crud, ptz-movement]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Express server, JWT auth middleware, WebSocket tunnel, SQLite schema with presets table, command relay pattern"
provides:
  - "Preset CRUD API: GET all presets, PUT update preset fields, PATCH reorder presets (atomic transaction)"
  - "PTZ movement API: POST /api/ptz/move, POST /api/ptz/zoom, POST /api/ptz/stop"
  - "Input validation: ptz_number 1-8, settle_time > 0, active 0/1, move direction up/down/left/right, zoom direction in/out, speed 1-100"
affects: ["02-core-ui-preset-management frontend plans", "03-auto-director-engine PTZ control"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic SQL column update — only modified fields in PUT body update preset row"
    - "Reused command relay pattern (sendToAgent + crypto.randomUUID) from commands.ts for PTZ movement"
    - "Validation helper pattern (validateDirection, validateSpeed) mirroring commands.ts style"
    - "Test isolation via explicit ID seeding + sqlite_sequence reset for SQLite AUTOINCREMENT"

key-files:
  created:
    - cloud/server/src/routes/presets.ts
    - cloud/server/src/routes/ptz-move.ts
    - cloud/server/src/__tests__/presets.test.ts
    - cloud/server/src/__tests__/ptz-move.test.ts
  modified:
    - cloud/server/src/index.ts

key-decisions:
  - "Partial PUT updates use dynamic SQL columns — only provided fields are updated, others preserved"
  - "PTZ movement reuses existing command relay (sendToAgent + requestId) rather than duplicating infrastructure"
  - "Preset reorder executes as a single better-sqlite3 transaction for atomicity"
  - "Test beforeEach resets sqlite_sequence to maintain predictable IDs across test isolation"

patterns-established:
  - "Dynamic partial update: PUT endpoints collect only provided fields into SQL SET clause"
  - "Direction validation: enum-like const arrays with lowercase normalization"
  - "Speed validation: 1-100 range matching PTZ hardware controller feel"

requirements-completed: [PRESET-01, PRESET-02, PRESET-03, PRESET-04, HWCTRL-04, HWCTRL-05]

# Metrics
duration: 5min
completed: 2026-05-29
---

# Plan 02-01: Backend API — Presets + PTZ Movement Summary

**REST API for preset CRUD (GET/PUT/PATCH) with SQLite persistence and PTZ joystick movement relay through WebSocket tunnel**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-29T07:19:02Z
- **Completed:** 2026-05-29T07:24:06Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- Preset CRUD endpoints: GET /api/presets (all 8 ordered by sort_order), PUT /api/presets/:id (dynamic partial update with validation), PATCH /api/presets/reorder (atomic transaction)
- PTZ movement endpoints: POST /api/ptz/move (pan/tilt), POST /api/ptz/zoom, POST /api/ptz/stop — all relay commands to agent with requestId ACK tracking
- 75 total passing tests (18 presets + 17 PTZ + 40 existing Phase 1) — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Preset failing tests** — `fa46ad8` (test: add failing tests for preset CRUD endpoints)
2. **Task 1 GREEN: Preset implementation** — `a9c95a8` (feat: implement preset CRUD API endpoints)
3. **Task 2 RED: PTZ failing tests** — `b6399bd` (test: add failing tests for PTZ movement endpoints)
4. **Task 2 GREEN: PTZ implementation** — `4a3600d` (feat: implement PTZ movement API endpoints)

## Files Created/Modified

- `cloud/server/src/routes/presets.ts` — Preset CRUD: GET all, PUT update, PATCH reorder with transaction
- `cloud/server/src/routes/ptz-move.ts` — PTZ movement: POST move, POST zoom, POST stop via WebSocket relay
- `cloud/server/src/__tests__/presets.test.ts` — 18 tests covering auth, CRUD, validation, reorder
- `cloud/server/src/__tests__/ptz-move.test.ts` — 17 tests covering auth, direction/speed validation, agent relay
- `cloud/server/src/index.ts` — Wired `/api/presets` and `/api/ptz` routes with JWT middleware

## Decisions Made

- Partial PUT updates use dynamic SQL columns — only provided fields in request body update the corresponding columns, preserving unmodified fields
- PTZ movement reuses existing command relay infrastructure (sendToAgent + requestId pattern) from commands.ts rather than creating separate transport
- Preset reorder executes inside a better-sqlite3 transaction wrapper for atomic all-or-nothing behavior
- Test isolation uses explicit ID seeding + sqlite_sequence DELETE to guarantee predictable IDs (1-8) across beforeEach resets

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLite AUTOINCREMENT IDs shifted after beforeEach DELETE+INSERT**
- **Found during:** Task 1 (preset test GREEN verification)
- **Issue:** `beforeEach` deleted all presets then re-seeded — but SQLite AUTOINCREMENT continued from previous max ID, so preset IDs became 9-16 instead of 1-8, causing all PUT tests to return 404
- **Fix:** Added `DELETE FROM sqlite_sequence WHERE name='presets'` and explicit ID values in the seed INSERT (`INSERT INTO presets (id, ...)`)
- **Files modified:** `cloud/server/src/__tests__/presets.test.ts`
- **Committed in:** `a9c95a8` (merged into Task 1 GREEN commit)

**2. [Rule 1 - Bug] Test race condition: stop endpoint 503 test ran after agent-connected test**
- **Found during:** Task 2 (PTZ test GREEN verification)
- **Issue:** The `returns 503 when no agent is connected` test for `/api/ptz/stop` ran immediately after the `returns 202 with agent` test — WebSocket close handler hadn't fired yet, so ensureAgentConnected passed but sendToAgent failed, producing wrong error message
- **Fix:** Reordered tests so 503 test runs first (before any agent connection), matching the move/zoom test patterns
- **Files modified:** `cloud/server/src/__tests__/ptz-move.test.ts`
- **Committed in:** `4a3600d` (merged into Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for correct test behavior. No scope creep.

## Issues Encountered

- SQLite AUTOINCREMENT behavior differs from expected — `DELETE FROM` preserves the autoincrement counter; must explicitly reset `sqlite_sequence` for test isolation with predictable IDs
- WebSocket close async timing creates race conditions in test suites that connect then disconnect agents — test ordering matters

## Next Phase Readiness

- Backend API complete for preset management and PTZ movement — frontend plans (02-02, 02-03) can now consume these endpoints
- 6 requirements satisfied: PRESET-01 through PRESET-04, HWCTRL-04, HWCTRL-05
- Agent must handle new command types (`ptz_move`, `ptz_zoom`, `ptz_stop`) — needs agent-side router update

---

*Phase: 02-core-ui-preset-management*
*Completed: 2026-05-29*
