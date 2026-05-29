---
phase: 01-foundation
plan: 02
subsystem: agent
tags: [websocket, obs, ptz, ndi, node-windows, vitest, tdd]

# Dependency graph
requires:
  - "01-01 cloud backend (WebSocket tunnel endpoint, shared secret auth)"
provides:
  - "Persistent WebSocket client with token auth and exponential backoff reconnect"
  - "OBS scene switching via obs-websocket-js WebSocket v5 protocol"
  - "BirdDog PTZ preset recall/save via REST API with 5s timeout"
  - "ACK protocol: every cloud command acknowledged with ok/error + reason"
  - "Health heartbeat every 5s reporting OBS and PTZ subsystem status"
  - "Windows service installer via node-windows"
affects: [01-03-frontend, 02-core-ui, 03-auto-director, 04-integration]

# Tech tracking
tech-stack:
  added:
    - "ws@^8.21.0 (WebSocket client)"
    - "obs-websocket-js@^5.0.8 (OBS WebSocket v5)"
    - "node-windows@^1.0.0-beta.8 (Windows service installer)"
    - "vitest@^3.1.0 (testing)"
  patterns:
    - "TDD with vitest: RED (test commit) → GREEN (implementation commit) per task"
    - "ES modules (type: module in package.json)"
    - "vi.hoisted() for mock factories in vitest to avoid hoisting conflicts"
    - "Real ws WebSocketServer for integration testing (no mock needed)"
    - "Promise.race with timeout for PTZ (5s) and OBS (2s) commands"
    - "Module-level state with wsId tracking to prevent stale close handler conflicts"

key-files:
  created:
    - "agent/package.json"
    - "agent/src/config.js"
    - "agent/src/tunnel.js"
    - "agent/src/health.js"
    - "agent/src/obs.js"
    - "agent/src/ptz.js"
    - "agent/src/router.js"
    - "agent/src/index.js"
    - "agent/service.js"
    - "agent/src/__tests__/tunnel.test.js"
    - "agent/src/__tests__/obs.test.js"
    - "agent/src/__tests__/ptz.test.js"
    - "agent/src/__tests__/router.test.js"
  modified: []

key-decisions:
  - "PTZ protocol: REST API (configurable via PTZ_PROTOCOL env var, default rest)"
  - "Reconnect: exponential backoff 1s→2s→4s→...→30s max with ±50% jitter"
  - "Stale commands rejected after 15s (not replayed on tunnel reconnect)"
  - "OBS and PTZ are independent subsystems — one failing doesn't crash the other"
  - "OBS auto-reconnect: 5s retry on ConnectionClosed per PITFALLS.md guidance"
  - "PTZ reachability cached for 5s with explicit clearReachableCache() for testing"
  - "Connection identity tracking (wsId) prevents stale close handlers from nullifying new connections"
  - "Used real ws WebSocketServer in tests rather than fragile class mocking"

patterns-established:
  - "TDD: RED→GREEN commit pairs per task (6 commits for 3 tasks)"
  - "vi.hoisted() pattern for vitest mock factories referencing top-level variables"
  - "Real server integration tests for WebSocket (WebSocketServer on random port)"
  - "Mocked fetch for PTZ REST API tests with response simulation"
  - "Timeout tests with vi.realTimers + Promise.race (not fake timers)"

requirements-completed: [AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06]

# Metrics
duration: 12min
completed: 2026-05-29
---

# Phase 01 Plan 02: Local Agent Summary

**Node.js Windows service agent with WebSocket tunnel, OBS scene switching, PTZ preset control, ACK protocol, and health heartbeat — 28 tests passing across 4 test suites**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-29T06:14:00Z
- **Completed:** 2026-05-29T06:26:00Z
- **Tasks:** 3
- **Files created:** 13
- **Tests:** 28 passing (4 test suites)

## Accomplishments

- **WebSocket tunnel** — Persistent outbound connection to cloud with token auth, exponential backoff reconnect (1s→30s max with ±50% jitter), and stale command rejection (>15s)
- **OBS controller** — Scene switching via obs-websocket-js WebSocket v5 protocol with auto-reconnect on ConnectionClosed (5s retry)
- **PTZ controller** — BirdDog camera preset recall/save via REST API with 5s timeout, reachability check with 5s cache
- **Command router** — Central dispatch mapping cloud command types to hardware modules with ACK protocol (ok/error + reason), per-command timeouts (2s OBS, 5s PTZ)
- **Health heartbeat** — Every 5s sends subsystem status (OBS connection, PTZ reachability) over tunnel
- **Windows service** — node-windows installer supporting --install/--uninstall
- **ACK protocol** — Every command acknowledged: success returns `{ type: 'ack', requestId, status: 'ok' }`, failure returns `{ type: 'ack', requestId, status: 'error', error: message }`

## Task Commits

| # | Task | RED Commit | GREEN Commit |
|---|------|-----------|-------------|
| 1 | WebSocket tunnel, heartbeat, configuration | `174b7e9` | `a2d3785` |
| 2 | OBS controller, PTZ/NDI controller | `2b4cb3f` | `422be05` |
| 3 | Command router, ACK protocol, service installer | `7e6b3f0` | `da3c8cb` |

