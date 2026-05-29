# Requirements: CamFlow

**Defined:** 2026-05-29
**Core Value:** Hands-off automated camera direction during church live streams

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Hardware Control

- [x] **HWCTRL-01**: Operator can switch OBS scenes via the cloud app, with the command relayed through the local agent's WebSocket tunnel
- [x] **HWCTRL-02**: Operator can recall a saved PTZ preset (1-8), sending the NDI preset recall command through the local agent
- [x] **HWCTRL-03**: Operator can save the current PTZ position as a preset (1-8), sending the NDI preset save command through the local agent
- [x] **HWCTRL-04**: Operator can manually pan, tilt, and zoom the PTZ camera using joystick-style D-pad controls in the web app
- [x] **HWCTRL-05**: Operator can adjust PTZ movement speed (slow/medium/fast) during manual control
- [ ] **HWCTRL-06**: Operator can switch between Cam 1 (PTZ) and Cam 2 (Wide) using clearly labeled buttons, with the active camera highlighted

### Service Flow

- [ ] **SEG-01**: Operator can select an active segment (Worship, Sermon, Last Worship, Idle) from a prominent segment selector
- [ ] **SEG-02**: Switching to Worship segment triggers auto-director mode: PTZ cycles through active presets on configurable timer with periodic cuts to Cam 2 wide shot
- [ ] **SEG-03**: Switching to Sermon segment activates AutoPTZ face tracking on the pulpit preset, with a tappable Cam 2 B-roll button
- [ ] **SEG-04**: Auto-director cycling can be paused with a manual preset tap; a resume button restarts automation from the tapped preset
- [ ] **SEG-05**: Operator can press Go Live to arm the system, confirming local agent and OBS are connected before the service starts
- [ ] **SEG-06**: Service events (segment changes, preset recalls, camera switches, manual overrides) are logged with timestamp

### Preset Management

- [ ] **PRESET-01**: Operator can configure 8 preset slots, each with a name, PTZ preset number (1-8), active toggle, and sort order
- [ ] **PRESET-02**: Operator can toggle a preset active/inactive to include or exclude it from this week's auto-director cycle without deleting the configuration
- [ ] **PRESET-03**: Operator can reorder presets by dragging to change the auto-director cycle sequence
- [ ] **PRESET-04**: Each preset has a configurable settle time (delay after recall before cutting to it, default 2.5 seconds per research recommendation)

### Timing Configuration

(None in v1 — deferred to v2)

### Authentication

- [x] **AUTH-01**: Operator can log in with a shared passphrase via a simple login screen
- [x] **AUTH-02**: Login returns a JWT session token stored in browser localStorage, expiring after 12 hours
- [x] **AUTH-03**: Passphrase is stored securely using bcrypt hashing in the database

### Live Camera Feed

- [ ] **FEED-01**: Local agent serves the PTZ RTSP stream as a low-latency MJPEG or HLS feed over the local network via FFmpeg subprocess
- [ ] **FEED-02**: Live feed panel is prominent and expanded by default in the Setup screen for framing while saving presets
- [ ] **FEED-03**: Live feed panel is available as a collapsible panel (collapsed by default) in the Live view screen during service
- [ ] **FEED-04**: Operator can pause and resume the live feed at any time to reduce CPU load on the streaming PC
- [ ] **FEED-05**: Operator can access the live feed remotely from any network via WebRTC relay through the cloud backend
- [ ] **FEED-06**: Feed health status (available/unavailable/paused) is reported in the status bar and included in the agent's health ping every 5 seconds

### Autotracker

- [ ] **TRACK-01**: Autotracker runs a two-stage AI pipeline: YOLOv8 head detection followed by 19-point nose pose keypoint detection, both GPU-accelerated via ONNX Runtime + DirectML
- [ ] **TRACK-02**: Operator clicks on a detected face to begin tracking; tracking does not start automatically on first detection
- [ ] **TRACK-03**: When the tracked person's nose position exits a configurable boundary box in normalized frame coordinates, the camera smoothly zooms out to a full wide view instead of continuing to track
- [ ] **TRACK-04**: Autotracker sends pan, tilt, and zoom commands to the BirdDog camera via NDI protocol
- [ ] **TRACK-05**: Autotracker displays a Kivy GUI window with live video feed, head bounding box overlay, nose tracking point, center crosshair, speed slider, axis lock toggles, and status bar
- [ ] **TRACK-06**: Autotracker reads configuration from default_config.json (camera name, speed multiplier, axis locks)

