---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [react, vite, tailwind, websocket, jwt, ack-protocol]

# Dependency graph
requires:
  - phase: 01-foundation
    plan: 01-01
    provides: Cloud backend REST API and WebSocket tunnel infrastructure
provides:
  - Operator login UI with shared passphrase authentication and JWT storage
  - Real-time status bar showing Agent/OBS/PTZ connection health via WebSocket
  - Command panel with OBS scene switching and PTZ preset recall/save grid
  - Optimistic UI with ACK-based feedback (pending → confirmed → error states)
  - Latest-command-wins pattern for rapid operator commands
  - Error toast system with 5s auto-dismiss and no-stacking behavior
affects: [02-core-ui, 03-auto-director]

# Tech tracking
tech-stack:
  added:
    - React 19.2.6
    - React Router 7.16.0
    - Tailwind CSS 4.3.0
    - Vite 8.0.12
    - Vitest 3.2.4
    - Testing Library (React, Jest-DOM, User-Event)
    - jsdom 26.1.0
  patterns:
    - TDD with vitest + jsdom + testing-library
    - Optimistic UI with ACK protocol via WebSocket callbacks
    - Latest-command-wins command state management
    - Context-based Toast notification system

key-files:
  created:
    - cloud/client/src/services/api.ts - Typed REST API client
    - cloud/client/src/hooks/useAuth.ts - JWT session management
    - cloud/client/src/hooks/useWebSocket.ts - WebSocket with health/command tracking
    - cloud/client/src/hooks/useCommandState.ts - ACK-based command state machine
    - cloud/client/src/pages/Login.tsx - Passphrase login with show/hide + error handling
    - cloud/client/src/components/StatusBar.tsx - Fixed top status bar with 3 health indicators
    - cloud/client/src/components/Toast.tsx - Context-based toast notifications
    - cloud/client/src/components/CommandPanel.tsx - Camera switcher + PTZ preset grid
    - cloud/client/src/components/Dashboard.tsx - Shell wrapping StatusBar + Toast + WebSocket
    - cloud/client/src/App.tsx - Router with protected routes
    - cloud/client/src/main.tsx - React entry point
    - cloud/client/src/index.css - Tailwind CSS 4 import
    - cloud/client/src/__tests__/ - 6 test files, 33 tests
  modified: []

key-decisions:
  - "WebSocket URL derived from window.location (protocol-aware ws:// vs wss://)"
  - "Agent health 'agent' field derived: true when receiving messages, false on close"
  - "Reconnecting state shown when wasEverConnected=true but agent=false (avoids red on initial load)"
  - "Pending commands tracked by requestId; new command callback replaces previous one for latest-command-wins"
  - "Toast uses requestAnimationFrame timing (50ms delay) for CSS transition reset on replace"

patterns-established:
  - "TDD Pattern: vitest + jsdom + testing-library with mock fetch, localStorage, WebSocket"
  - "ACK Feedback UX: pending (blue ring) → confirmed (green fill) → error (red flash + revert)"
  - "Protected Routes: React Router guard checking localStorage token, redirects to /login"
  - "WebSocket Reconnect: 3s fixed interval, cleans up on unmount"

requirements-completed: [AUTH-01, HWCTRL-01, HWCTRL-02, HWCTRL-03]

# Metrics
duration: ~12min
completed: 2026-05-29
---

# Phase 01 Plan 03: Operator Frontend — Login, Status Bar, and Command Panel

**React 19 SPA with JWT auth, real-time WebSocket health indicators, and ACK-based hardware command panel**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-29T06:14:20Z
- **Completed:** 2026-05-29T06:22:50Z (approx)
- **Tasks:** 3
- **Files modified:** 22 (19 created, 3 configuration)

## Accomplishments

- Login page with shared passphrase auth, show/hide toggle, error handling, and JWT localStorage persistence
- Real-time status bar with three hardware health indicators (Agent, OBS, PTZ) using green/orange/red color coding
- Command panel with camera switcher (Cam 1 PTZ / Cam 2 Wide) and 8-slot PTZ preset grid (Recall + Save per slot)
- Full ACK-based optimistic UI: buttons show pending state immediately, confirm on ACK, flash error on NACK
- Latest-command-wins pattern: rapid operator clicks always resolve to the most recent intent
- Error toast system: 5-second visibility, new toast replaces previous (no stacking)
- 33 automated tests across 6 test files covering login, API, WebSocket, status bar, toast, and command panel

## Task Commits

Each task was committed atomically:

1. **task 1: project scaffold, API service, auth hook, and login page** - `ce08118` (feat)
2. **task 2: WebSocket hook, status bar, and toast notifications** - `b8dc1de` (feat)
3. **task 3: command panel with OBS scene switch, PTZ presets, and ACK feedback UX** - `383f976` (feat)

## Files Created/Modified

