---
phase: 02-core-ui-preset-management
plan: 03
subsystem: agent
tags: [ptz, rest-api, router, websocket, ack-protocol, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: agent tunnel, router with ACK protocol, PTZ preset recall/save
  - phase: 02-core-ui-preset-management (plan 02-01)
    provides: preset CRUD API endpoints
provides:
  - PTZ joystick movement commands (move, zoom, stop) in the local agent
  - Router dispatch with direction/speed validation and ACK protocol
  - Continuous pan/tilt and zoom control via REST API
affects: [cloud-api, frontend-joystick, ptz-control]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Router-side input validation before delegating to hardware modules
    - Direction whitelist validation (MOVE_DIRECTIONS, ZOOM_DIRECTIONS)
    - Speed range validation (1-100) with clear error messages
    - Same ACK protocol pattern as Phase 1 (ok on success, error on failure/timeout)
    - 5s timeout on all PTZ movement commands

key-files:
  created: []
  modified:
    - agent/src/ptz.js - Added move(), zoom(), stop() functions
    - agent/src/router.js - Added ptz_move, ptz_zoom, ptz_stop dispatch cases
    - agent/src/__tests__/ptz.test.js - Added 16 new tests for movement functions
    - agent/src/__tests__/router.test.js - Added 13 new tests for movement dispatch

key-decisions:
  - "Router performs input validation (direction whitelist, speed range) before delegating to PTZ module for fast-fail ACK errors"
  - "PTZ module also validates input as defense-in-depth, throwing same error classes"
  - "Move and zoom share a validateSpeed() helper; move and zoom each have their own direction whitelists"

patterns-established:
  - "Input validation at router layer: direction whitelist and speed range checked before hardware call, producing immediate ACK errors"
  - "TDD pattern: test file adds function import, writes failing tests, implements, verifies all pass"
  - "Defense-in-depth: both router and PTZ module validate inputs"

requirements-completed: [HWCTRL-04, HWCTRL-05]

# Metrics
duration: 4min
completed: 2026-05-29
---

# Phase 2 Plan 3: Agent — PTZ Joystick Movement Commands Summary

**PTZ joystick movement commands (move, zoom, stop) with direction/speed validation, 5s timeout, and ACK protocol — extending the Phase 1 agent router for continuous camera control**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-29T07:18:47Z
- **Completed:** 2026-05-29T07:22:22Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `ptz.move(direction, speed)` — continuous pan/tilt in up/down/left/right directions at speed 1-100
- `ptz.zoom(direction, speed)` — zoom in/out at speed 1-100
- `ptz.stop()` — immediate halt of all PTZ movement
- Router dispatch for `ptz_move`, `ptz_zoom`, `ptz_stop` with full ACK protocol
- Input validation at both router and PTZ module layers (defense-in-depth)
- All 57 agent tests pass (22 PTZ + 22 router + 7 OBS + 6 tunnel), including 29 new tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PTZ movement functions to PTZ module** - `1d32bf7` (test) → `d40042c` (feat)
2. **Task 2: Add router dispatch for PTZ movement commands** - `06b5c1c` (test) → `451bff8` (feat)
3. **Task 3: Create SUMMARY.md and update tracking** - (this commit)

## Files Created/Modified
- `agent/src/ptz.js` - Added `move()`, `zoom()`, `stop()` functions with direction/speed validation and 5s timeout via existing `ptzRequest()` helper
- `agent/src/router.js` - Added `ptz_move`, `ptz_zoom`, `ptz_stop` dispatch cases with input validation, Promise.race timeout, and ACK protocol
- `agent/src/__tests__/ptz.test.js` - Added 16 tests covering all directions, speed validation, error handling, and fetch errors
- `agent/src/__tests__/router.test.js` - Added 13 tests covering dispatch correctness, ACK ok/error, timeout, and validation

## Decisions Made
- Router performs input validation (direction whitelist, speed 1-100) before delegating to PTZ module for fast-fail ACK errors — avoids unnecessary mock calls in tests
- PTZ module also validates input as defense-in-depth, throwing same error messages
- Move and zoom each have their own direction whitelists (`MOVE_DIRECTIONS`, `ZOOM_DIRECTIONS`) rather than a shared enum

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - no external service configuration required. Agent uses existing PTZ_IP environment variable.

## Next Phase Readiness
- Agent-side PTZ joystick movement commands are ready
- Cloud API needs new endpoints: POST /api/ptz/move, POST /api/ptz/zoom, POST /api/ptz/stop
- Frontend joystick D-pad can now issue ptz_move/ptz_zoom/ptz_stop commands via WebSocket
- Ready for Plan 02-04 (frontend joystick UI) or Plan 03-01 (auto-director engine)

---
*Phase: 02-core-ui-preset-management*
*Completed: 2026-05-29*
