# Roadmap: CamFlow

**Created:** 2026-05-29
**Granularity:** Standard (derived 6 phases from 38 requirements)
**Mode:** Interactive (manual approval at each gate)

## Overview

CamFlow is a two-track project — Track A (cloud web app + local agent for automated camera direction) and Track B (Python/Kivy autotracker with boundary box range limit). Phases 1-5 are sequential for Track A. Phase TB (autotracker rebuild) runs in parallel with Phases 1-3 and integrates at Phase 4.

```
  Track A:   Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
  Track B:   ════════ Phase TB (parallel) ════════╛ (integrates)
```

---

## Phases

- [ ] **Phase 1: Foundation** — Cloud backend + agent tunnel + basic hardware control with ACK protocol
- [ ] **Phase 2: Core UI + Preset Management** — Operator interface for camera control and preset configuration
- [ ] **Phase 3: Auto-Director Engine** — Worship mode preset cycling, service segments, Go Live flow
- [ ] **Phase TB: Autotracker Rebuild (Parallel)** — Two-stage AI pipeline, Kivy GUI, boundary range limit
- [ ] **Phase 4: Sermon Mode + Live Feed + Integration** — Full service flow, agent autotracker lifecycle, local camera feed
- [ ] **Phase 5: Remote Feed + Hardening** — WebRTC remote access, emergency fallback, production polish

---

## Phase Details

### Phase 1: Foundation

**Goal:** Operator can remotely switch OBS scenes and recall PTZ presets through the cloud app, with the local agent bridging cloud commands to hardware with full command acknowledgment — establishing the backbone all future features depend on.

**Depends on:** Nothing (first phase)

**Requirements:** AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AUTH-01, AUTH-02, AUTH-03, HWCTRL-01, HWCTRL-02, HWCTRL-03

**Success Criteria** (what must be TRUE when this phase completes):

1. Operator logs in with shared passphrase and receives a JWT stored in localStorage, persisting for 12 hours of browser session
2. Operator switches between Cam 1 (PTZ) and Cam 2 (Wide) OBS scenes from the cloud app; UI transitions from "pending" to "confirmed" state via agent ACK protocol
3. Operator saves the current PTZ position to a preset slot (1-8) and recalls a saved preset; UI shows pending/confirmed for each command
4. Status bar displays live agent connection health (agent, OBS, PTZ reachability) updated every 5 seconds via heartbeat
5. Agent automatically reconnects WebSocket tunnel after disconnect with exponential backoff (max 30s interval); commands queued during outage >15s old are rejected as stale on reconnect

**Key constants:**
- PTZ settle time: 2.5s default (implemented per-preset in Phase 2)
- Command timeout: 5s PTZ, 2s OBS
- Heartbeat interval: 5s
- Tunnel stale threshold: 15s
- JWT expiry: 12 hours

**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Cloud Backend (auth, DB, WebSocket server, REST command endpoints)
- [ ] 01-02-PLAN.md — Local Agent (WebSocket tunnel, OBS/PTZ control, ACK protocol, Windows service)
- [ ] 01-03-PLAN.md — Frontend Core (login, status bar, camera switcher, PTZ preset panel, ACK feedback UX)

---

### Phase 2: Core UI + Preset Management

**Goal:** Operator has a polished, responsive interface for manual camera control and preset configuration — positioning cameras, managing 8 preset slots, and controlling which presets participate in the weekly worship cycle.

**Depends on:** Phase 1 (agent tunnel must relay commands; presets stored in SQLite)

**Requirements:** HWCTRL-04, HWCTRL-05, HWCTRL-06, PRESET-01, PRESET-02, PRESET-03, PRESET-04

**Success Criteria** (what must be TRUE when this phase completes):

1. Operator controls PTZ pan, tilt, and zoom using joystick-style D-pad controls with selectable speed (slow/medium/fast) from the web app
2. Operator configures 8 preset slots: assigns names, maps to PTZ preset numbers (1-8), toggles active/inactive, and drags to reorder cycle sequence
3. Operator sets a custom settle time per preset (default 2.5s) — the preset data model includes this field for Phase 3 to consume
4. Operator switches between Cam 1 (PTZ) and Cam 2 (Wide) using large labeled buttons with the active camera prominently highlighted
5. Presets configured in Setup screen are immediately available for recall in the Live view — configuration persists across browser sessions and cloud redeploys (SQLite on Railway volume mount)

**Plans:** TBD

---

### Phase 3: Auto-Director Engine + Service Segments

**Goal:** Operator selects a service segment and the cloud-hosted auto-director state machine automates camera direction — cycling active presets on configurable timer with periodic wide shots during worship, with manual override always one tap away.

**Depends on:** Phase 2 (presets must exist with settle times before director can cycle them)

**Requirements:** SEG-01, SEG-02, SEG-04, SEG-05, SEG-06

**Success Criteria** (what must be TRUE when this phase completes):

