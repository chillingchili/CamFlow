---
phase: 02-core-ui-preset-management
verified: 2026-05-29T23:00:00Z
status: gaps_found
score: 4/5 must-haves verified
re_verification: false
gaps:
  - truth: "Operator can reorder presets by dragging to change the auto-director cycle sequence (PRESET-03)"
    status: failed
    reason: "Frontend api.ts wraps reorder payload in { order: [...] } but backend presets.ts expects raw array directly from req.body. Backend returns 400 'Request body must be an array'. Drag-to-reorder UI works locally but never persists."
    artifacts:
      - path: "cloud/client/src/services/api.ts"
        issue: "Line 101: body: JSON.stringify({ order }) — wraps the array in an object. Should be body: JSON.stringify(order) (no wrapping)."
      - path: "cloud/server/src/routes/presets.ts"
        issue: "Line 118: const reorderData = req.body — expects raw array. Could alternatively unwrap: const reorderData = req.body.order || req.body."
    missing:
      - "Fix the body serialization in api.ts reorderPresets to send the array directly (not wrapped in { order })"
      - "OR fix the backend to unwrap req.body.order"
  - truth: "Operator configures 8 preset slots including sort order (PRESET-01 sort_order field)"
    status: partial
    reason: "Sort order exists in data model and can be set via PUT, but the drag-to-reorder UI (the primary mechanism to manage sort order) is broken due to the same API wiring gap affecting PRESET-03."
    artifacts:
      - path: "cloud/client/src/services/api.ts"
        issue: "Same reorder body format mismatch"
    missing:
      - "Same fix as PRESET-03 above"
---

# Phase 2: Core UI + Preset Management Verification Report

**Phase Goal:** Operator has a polished, responsive interface for manual camera control and preset configuration — positioning cameras, managing 8 preset slots, and controlling which presets participate in the weekly worship cycle.

**Verified:** 2026-05-29
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator controls PTZ pan, tilt, and zoom using joystick-style D-pad controls with selectable speed | ✓ VERIFIED | Joystick.tsx — cross D-pad layout (▲▼◀▶), zoom buttons (±), press-and-hold → move / release → stop, independent pan/zoom speed sliders 1-100, keyboard shortcuts WASD/RT/FG/VB. Backend: POST /api/ptz/move, /api/ptz/zoom, /api/ptz/stop relay commands via WebSocket tunnel to agent. Agent: router dispatches ptz_move/ptz_zoom/ptz_stop with ACK protocol. |
| 2 | Operator configures 8 preset slots: assigns names, maps to PTZ preset numbers (1-8), toggles active/inactive, and drags to reorder cycle sequence | ⚠️ PARTIAL | PresetGrid.tsx — 8 vertical cards with inline name editing, PTZ number badge, iOS-style toggle, drag grip handle. Backend: GET/PUT/PATCH endpoints with validation. **GAP:** Drag-to-reorder calls PATCH /api/presets/reorder but body format mismatch causes 400 — reorder does not persist. |
| 3 | Operator sets a custom settle time per preset (default 2.5s) — preset data model includes this field | ✓ VERIFIED | PresetGrid.tsx — number input per card with `role="spinbutton"`, blur saves via PUT. Backend: PUT /api/presets/:id validates `settle_time > 0`. Database schema includes settle_time column. Seed data defaults to 2.5s. |
| 4 | Operator switches between Cam 1 (PTZ) and Cam 2 (Wide) using large labeled buttons with the active camera prominently highlighted | ✓ VERIFIED | CameraSwitcher.tsx — large buttons labeled "Cam 1 PTZ" and "Cam 2 Wide". Active camera: green bg + shadow. Pending state: blue ring animation + "Switching..." text. Wired through useCommandState ACK pipeline. |
| 5 | Presets configured in Setup screen are immediately available for recall in the Live view — configuration persists across browser sessions and cloud redeploys (SQLite on Railway volume mount) | ✓ VERIFIED | Both Setup and Live pages share same PresetGrid component and backend data via GET /api/presets. SQLite persistence via better-sqlite3 with volume mount. JWT auth persists across sessions (12h). |

