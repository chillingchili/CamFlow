# Phase 2: Core UI + Preset Management - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

PTZ joystick controls (D-pad with pan/tilt/zoom + speed slider), 8-slot preset grid with name/active/reorder/settle-time, camera switcher polish, and a two-tab navigation structure (Setup | Live). Extends the Phase 1 ACK feedback pattern to all interactions.
</domain>

<decisions>
## Implementation Decisions

### Setup vs Live layout
- Top tab bar: Live | Setup — simple, tablet-friendly, always visible
- Setup is the default tab after login (pre-service configuration first)
- Status bar persists across both tabs — only content area changes
- Setup tab always accessible during live service (no locking)

### Preset grid design
- Vertical list of cards (8 rows), each showing: name, PTZ number, active toggle, settle time, drag handle
- Inline editing: click name to edit in place, toggles/sliders directly on the card
- Active/inactive toggle: iOS-style toggle switch on each card
- Drag reorder: grip icon handle on the right side of each card, tap-and-hold to drag with animated shift
- Per-preset settle time: numeric input or small slider within the card (default 2.5s)
- Preset grid appears in Setup tab (separate panel from joystick)

### PTZ joystick design
- Cross D-pad layout (Up/Down/Left/Right in a cross pattern)
- Press and hold to move continuously, release to stop — feels like physical joystick
- Zoom In/Out buttons to the right of the D-pad (side-by-side layout)
- Speed slider: 1-100 range (actual PTZ speed value), beneath the D-pad
- Joystick available in both tabs: prominent in Setup, collapsible panel in Live
- Camera switcher (Cam 1 PTZ / Cam 2 Wide): large buttons always visible in Live tab

### Keyboard keybinds
- D-pad pan/tilt: WASD keys
- Zoom: R (out), T (in)
- D-pad speed: F (less), G (more)
- Zoom speed: V (less), B (more)
- All keybinds active as alternates to mouse/touch controls

### Navigation structure
- Top tab bar: Live | Setup
- Settings gear icon alongside the tabs — opens a settings panel
- Settings panel contains: timing config placeholders, system info
- No separate settings page/route needed in Phase 2

### OpenCode's Discretion
- Exact card dimensions, spacing, and typography
- Drag animation smoothness and timing
- D-pad exact pixel layout and sizing
- Keybind visual hints (tooltips or indicators on buttons)
- Settings panel contents beyond presets scope
- Settle time input widget choice (slider vs number input)
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useCommandState` hook — ACK-based command pipeline (scene switch, preset recall/save). Extend for PTZ movement commands
- `useWebSocket` hook — real-time status updates from agent
- `StatusBar` component — fixed top bar with 3 health indicators
- `Toast` component — 5s toast notifications
- `CommandPanel` — current bare-bones camera switcher + preset grid. Refactor into separate components for Phase 2
- `Dashboard` wrapper component — extend with tab bar
- `api.ts` — REST API client. Add endpoints for PTZ movement and preset CRUD

### Established Patterns
- ACK feedback: optimistic UI → solid on ACK → red flash + revert + toast on NACK
- Latest-command-wins for concurrent commands
- PTZ commands route through cloud → WebSocket tunnel → agent → NDI
- Presets stored in SQLite (schema already has name, ptz_number, active, sort_order, settle_time columns)
- Tailwind CSS 4 for styling, React 19 + Vite 8

### Integration Points
- PTZ joystick commands need new API endpoints: POST /api/ptz/move, POST /api/ptz/zoom, POST /api/ptz/stop
- Preset CRUD needs API endpoints: GET /api/presets, PUT /api/presets/:id, PATCH /api/presets/reorder
- Agent needs new router commands: ptz_move, ptz_zoom, ptz_stop
- Preset reorder persists to sort_order column in SQLite
</code_context>

<specifics>
## Specific Ideas

- Operator should be able to position the camera with the joystick, save the position as a preset, and configure the preset's name/active/order — all from the same Setup screen without switching tabs
- Keyboard shortcuts make setup significantly faster for a desktop user — the keybinds should feel like a game controller layout
- The 1-100 speed slider should feel like the actual PTZ camera controller, not a simplified slow/medium/fast toggle
</specifics>

<deferred>
## Deferred Ideas

- Timing configuration panel (dwell time, wide duration, cut frequency) — v2 scope
- Full service segment selector — Phase 3
</deferred>

---
*Phase: 02-core-ui-preset-management*
*Context gathered: 2026-05-29*