1. Operator selects Worship segment; system cycles through active presets in configured order, switching OBS to each preset after its settle delay, with periodic cuts to Cam 2 wide shot
2. Operator taps any preset or camera button to immediately pause automation; a resume button restarts cycling from the tapped position
3. Operator presses Go Live (confirmation gate: agent and OBS must be confirmed connected) to arm the system before service starts
4. All events — segment changes, preset recalls, camera switches, and manual overrides — are timestamped in a service log visible in the UI
5. State machine survives frontend page reloads and operator logout (cloud-hosted, session-decoupled); switching to Idle segment immediately stops all automation

**Pitfall prevention built in:**
- Timer advances only after agent ACK confirms preset settled (never wall-clock alone)
- Segment transitions require confirmation tap (except Idle panic button)
- Next preset name + countdown visible to operator before each cut
- Per-preset settle delays used from Phase 2 data model

**Plans:** TBD

---

### Phase TB: Autotracker Rebuild (Parallel Track — runs concurrently with Phases 1-3)

**Goal:** Standalone Python/Kivy autotracker with GPU-accelerated two-stage AI pipeline (YOLOv8 head detection → 19-point nose pose tracking via ONNX Runtime DirectML), NDI camera control, and boundary box range limit — usable independently of the cloud app.

**Depends on:** Nothing (zero runtime dependencies on Track A). Requires Python 3.12, ONNX Runtime DirectML 1.24.4, Kivy 2.3.1, OpenCV 4.13, NDI SDK.

**Requirements:** TRACK-01, TRACK-02, TRACK-03, TRACK-04, TRACK-05, TRACK-06

**Success Criteria** (what must be TRUE when this phase completes):

1. Autotracker detects heads in the NDI video feed using YOLOv8 ONNX model, then estimates 19-point nose pose on the selected target — both stages GPU-accelerated via ONNX Runtime DirectML with ≥0.65 confidence threshold and 3-frame temporal stability before engaging a new target
2. Operator clicks on a detected face in the Kivy GUI to begin tracking; tracking never auto-selects a target (no "grab highest confidence face" behavior)
3. When the tracked person's nose position exits the configurable boundary box (normalized frame coordinates), camera smoothly zooms out to full wide view over ~2 seconds instead of continuing to chase
4. Autotracker sends pan, tilt, and zoom commands to BirdDog camera via NDI protocol with correct float-range values and low-latency response
5. Kivy GUI renders live video feed with head bounding box overlays, nose tracking point, center crosshair, speed slider, pan/tilt/zoom axis lock toggles, and status bar — all functional and response

**Key anti-pitfall measures:**
- Confidence threshold: 0.65 (not 0.5)
- Temporal stability: 3 consecutive confident frames required
- Head size sanity: reject detections >40% frame width
- False positive rate: zero on empty-stage test

**Plans:** TBD

---

### Phase 4: Sermon Mode + Live Feed + Integration

**Goal:** Both tracks merge — complete four-segment service flow works end-to-end. Sermon mode activates the autotracker for pulpit face tracking with manual B-roll override. Local live camera feed assists preset framing during setup.

**Depends on:** Phase 3 (segment switching infrastructure, OBS scene transitions, auto-director pause/resume must work) AND Phase TB (autotracker must be compiled, tested, and ready for subprocess integration)

**Requirements:** SEG-03, AGENT-07, FEED-01, FEED-02, FEED-03, FEED-04, FEED-06

**Success Criteria** (what must be TRUE when this phase completes):

1. Operator switches to Sermon segment; agent spawns autotracker subprocess; face tracking activates on pulpit; one-tap Cam 2 B-roll button overrides to wide shot
2. Agent gracefully spawns and kills autotracker subprocess based on segment transitions (Worship→Sermon spawns, Sermon→Last Worship kills) with health monitoring
3. PTZ RTSP stream is served as local MJPEG feed via hardware-accelerated FFmpeg (640×360, 5 FPS, auto-paused by default, auto-pause after 60s inactivity)
4. Live feed panel displays expanded in Setup screen for preset framing, collapsed (expandable) in Live view during service
5. Operator can pause and resume feed without affecting camera control; feed health status appears in status bar and agent heartbeat
6. Complete four-segment service flow works end-to-end: Go Live → Worship auto-cycle → Sermon face tracking → Last Worship auto-cycle → Idle stop

**Resource protection built in:**
- FFmpeg: `-hwaccel d3d11va`, 640×360, 5 FPS
- Feed auto-paused by default; manual unpause only
- CPU monitoring at 80% threshold auto-throttles feed
- Autotracker subprocess: SIGTERM → 5s grace → SIGKILL

**Plans:** TBD

---

### Phase 5: Remote Feed + Hardening

**Goal:** Operator can access the live camera feed and emergency controls from any network. System degrades gracefully and recovers cleanly from partial failures.

**Depends on:** Phase 4 (local feed FFmpeg pipeline is prerequisite for WebRTC signaling; all four segments must work before hardening)