- `cloud/client/package.json` - Vite React TS project with all dependencies
- `cloud/client/vite.config.ts` - Vite config with React + Tailwind plugins + dev proxy
- `cloud/client/tsconfig.json` - TypeScript config with JSX support
- `cloud/client/index.html` - Entry HTML with #root mount point
- `cloud/client/vitest.config.ts` - Vitest config with jsdom environment
- `cloud/client/src/index.css` - Tailwind CSS 4 import
- `cloud/client/src/main.tsx` - React entry with StrictMode
- `cloud/client/src/App.tsx` - Router with /login, / (protected), * (redirect)
- `cloud/client/src/services/api.ts` - Typed API: login, switchScene, recallPreset, savePreset, getAgentStatus
- `cloud/client/src/hooks/useAuth.ts` - JWT token management (camflow_token in localStorage)
- `cloud/client/src/hooks/useWebSocket.ts` - WebSocket connection with health tracking + command callbacks
- `cloud/client/src/hooks/useCommandState.ts` - ACK-based optimistic UI state machine
- `cloud/client/src/pages/Login.tsx` - Login page with passphrase input, show/hide, error, loading spinner
- `cloud/client/src/components/StatusBar.tsx` - Fixed top bar with Agent/OBS/PTZ indicators
- `cloud/client/src/components/Toast.tsx` - Context-based toast with auto-dismiss and replacement
- `cloud/client/src/components/Dashboard.tsx` - Shell wrapping StatusBar + Toast + WebSocket context
- `cloud/client/src/components/CommandPanel.tsx` - Camera switcher + 8-slot PTZ preset grid
- `cloud/client/src/__tests__/setup.ts` - Test setup with jest-dom matchers
- `cloud/client/src/__tests__/Login.test.tsx` - 4 tests (render, empty, valid login, wrong passphrase)
- `cloud/client/src/__tests__/api.test.ts` - 12 tests (exports + HTTP behavior)
- `cloud/client/src/__tests__/useWebSocket.test.tsx` - 4 tests (connect, no-connect, health, close)
- `cloud/client/src/__tests__/StatusBar.test.tsx` - 4 tests (indicators, health states, layout)
- `cloud/client/src/__tests__/Toast.test.tsx` - 3 tests (appear, auto-dismiss, replacement)
- `cloud/client/src/__tests__/CommandPanel.test.tsx` - 6 tests (render, switch, recall, save, latest-wins, disabled)

## Decisions Made

- WebSocket URL auto-detects protocol (ws:// for dev, wss:// for production)
- Agent health dered from message receipt (true when receiving, false on WS close)
- Reconnecting state uses `wasEverConnected` flag to avoid red indicators on first load
- Command pending state uses `useRef` for requestId so latest-command-wins works without stale closures
- Toast replacement uses 50ms delay to reset CSS transitions for smooth animation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed StatusBar test asserting single "Connected" text when multiple indicators show it**
- **Found during:** task 2 (StatusBar test execution)
- **Issue:** Test used `getByText('Connected')` but Agent and OBS both showed "Connected"
- **Fix:** Changed to `getAllByText('Connected')` and asserted length 2
- **Files modified:** `cloud/client/src/__tests__/StatusBar.test.tsx`
- **Committed in:** `b8dc1de` (task 2 commit)

**2. [Rule 1 - Bug] Fixed Toast tests failing with fake timers blocking async toast appearance**
- **Found during:** task 2 (Toast test execution)
- **Issue:** `vi.useFakeTimers()` blocked the 50ms `setTimeout` in Toast's `showToast`, preventing toast from rendering
- **Fix:** Added `vi.advanceTimersByTime(100)` after click to let toast appear; added 300ms for exit animation
- **Files modified:** `cloud/client/src/__tests__/Toast.test.tsx`
- **Committed in:** `b8dc1de` (task 2 commit)

**3. [Rule 1 - Bug] Fixed CommandPanel tests timing out with fake timers**
- **Found during:** task 3 (CommandPanel test execution)
- **Issue:** `vi.useFakeTimers()` blocked `@testing-library/user-event`'s async click and `waitFor` from resolving
- **Fix:** Removed `vi.useFakeTimers()` from CommandPanel test — used real timers since async interactions don't need fake time
- **Files modified:** `cloud/client/src/__tests__/CommandPanel.test.tsx`
- **Committed in:** `383f976` (task 3 commit)

**4. [Rule 1 - Bug] Fixed Toast replacement test using same message text for both clicks**
- **Found during:** task 2 (Toast replacement test)
- **Issue:** Both toast calls used "First message" — couldn't distinguish old from new after replacement
- **Fix:** Changed to dynamic component with variable messages ("First message" → "Second message") to verify replacement
- **Files modified:** `cloud/client/src/__tests__/Toast.test.tsx`
- **Committed in:** `b8dc1de` (task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 - Bug fixes in test code)
**Impact on plan:** All fixes in test code only. Implementation code followed plan exactly. No scope creep.

## Issues Encountered

- TypeScript 6 (`verbatimModuleSyntax: true`) requires explicit `type` imports for type-only imports — handled in component design
- Vite 8 scaffold generates `.ts` files by default; had to rename to `.tsx` and update `index.html` mount point from `#app` to `#root`

## Next Phase Readiness

- Frontend is independently testable against cloud backend (all API calls mocked in tests)
- Login flow complete — JWT stored, protected routes guard properly
- Status bar ready for live agent connection — all three health indicators wired
- Command panel functional — camera switching and preset recall/save with ACK feedback
- Ready for integration testing with Plan 01-01 cloud backend and Plan 01-02 local agent

---

*Phase: 01-foundation*
*Plan: 03*
*Completed: 2026-05-29*