**Score:** 4/5 truths fully verified (1 partial due to reorder wiring gap)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cloud/server/src/routes/presets.ts` | Preset CRUD API: GET all, PUT update, PATCH reorder | ✓ VERIFIED | 163 lines, full implementation with input validation, transaction for reorder, dynamic partial updates |
| `cloud/server/src/routes/ptz-move.ts` | PTZ movement API: POST move/zoom/stop | ✓ VERIFIED | 124 lines, direction/speed validation, agent relay with requestId, 503 when agent disconnected |
| `cloud/server/src/__tests__/presets.test.ts` | 18 preset API tests | ✓ VERIFIED | Auth, CRUD, validation, reorder — all substantive |
| `cloud/server/src/__tests__/ptz-move.test.ts` | 17 PTZ movement API tests | ✓ VERIFIED | Auth, direction/speed validation, agent relay, 503 tests |
| `cloud/server/src/index.ts` | Wired /api/presets and /api/ptz routes | ✓ VERIFIED | Lines 29-33, routes mounted with JWT middleware |
| `cloud/client/src/components/TabBar.tsx` | Tab navigation with Setup/Live + gear icon | ✓ VERIFIED | ARIA role="tab", active state highlighting, gear icon for settings |
| `cloud/client/src/components/CameraSwitcher.tsx` | Camera switch buttons with ACK feedback | ✓ VERIFIED | Large buttons, active green highlight, pending ring animation, useCommandState integration |
| `cloud/client/src/components/SettingsPanel.tsx` | Settings slide-out panel | ✓ VERIFIED | System info section, Escape/backdrop close, role="dialog" |
| `cloud/client/src/components/PresetGrid.tsx` | 8-slot preset grid with inline edit, drag reorder, toggle, settle time | ✓ VERIFIED | 276 lines, HTML5 drag-and-drop, optimistic updates, ACK feedback |
| `cloud/client/src/components/Joystick.tsx` | Cross D-pad joystick with keyboard shortcuts | ✓ VERIFIED | 293 lines, Pointer Events press-and-hold, dual speed sliders, key hints on buttons |
| `cloud/client/src/pages/Setup.tsx` | Setup page: PresetGrid + Joystick | ✓ VERIFIED | Both components mounted |
| `cloud/client/src/pages/Live.tsx` | Live page: CameraSwitcher + collapsible Joystick | ✓ VERIFIED | CameraSwitcher prominent, Joystick in `<details>` (collapsed by default) |
| `cloud/client/src/hooks/useKeyboard.ts` | Global keyboard shortcut handler | ✓ VERIFIED | 74 lines, skips input elements, keyDown/keyUp maps, cleanup on unmount |
| `cloud/client/src/services/api.ts` | API client functions for presets + PTZ | ✓ VERIFIED | 132 lines, getPresets/updatePreset/reorderPresets/ptzMove/ptzZoom/ptzStop — all with JWT auth |
| `cloud/client/src/App.tsx` | App routing with TabBar integration | ✓ VERIFIED | TabBar + SettingsPanel + Setup/Live routing, Setup default |
| `cloud/client/src/components/Dashboard.tsx` | Dashboard wrapper with StatusBar | ✓ VERIFIED | StatusBar always visible, ToastProvider, WebSocket integration |
| `cloud/client/src/hooks/useCommandState.ts` | ACK command state management | ✓ VERIFIED | Latest-command-wins, scene/preset status tracking |
| `agent/src/ptz.js` | PTZ module: move(), zoom(), stop() | ✓ VERIFIED | 147 lines, direction validation, speed 1-100, 5s timeout, BirdDog REST API |
| `agent/src/router.js` | Agent router: ptz_move, ptz_zoom, ptz_stop dispatch | ✓ VERIFIED | 117 lines, direction/speed validation, ACK protocol, 5s timeout |
| `agent/src/__tests__/ptz.test.js` | 22 PTZ module tests (6 existing + 16 new) | ✓ VERIFIED | move/zoom/stop directions, speed validation, error handling |
| `agent/src/__tests__/router.test.js` | 22 router tests (9 existing + 13 new) | ✓ VERIFIED | ptz_move/ptz_zoom/ptz_stop dispatch, ACK ok/error, timeout validation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Joystick.tsx` | `api.ts` (ptzMove, ptzZoom, ptzStop) | `api.ptzMove(direction, speed)` | ✓ WIRED | Lines 118, 130, 142 |
| `Joystick.tsx` | `api/ptz/move` | `fetch('/api/ptz/move', ...)` in api.ts | ✓ WIRED | Line 109 — POST with direction + speed, JWT header |
| `api/ptz/move` | Agent router | `sendToAgent(requestId, command)` via WebSocket tunnel | ✓ WIRED | ptz-move.ts line 45 — queueCommand uses existing relay |
| Agent router | `ptz.move()` | `case 'ptz_move'` dispatches to `move()` | ✓ WIRED | router.js line 75 — call move() with validated direction/speed |
| `ptz.move()` | BirdDog REST API | `ptzRequest('/v1/ptz/move', ...)` | ✓ WIRED | ptz.js line 99 — POST to camera with 5s timeout |
| `PresetGrid.tsx` | `api.ts` (getPresets, updatePreset, reorderPresets) | `api.getPresets()` on mount, `api.updatePreset()` on edit | ✓ WIRED | Lines 171, 199 |
| `PresetGrid.tsx` | `api/presets/reorder` | `api.reorderPresets(orderPayload)` on drop | ✗ FORMAT MISMATCH | api.ts line 101 sends `{ order }` but backend expects raw array. Returns 400. |
| `PresetGrid.tsx` | `api/presets/:id` | `api.updatePreset(id, data)` on save | ✓ WIRED | PUT with partial updates |
| `TabBar.tsx` | `Setup.tsx` / `Live.tsx` | `activeTab` state in App.tsx | ✓ WIRED | App.tsx line 30 — conditional render |
| `CameraSwitcher.tsx` | `useCommandState` | `switchScene(sceneName)` | ✓ WIRED | Line 40 — imported and used |
| Agent router `ptz_move` → | `ack` response | `sendAck({type:'ack', requestId, status:'ok'})` | ✓ WIRED | router.js line 78 |
| `SettingsPanel.tsx` | App.tsx | `onSettingsOpen` prop from TabBar | ✓ WIRED | App.tsx lines 27-29 |
| `useKeyboard.ts` | `Joystick.tsx` | `useKeyboard(keyDownMap, keyUpMap)` | ✓ WIRED | Joystick.tsx line 172 |
| `Setup.tsx` | `PresetGrid.tsx` + `Joystick.tsx` | Import and mount both components | ✓ WIRED | Lines 1-2, used in JSX |
| `Live.tsx` | `CameraSwitcher.tsx` + `Joystick.tsx` | Import and mount both components | ✓ WIRED | Lines 1-2, Joystick in `<details>` (collapsible) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| HWCTRL-04 | 02-01, 02-02, 02-03 | Operator can manually pan, tilt, and zoom the PTZ camera using joystick-style D-pad controls in the web app | ✓ SATISFIED | Joystick.tsx cross D-pad + zoom buttons + POST /api/ptz/move,zoom,stop endpoints + agent router dispatch for ptz_move/ptz_zoom/ptz_stop. Press-and-hold sends move, release sends stop. |
| HWCTRL-05 | 02-01, 02-02, 02-03 | Operator can adjust PTZ movement speed (slow/medium/fast) during manual control | ✓ SATISFIED | Joystick.tsx — independent pan speed slider 1-100 and zoom speed slider 1-100. Keyboard F/G (±1 pan speed), V/B (±1 zoom speed). Speed value sent with each move/zoom command. |
| HWCTRL-06 | 02-02 | Operator can switch between Cam 1 (PTZ) and Cam 2 (Wide) using clearly labeled buttons, with the active camera highlighted | ✓ SATISFIED | CameraSwitcher.tsx — large buttons "Cam 1 PTZ" and "Cam 2 Wide". Active: green bg + shadow. Pending: blue ring + "Switching..." text. ACK feedback via useCommandState. **Note:** REQUIREMENTS.md traceability still shows "Pending" — ROADMAP.md correctly shows "Complete". |
| PRESET-01 | 02-01, 02-02 | Operator can configure 8 preset slots, each with a name, PTZ preset number (1-8), active toggle, and sort order | ⚠️ PARTIAL | PresetGrid.tsx — 8 cards with name, PTZ number badge, toggle, sort order in data model. Inline name editing, toggle works. **Sort order management broken:** drag-to-reorder API call has body format mismatch (see gap). |
| PRESET-02 | 02-01, 02-02 | Operator can toggle a preset active/inactive to include/exclude from auto-director cycle without deleting configuration | ✓ SATISFIED | PresetCard.tsx — toggle switch (`role="checkbox"`), calls `api.updatePreset(id, { active: !preset.active })`. Backend validates active is 0 or 1. Inactive presets rendered with reduced opacity. |
| PRESET-03 | 02-01, 02-02 | Operator can reorder presets by dragging to change the auto-director cycle sequence | ✗ FAILED | PresetGrid.tsx — HTML5 drag-and-drop UI with grip handle, optimistic local reorder. **API call broken:** `api.reorderPresets()` sends `{ order: [...] }` but backend `presets.ts` expects raw `[...]`. Backend returns 400. Reorder does not persist. |
| PRESET-04 | 02-01, 02-02 | Each preset has a configurable settle time (delay after recall before cutting to it, default 2.5 seconds) | ✓ SATISFIED | PresetCard.tsx — number input (`role="spinbutton"`), blur calls `api.updatePreset(id, { settle_time: num })`. Backend validates settle_time > 0. Seed data defaults to 2.5s. |