## Files Created/Modified

- `agent/package.json` — ESM project with ws, obs-websocket-js, node-windows, vitest
- `agent/src/config.js` — Env var loading with validation (CLOUD_WS_URL, AGENT_SHARED_SECRET, OBS_PORT, OBS_PASSWORD, PTZ_IP, PTZ_PROTOCOL)
- `agent/src/tunnel.js` — WebSocket client with connect/auto-reconnect/heartbeat/onCommand/send/getConnectionState
- `agent/src/health.js` — getSnapshot() aggregating OBS and PTZ subsystem states
- `agent/src/obs.js` — OBS WebSocket v5: connect/setScene/isConnected/disconnect
- `agent/src/ptz.js` — BirdDog REST API: recallPreset/savePreset/isReachable/clearReachableCache
- `agent/src/router.js` — Command dispatch with Promise.race timeouts and ACK generation
- `agent/src/index.js` — Agent entry point wiring tunnel→router→OBS/PTZ
- `agent/service.js` — node-windows service installer
- `agent/src/__tests__/tunnel.test.js` — 6 tests (config, connect, send, getConnectionState, heartbeat, onCommand)
- `agent/src/__tests__/obs.test.js` — 7 tests (connect, setScene, isConnected, disconnect)
- `agent/src/__tests__/ptz.test.js` — 6 tests (recallPreset, savePreset, isReachable, error handling)
- `agent/src/__tests__/router.test.js` — 9 tests (dispatch, ACK ok/error, OBS 2s timeout, PTZ 5s timeout, unknown command)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed obs-websocket-js version**
- **Found during:** task 1 (npm install)
- **Issue:** Package.json specified `obs-websocket-js@^5.1.6` which doesn't exist. Latest is 5.0.8.
- **Fix:** Changed to `"obs-websocket-js": "^5.0.8"`
- **Files modified:** agent/package.json
- **Committed in:** a2d3785

**2. [Rule 1 - Bug] Fixed stale WebSocket close handler nullifying new connections**
- **Found during:** task 1 testing
- **Issue:** When connect() was called while a previous WS was closing, the stale close handler set ws=null after the new connection was already established, causing send() to return false
- **Fix:** Added connection identity tracking (wsId increment per connection) and intentionalClose flag in connect(). Close handler now checks wsId matches before taking action.
- **Files modified:** agent/src/tunnel.js
- **Committed in:** a2d3785

**3. [Rule 1 - Bug] Fixed PTZ reachability cache polluting test assertions**
- **Found during:** task 2 testing
- **Issue:** isReachable() cached result from one test carried into another, causing "returns false when camera is not reachable" to receive cached true
- **Fix:** Added clearReachableCache() export and called it in test beforeEach()
- **Files modified:** agent/src/ptz.js, agent/src/__tests__/ptz.test.js
- **Committed in:** 422be05

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking, 2 Rule 1 bugs)
**Impact on plan:** Minimal — version fix, stale handler bug, and test cache issue all resolved inline.

## Decisions Made

- **PTZ protocol:** Default to REST API (BirdDog HTTP API). Configurable via `PTZ_PROTOCOL` env var for future NDI-direct support
- **Reconnect jitter:** ±50% random jitter on exponential backoff to prevent thundering herd on cloud reconnects
- **Tunnel testing:** Used real `ws` WebSocketServer on random port instead of fragile class mocking — matches cloud test pattern from plan 01-01
- **Mock pattern:** `vi.hoisted()` for mock factories to work around vitest hoisting in ESM context
- **Module isolation:** Each hardware module (obs, ptz) is independently initialized — OBS crash doesn't affect PTZ controller

## Issues Encountered

- Vitest `vi.mock()` hoisting conflicts with top-level variables required careful use of `vi.hoisted()` pattern
- Timeout tests require real timers (can't use vi.useFakeTimers with Promise.race-based timeouts) — adds ~7s to test suite
- obs-websocket-js latest stable is 5.0.8, not the 5.1.x assumed in planning

## User Setup Required

The agent requires a `.env` file at `C:\ProgramData\CamFlow\Agent\.env` with:
- `CLOUD_WS_URL` — cloud WebSocket endpoint (e.g., `wss://camflow-production.up.railway.app/ws`)
- `AGENT_SHARED_SECRET` — shared secret matching cloud's `AGENT_SHARED_SECRET`
- `OBS_PORT` — OBS WebSocket port (default: 4455)
- `OBS_PASSWORD` — OBS WebSocket password
- `PTZ_IP` — BirdDog camera IP address
- `PTZ_PROTOCOL` (optional) — `rest` (default) or `ndi-direct`

The service installer (`node service.js --install`) expects this config file at the working directory path.

## Next Phase Readiness

- Agent is fully operational for Phase 01-03 (Frontend Core) — the cloud backend (01-01) and local agent (01-02) are now both complete
- Frontend can connect to cloud at `/frontend?token=<jwt>` and issue commands via REST API
- Agent auto-reconnects if cloud restarts
- 28 tests provide regression safety for downstream phases

---

*Phase: 01-foundation*
*Plan: 02*
*Completed: 2026-05-29*