### Local Agent

- [x] **AGENT-01**: Local agent runs as a Windows service via node-windows, starting automatically on boot without requiring user login
- [x] **AGENT-02**: Local agent maintains a persistent outbound WebSocket tunnel to the cloud backend, with automatic reconnection using exponential backoff (max 30s interval)
- [x] **AGENT-03**: Every cloud-to-hardware command includes a requestId; the agent acknowledges success or failure so the UI accurately reflects hardware state
- [x] **AGENT-04**: Agent reports health status every 5 seconds via the WebSocket tunnel: agent connection, OBS connection, PTZ camera reachability, autotracker status, and live feed status
- [x] **AGENT-05**: Agent controls OBS scenes via obs-websocket-js (WebSocket v5 protocol)
- [x] **AGENT-06**: Agent controls the BirdDog PTZ camera via NDI PTZ commands (preset recall, pan, tilt, zoom)
- [ ] **AGENT-07**: Agent can spawn and gracefully kill the Python autotracker subprocess when entering or leaving Sermon mode

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Timing Configuration

- **TIMING-01**: Operator can configure PTZ dwell time per preset (seconds)
- **TIMING-02**: Operator can configure Cam 2 wide shot duration (seconds)
- **TIMING-03**: Operator can configure how often to cut to Cam 2 wide (every N presets)
- **TIMING-04**: Operator can configure global transition delay after preset recall

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user / role-based access | Single operator handles all tasks; complexity not justified |
| Audio-triggered automatic switching | High complexity; not needed when operator sets segment manually |
| AI director decisions | Deterministic preset cycling covers worship; operator chooses when to switch |
| Native mobile app (iOS/Android) | Web responsive design covers phone, tablet, and desktop |
| Recording control (OBS start/stop) | Operator handles OBS recording manually |
| Graphics / lower-third control | Not in camera director scope |
| Multiple church locations | Single location, single streaming PC |
| VISCA protocol | Using NDI via BirdDog camera |

## Traceability

Which phases cover which requirements. Updated during roadmap creation (2026-05-29).

| Requirement | Phase | Status |
|-------------|-------|--------|
| HWCTRL-01 | Phase 1 | Complete |
| HWCTRL-02 | Phase 1 | Complete |
| HWCTRL-03 | Phase 1 | Complete |
| HWCTRL-04 | Phase 2 | Complete |
| HWCTRL-05 | Phase 2 | Complete |
| HWCTRL-06 | Phase 2 | Pending |
| SEG-01 | Phase 3 | Pending |
| SEG-02 | Phase 3 | Pending |
| SEG-03 | Phase 4 | Pending |
| SEG-04 | Phase 3 | Pending |
| SEG-05 | Phase 3 | Pending |
| SEG-06 | Phase 3 | Pending |
| PRESET-01 | Phase 2 | Pending |
| PRESET-02 | Phase 2 | Pending |
| PRESET-03 | Phase 2 | Pending |
| PRESET-04 | Phase 2 | Pending |
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| FEED-01 | Phase 4 | Pending |
| FEED-02 | Phase 4 | Pending |
| FEED-03 | Phase 4 | Pending |
| FEED-04 | Phase 4 | Pending |
| FEED-05 | Phase 5 | Pending |
| FEED-06 | Phase 4 | Pending |
| TRACK-01 | Phase TB | Pending |
| TRACK-02 | Phase TB | Pending |
| TRACK-03 | Phase TB | Pending |
| TRACK-04 | Phase TB | Pending |
| TRACK-05 | Phase TB | Pending |
| TRACK-06 | Phase TB | Pending |
| AGENT-01 | Phase 1 | Complete |
| AGENT-02 | Phase 1 | Complete |
| AGENT-03 | Phase 1 | Complete |
| AGENT-04 | Phase 1 | Complete |
| AGENT-05 | Phase 1 | Complete |
| AGENT-06 | Phase 1 | Complete |
| AGENT-07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 38 total (traceability table has 38; REQUIREMENTS.md header stated 37 — corrected)
- Mapped to phases: 38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-29*
*Last updated: 2026-05-29 after roadmap creation (traceability mapped, 38/38 coverage)*