### Anti-Patterns Found

No anti-patterns detected. All files are free of TODO/FIXME/PLACEHOLDER comments, stubs, `return null`, `return {}`, or `console.log`-only implementations.

### Human Verification Required

#### 1. Drag-and-Drop Visual Feel
**Test:** Drag a preset card using the grip handle in the Setup screen, drop it in a new position.
**Expected:** Cards should smoothly reorder with an animated shift. After drop, the new order should persist (after the wiring gap is fixed).
**Why human:** Drag animation smoothness, visual feedback, and touch interaction quality can't be verified programmatically.

#### 2. Joystick Press-and-Hold Responsiveness
**Test:** Press and hold the Up button on the D-pad for 2 seconds, then release.
**Expected:** Hold should feel responsive (no perceptible delay). Camera should start moving on press and stop on release. Keyboard WASD should feel equivalent.
**Why human:** Latency of WebSocket relay through cloud → agent → camera can't be tested in unit tests. Real end-to-end timing matters.

#### 3. Keyboard Shortcut Integration
**Test:** Open Setup page, click into a preset name input (editing mode), press W/A/S/D keys.
**Expected:** WASD keys should NOT trigger camera movement while focused in an input. After blurring the input, WASD should work again.
**Why human:** Focus management and keyboard event priority require real browser interaction.