**Requirements:** FEED-05

**Success Criteria** (what must be TRUE when this phase completes):

1. Operator connects to live camera feed from remote network via WebRTC peer-to-peer with cloud signaling relay; feed quality degrades gracefully on poor connections without impacting streaming PC performance
2. Operator can issue emergency Pause and Stop commands via local HTTP fallback server on the agent when the cloud WebSocket tunnel is down — phone on same WiFi accesses minimal control page
3. Login overlay (not page redirect) allows re-authentication mid-service without losing live view state
4. System recovers cleanly from tunnel outages during active service: state machine pauses on disconnect, resumes from correct state on reconnect, no stale commands replayed

**Deep pitfall resolution:**
- Pitfall 1 (tunnel SPOF): Local HTTP fallback eliminates complete loss of control
- Pitfall 4 (JWT logout): Login overlay replaces redirect; state machine session-decoupled from Phase 3
- PWA add-to-home-screen for app-like mobile experience

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Not started | - |
| 2. Core UI + Presets | 0/4 | Not started | - |
| 3. Auto-Director Engine | 0/3 | Not started | - |
| TB. Autotracker Rebuild | 0/4 | Not started (parallel) | - |
| 4. Sermon + Feed + Integration | 0/4 | Not started | - |
| 5. Remote Feed + Hardening | 0/2 | Not started | - |

---

## Dependency Graph

```
Phase 1 (Foundation)
    ↓
Phase 2 (Core UI + Preset Management)
    ↓
Phase 3 (Auto-Director Engine)    ───→ Phase 4 (Integration) ───→ Phase 5 (Remote + Hardening)
                                        ↗
Phase TB (Autotracker Rebuild) ────────┘
    ════════ parallel with Phases 1-3 ════════
```

### Critical Path (Longest Sequential Chain)

```
Phase 1 (foundation) → Phase 2 (UI) → Phase 3 (director) → Phase 4 (integration) → Phase 5 (hardening)
```

Phase TB runs in parallel (15-20 days), not on critical path.

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGENT-01 | Phase 1 | Pending |
| AGENT-02 | Phase 1 | Pending |
| AGENT-03 | Phase 1 | Pending |
| AGENT-04 | Phase 1 | Pending |
| AGENT-05 | Phase 1 | Pending |
| AGENT-06 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| HWCTRL-01 | Phase 1 | Pending |
| HWCTRL-02 | Phase 1 | Pending |
| HWCTRL-03 | Phase 1 | Pending |
| HWCTRL-04 | Phase 2 | Pending |
| HWCTRL-05 | Phase 2 | Pending |
| HWCTRL-06 | Phase 2 | Pending |
| PRESET-01 | Phase 2 | Pending |
| PRESET-02 | Phase 2 | Pending |
| PRESET-03 | Phase 2 | Pending |
| PRESET-04 | Phase 2 | Pending |
| SEG-01 | Phase 3 | Pending |
| SEG-02 | Phase 3 | Pending |
| SEG-04 | Phase 3 | Pending |
| SEG-05 | Phase 3 | Pending |
| SEG-06 | Phase 3 | Pending |
| TRACK-01 | Phase TB | Pending |
| TRACK-02 | Phase TB | Pending |
| TRACK-03 | Phase TB | Pending |
| TRACK-04 | Phase TB | Pending |
| TRACK-05 | Phase TB | Pending |
| TRACK-06 | Phase TB | Pending |
| SEG-03 | Phase 4 | Pending |
| AGENT-07 | Phase 4 | Pending |
| FEED-01 | Phase 4 | Pending |
| FEED-02 | Phase 4 | Pending |
| FEED-03 | Phase 4 | Pending |
| FEED-04 | Phase 4 | Pending |
| FEED-06 | Phase 4 | Pending |
| FEED-05 | Phase 5 | Pending |

**Coverage:** 38/38 requirements mapped ✓

---

## Research Flags

Phases likely needing deeper research during planning (`/gsd-research-phase`):

- **Phase 3 (Auto-Director State Machine):** Live production automation state machine has edge cases: 0 active presets, 1 active preset, deactivating current preset mid-cycle, mode transitions while preset in transit, manual override resume after long pause. Needs formal state transition diagram.
- **Phase TB (Autotracker Rebuild):** ONNX Runtime DirectML 1.24.4 API on Windows, Kivy 2.3.1 video texture integration with NDI frames, Python NDI SDK bindings availability (NDIlib.pyd), GPU inference performance on actual streaming PC. Source code lost — must rebuild from ARCHITECTURE.md spec.
- **Phase 5 (WebRTC Remote Feed):** STUN/TURN server requirements for NAT traversal, signaling protocol between agent and cloud, browser WebRTC API with MJPEG fallback.

---

*Roadmap created: 2026-05-29*
*Ready for planning: `/gsd-plan-phase 1`*