#### 4. Tab Navigation + ACK State Preservation
**Test:** Switch scene in Live tab, then switch to Setup tab, then back to Live.
**Expected:** CameraSwitcher should still show the correct active camera (ACK state preserved across tab switches).
**Why human:** React component mount/unmount behavior across tab switches with WebSocket state.

#### 5. Settings Panel Escape/Backdrop Behavior
**Test:** Open settings panel via gear icon, press Escape, click the backdrop area.
**Expected:** Both should close the panel. Reopening should work again.
**Why human:** Portal/overlay stacking and event propagation in real browser context.

### Gaps Summary

**1 critical wiring gap found:**

The `reorderPresets` function in `cloud/client/src/services/api.ts` (line 101) wraps the reorder array in an object: `body: JSON.stringify({ order })`. However, the backend `presets.ts` (line 118) reads `req.body` directly and expects a raw array: `Array.isArray(reorderData)`.

When a user drags to reorder presets:
1. Frontend sends: `POST /api/presets/reorder` with body `{ "order": [{id:1,sort_order:5}, ...] }`
2. Express parses this as: `req.body = { order: [...] }`
3. Backend checks `Array.isArray(req.body)` → **false** (it's an object)
4. Backend returns `400 { error: "Request body must be an array of {id, sort_order} objects" }`
5. Frontend catches the error and reverts to original order with a toast "Failed to reorder presets"

This affects:
- **PRESET-03** (reorder by dragging) — fully broken
- **PRESET-01** (sort_order field) — sort_order exists in DB and PUT works, but the primary UI for managing order is broken

Both frontend and backend test suites pass because:
- Frontend tests mock `api.reorderPresets` — they never test the actual body format
- Backend tests send the raw array via supertest directly — they don't test through the frontend API client

**Fix options (either works):**
- **Frontend fix:** Change `body: JSON.stringify({ order })` to `body: JSON.stringify(order)` in api.ts line 101
- **Backend fix:** Change `const reorderData = req.body` to `const reorderData = req.body.order || req.body` in presets.ts line 118

**Additional note:** REQUIREMENTS.md traceability table shows HWCTRL-06 as "Pending" but it's fully implemented. ROADMAP.md correctly shows "Complete". This is a documentation discrepancy only — no code gap.

---

_Verified: 2026-05-29T23:00:00Z_
_Verifier: OpenCode (gsd-verifier)_
