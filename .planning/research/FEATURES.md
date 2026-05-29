# Feature Research

**Domain:** Automated PTZ Camera Director for Church Live Streaming
**Researched:** 2026-05-29
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PTZ preset save/recall (named positions) | Every PTZ software from BirdDog Cam Control to hardware KBD has this. No church operator would accept a tool without preset management. | MEDIUM | NDI `NDIlib_send_send_ptz()` for preset recall; store in SQLite with name, slot number, active toggle |
| Manual PTZ joystick (pan/tilt/zoom) | BirdDog Cam Control, NDI PTZ Control, KBD — all have joystick. Required for preset setup and emergency override. | LOW | D-pad with up/down/left/right; zoom in/out buttons; speed control. NDI pan-tilt-zoom commands are well documented |
| Camera switcher (cut between sources) | Every streaming setup needs this. OBS scene switching is the standard integration path. | LOW | OBS WebSocket v5 `SetCurrentProgramScene` via `obs-websocket-js` |
| Status/connection health display | BirdDog Cam Control shows camera connectivity; operators expect to know if the system is alive at a glance. | LOW | WebSocket health ping every 5s; display agent/OBS/PTZ status in status bar |
| Authentication (login/access control) | Even single-operator church tools like ProPresenter have password protection. | LOW | Single shared passphrase + JWT (12hr expiry), no RBAC needed |
| Configurable timing (dwell duration, cycle frequency) | BirdDog Camera Director has speed control; ProPresenter has timeline automation. Configurable timing is baseline for automation. | LOW | Dwell seconds, wide duration, cut-every-N presets — all stored in SQLite `director_settings` table |
| Active/inactive toggle per preset | Every church has different stage layouts week to week. Operators need to enable/disable presets without deleting them. | LOW | Boolean `active` column in `presets` table |
| Preset reordering (drag-and-drop) | Weekly worship sets vary. Operators reorder singer positions based on who's leading. | MEDIUM | `sort_order` column + drag-reorder UI (e.g., react-beautiful-dnd) |
| Mode/segment selection (worship/sermon) | Church services have distinct segments with different camera behavior. Table stakes for any church tool. | MEDIUM | Segment selector triggers different director modes (auto-cycle vs face-tracking) |
| Live camera feed preview | BirdDog Cam Control, all PTZ software shows a live feed. Operators must see what the camera sees for framing. | MEDIUM | PTZ RTSP → local agent → HLS/MJPEG (local) or WebRTC (remote). FFmpeg subprocess on streaming PC |
| Manual override / resume automation | Any automation tool must let the human take over without breaking the system. Pause + resume pattern is universal. | LOW | Manual cut pauses auto-timer; resume button appears; manual preset tap resets dwell timer |

### Differentiators (Competitive Advantage)

Features that set CamFlow apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cloud-hosted director UI (operate from anywhere) | Every competitor (BirdDog Cam Control, AutoPTZ, Camera Director) runs locally on the streaming PC. CamFlow enables remote operation — operator can be on a tablet in the sanctuary, a phone in the parking lot, or home sick. | HIGH | Cloud backend (Express + Railway), WebSocket tunnel from local agent, relay commands with <300ms latency. This is the core architectural differentiator |
| Auto-director worship mode (preset cycling + periodic wide cuts) | No competitor offers church-service-structured automation. BirdDog Camera Director has preset playlists but costs $2,995 and is designed for sports, not worship. AutoPTZ tracks faces but doesn't manage OBS cuts. CamFlow combines both. | HIGH | State machine: cycle through presets → dwell N seconds → cut to wide → dwell M seconds → cycle next preset. Operates autonomously after pre-service setup |
| AI face tracking with GPU acceleration (ONNX Runtime + DirectML) | AutoPTZ uses CPU-bound dlib (slow). BirdDog Cam Control has built-in tracking but only for current-gen cameras. CamFlow's two-stage pipeline (YOLOv8 head detection + 19-point nose pose) runs GPU-accelerated via DirectML on AMD/NVIDIA/Intel GPUs — no CUDA needed. | HIGH | Two ONNX models: `head_640_v8s.onnx` + `nose-pose19Ps.onnx`. Already proven in the existing tracker.exe. NDI video receive → ONNX inference → NDI PTZ commands |
| Boundary range limit with smooth zoom-out | Unique to CamFlow. No competitor has this. When the tracked person leaves a defined zone, the camera smoothly zooms out to a wide view instead of hunting. Prevents the "PTZ chasing the wrong person" failure mode. | MEDIUM | Normalized coordinate boundary box. When tracking target exits zone: interpolate zoom from current → wide over ~1-2 seconds. Already spec'd in ARCHITECTURE.md |
| Click-to-select face tracking (not auto first-detection) | AutoPTZ and BirdDog auto-tracking grab the highest-confidence face automatically. This fails in church when there are multiple people on stage. CamFlow's operator clicks the person to track — removes ambiguity. | LOW | Interactive mode: click overlay on live feed to set tracking target. UI-driven, not AI-driven selection |
| Pre-service setup workflow (one-time config, weekly toggle) | Other tools require the operator to be hands-on throughout the service. CamFlow shifts work to before service: assign presets to stage positions once, then just toggle active/inactive and reorder each week. | LOW | Setup screen with live feed + joystick + preset grid. Used before service, not during |
| Responsive web UI (tablet, phone, desktop) | BirdDog Cam Control is Windows desktop only. AutoPTZ is cross-platform desktop (PySide6). CamFlow works on any browser — primary target tablet landscape (operator's device during service), fallback phone portrait (emergency override). | MEDIUM | React + Tailwind CSS responsive design. Tablet-first layout with collapsible panels |
| Service segment automation (worship → sermon → last worship → idle) | No competitor models the church service flow end-to-end. CamFlow maps directly to the service order: Worship = auto-cycle, Sermon = face-track + manual B-roll, End = idle. | MEDIUM | Segment selector triggers mode transitions: preset recall, AutoPTZ start/stop, OBS scene switching |
| OBS integration (scene switching synced with PTZ) | Most competitors control cameras only. CamFlow bridges camera control AND OBS scene switching — the camera cut happens 1 second after PTZ preset recall to allow settle time. | MEDIUM | Transition delay config; OBS WebSocket v5 via `obs-websocket-js` on local agent |
| Standalone autotracker (Track B) | Separate from the web app. Can be used independently of the cloud director — just face tracking on the streaming PC with Kivy GUI. | HIGH | Rebuilt Python/Kivy app from ARCHITECTURE.md. NDI video + ONNX AI + NDI PTZ control |
| NDI protocol (not VISCA) | Most PTZ software targets VISCA (Sony/Canon/Panasonic). CamFlow targets NDI (BirdDog cameras) — single Ethernet cable for video, audio, control, and power. Industry standard for live production. | MEDIUM | NDI SDK via `NDIlib.pyd`. Already proven in existing tracker.exe |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI director decisions (automatic cutting based on who's singing) | "Make it fully automated — AI decides what to show" | False positives during worship (musician moves arm → camera swings). Unpredictable results that anger congregations. Testing against live hardware is impossible. v1 complexity exceeds value. | Deterministic preset cycling with operator-chosen presets and timing. Operator defines the sequence; automation executes it |
| Audio-triggered switching (mic audio → detect singer → switch camera) | "When the worship leader starts singing, automatically cut to their camera" | Requires multi-channel audio routing, latency matching between audio and video, false triggers from ambient noise. Audio-video sync is a deep rabbit hole. Adds 3+ weeks of complexity to v1. | Preset cycling is time-based and predictable. Operator can manually override in 1 tap. Audio triggering is a v2 consideration |
| Full auto-tracking for every person on stage | "Track every singer independently with multiple PTZ cameras" | Single PTZ can only frame one person at a time. Multiple PTZ cameras multiply cost, complexity, and failure modes. Auto-detection of who to track is unreliable in group settings. | Click-to-select one person to track (sermon mode). Worship mode uses preset positions, not face tracking |
| Native mobile app (iOS/Android) | "An app would be more polished and faster to launch than a browser" | App store review delays, separate builds for iOS and Android, distribution complexity. No church operator has complained about using a browser — they already use web-based tools. | Responsive web app works on tablet, phone, and desktop. Add to Home Screen for app-like experience (PWA in v2) |
| Multi-user / permissions system | "Different volunteers have different access levels" | Church has one operator who is also the admin. RBAC adds database complexity, UI complexity, and security surface for zero user need. | Single operator + shared passphrase. If multi-user needed later, add v2 |
| Recording control (OBS start/stop recording) | "One tool for everything" | OBS recording start/stop is trivial to do manually (one button in OBS). Adding it to CamFlow creates scope creep without meaningful value. | Operator handles OBS recording manually. CamFlow focuses on camera direction |
| Graphics / lower-third overlay control | "Control the text overlays from the same app" | ProPresenter and OBS handle graphics well. CamFlow is a camera director, not a full production suite. Graphics control adds a separate domain of complexity (text templates, data sources, rendering). | Use ProPresenter or OBS for graphics. CamFlow controls what those apps display via OBS scene switching |
| Multi-church / multi-location | "Run multiple church streams from one dashboard" | Single church, single streaming PC. Multi-location requires multi-tenant architecture, separate agent instances, and location-aware routing — all for a hypothetical need. | Single location deployment. If needed later, spawn separate Railway instances per location |
| VISCA protocol support | "Support Canon/Sony/PTZOptics cameras too" | The church has a BirdDog camera using NDI. Supporting VISCA adds protocol implementation complexity (UDP packet construction, different command formats) for no immediate value. | NDI-only for v1. If additional cameras needed, add VISCA as a separate protocol adapter later |
| Voice commands ("Camera 2, close up") | "Hands-free operation during service" | Ambient noise during worship, latency of speech recognition, and unreliability of voice commands in loud environments make this dangerous for live production. A false trigger during stream is worse than no trigger. | Tap-friendly UI with large buttons. Manual override is one tap away |
| Camera color matrix / shading control | "Match camera colors from the director app" | BirdDog Cam Control already does this well. Rebuilding color shading adds significant complexity (RGB matrix, white balance, exposure controls) that's unrelated to camera direction. | Use BirdDog Cam Control for camera shading. Export/import presets separately |
| Service scheduling / calendar integration | "Auto-start the stream on Sunday at 10:00 AM" | Live streaming needs human oversight. Automated start without a person watching creates risk (wrong preset, audio issues, no one to fix problems). | Go Live button requires operator confirmation. System arms when operator is ready |

## Feature Dependencies

```
Cloud WebSocket Tunnel (local agent ↔ cloud)
    └──requires──> Authentication (JWT + passphrase)
    └──requires──> Local agent as Windows service

PTZ Preset Management (save/recall/reorder/toggle)
    ├──requires──> NDI PTZ control (send PTZ commands)
    ├──requires──> Manual PTZ joystick (for positioning during save)
    └──requires──> SQLite database (presets table)

Auto-Director Worship Mode (preset cycling + wide cuts)
    ├──requires──> PTZ preset management
    ├──requires──> OBS camera switcher
    ├──requires──> Configurable timing settings
    └──requires──> Cloud WebSocket tunnel (commands relay through agent)

Sermon Mode (face tracking + manual B-roll)
    ├──requires──> AutoPTZ / face tracking (Track B)
    ├──requires──> OBS camera switcher
    └──requires──> PTZ preset recall (pulpit preset)

Live Camera Feed (PTZ video in UI)
    ├──requires──> Local agent (FFmpeg subprocess for RTSP relay)
    ├──requires──> Cloud WebSocket tunnel (feed status)
    └──enhances──> PTZ Preset Management (framing reference while saving presets)

AutoPTZ Face Tracking (Track B)
    ├──requires──> NDI video receive
    ├──requires──> ONNX Runtime + DirectML GPU inference
    ├──requires──> YOLOv8 head detection model
    ├──requires──> 19-point nose pose model
    ├──requires──> NDI PTZ control
    └──enhances──> Sermon Mode (active tracking on pulpit)

Boundary Range Limit
    └──requires──> AutoPTZ face tracking (modifies tracking behavior when person leaves zone)

Manual Override / Resume
    ├──enhances──> Auto-Director Worship Mode (pause auto-cycle, resume)
    └──enhances──> Sermon Mode (manual camera switch overrides tracking)

Service Segment Selector
    ├──requires──> Auto-Director Worship Mode (worship segment)
    ├──requires──> Sermon Mode (sermon segment)
    └──requires──> Camera switcher (transitions between modes)

Remote Live Feed (WebRTC)
    ├──requires──> Live camera feed (base RTSP capture)
    └──requires──> Cloud WebSocket tunnel (signaling relay)
```

### Dependency Notes

- **Auto-director requires PTZ preset management:** Preset recall commands are NDI-based. Presets must be saved before auto-director can reference them.
- **Sermon mode requires face tracking:** The pulpit tracking feature depends on the rebuilt autotracker's AI inference pipeline being operational.
- **Live feed enhances preset management:** Positioning PTZ presets without seeing the camera feed is impossible. Feed must be available in the Setup screen.
- **Cloud WebSocket tunnel is the backbone:** All remote commands flow through it. Must be built first (Phase 1).
- **Track A (web app) and Track B (autotracker) are parallel:** They share NDI protocol and PTZ control, but the web app can function without the autotracker (worship mode uses presets, not tracking). Only Sermon mode requires both.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] **Local agent + Cloud tunnel** — WebSocket connection from streaming PC to cloud. Without this, no remote control. *Phase 1*
- [ ] **Authentication (JWT + passphrase)** — Single shared passphrase login. Keeps the system secure. *Phase 1*
- [ ] **OBS scene switching** — Switch between Cam 1 (PTZ) and Cam 2 (wide) scenes. *Phase 1*
- [ ] **PTZ preset save/recall** — Save and recall 8 named presets via NDI. *Phase 1*
- [ ] **Manual PTZ joystick** — Pan/tilt/zoom control for preset setup and override. *Phase 2*
- [ ] **Preset management UI** — Active/inactive toggle, drag reorder, name editing. *Phase 2*
- [ ] **Camera switcher UI** — Two big buttons: PTZ and Wide. Active highlight. *Phase 2*
- [ ] **Auto-director worship mode** — Preset cycling with configurable dwell + periodic wide cuts. The core automation. *Phase 3*
- [ ] **Configurable timing** — Dwell seconds, wide duration, cut frequency, transition delay. *Phase 3*
- [ ] **Manual override + resume** — Tap to override, resume button to restart automation. *Phase 3*
- [ ] **Status bar** — Agent connection, OBS status, active camera, active mode, AutoPTZ status. *Phase 2-3*
- [ ] **Service segment selector** — Worship / Sermon / Last Worship / Idle. *Phase 3*

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Sermon mode + AutoPTZ integration** — Face tracking on pulpit, manual B-roll tap to wide. Triggered when autotracker is rebuilt and verified. *Phase 4*
- [ ] **Live camera feed (local)** — RTSP relay via FFmpeg to HLS/MJPEG on local network. Triggered when preset setup workflow needs visual feedback. *Phase 4*
- [ ] **Click-to-select face tracking** — Interactive tracking target selection in the autotracker GUI. Triggered when autotracker is stable. *Phase 4*

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Remote live feed (WebRTC)** — Camera feed over any network, not just local. *Phase 5*
- [ ] **Boundary range limit** — Zone-based tracking with smooth zoom-out. Defer until autotracker core is stable.
- [ ] **Service log** — Timestamped event log (segment changes, preset recalls, manual overrides). Nice to have for debugging/monitoring. *Phase 5*
- [ ] **PWA add-to-home-screen** — App-like experience on mobile without native app complexity.
- [ ] **Audio-triggered switching** — Revisit after v1 validation. Currently anti-feature but may prove valuable for specific churches.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Local agent + Cloud tunnel | HIGH | HIGH | P1 |
| Authentication (JWT + passphrase) | MEDIUM | LOW | P1 |
| OBS scene switching | HIGH | LOW | P1 |
| PTZ preset save/recall | HIGH | MEDIUM | P1 |
| Manual PTZ joystick | HIGH | LOW | P2 |
| Preset management UI (toggle/reorder) | HIGH | MEDIUM | P2 |
| Camera switcher UI | HIGH | LOW | P2 |
| Auto-director worship mode | HIGH | MEDIUM | P3 |
| Configurable timing settings | MEDIUM | LOW | P3 |
| Manual override + resume | HIGH | LOW | P3 |
| Status bar | MEDIUM | LOW | P2 |
| Service segment selector | HIGH | MEDIUM | P3 |
| Sermon mode + AutoPTZ | HIGH | HIGH | P4+ |
| Live camera feed (local) | MEDIUM | MEDIUM | P4+ |
| Click-to-select face tracking | MEDIUM | LOW | P4+ |
| Remote live feed (WebRTC) | LOW | HIGH | P5+ |
| Boundary range limit | MEDIUM | MEDIUM | P5+ |

**Priority key:**
- P1: Must have for v1 launch (Phase 1-2)
- P2: Should have for v1 launch (Phase 2-3)
- P3: Core automation, completes v1 (Phase 3)
- P4+: Post-v1 validation (Phase 4)
- P5+: Future consideration (Phase 5+)

## Competitor Feature Analysis

| Feature | BirdDog Cam Control (Free) | BirdDog Camera Director ($2995) | AutoPTZ (Free, OSS) | PTZOptics/StreamGeeks VRP (Free, OSS) | CamFlow (Our Approach) |
|---------|---------------------------|-------------------------------|---------------------|--------------------------------------|------------------------|
| PTZ preset management | Save/recall + color settings | Group presets + individual paths | Not present (tracking-only) | Not present (AI vision focus) | Save/recall + name/toggle/reorder + drag UI |
| Auto tracking | Facial + body recognition, adjustable sensitivity | Not present (preset-based) | Face tracking (dlib, CPU) | Moondream VLM object tracking (cloud API) | Two-stage AI: YOLOv8 + nose pose (ONNX, GPU via DirectML) |
| OBS integration | None | None | None | Gesture-based scene switching, OBS script | Full scene switching synced with PTZ cuts, transition delay |
| Multi-camera | 4 cameras per instance | Unlimited (PC-dependent) | 1 camera | 1 camera (PTZOptics API) | 2 cameras (PTZ + wide), scalable to N |
| Cloud/remote operation | Local Windows only | Local Windows only | Local desktop only | Browser-based, but local only | Cloud-hosted (Railway), operate from anywhere |
| Preset automation | None (manual recall) | Preset playlists + waypoints + speed control | None | Voice triggers, zone monitoring | Auto-director: cycling + periodic wide cuts + configurable timing |
| Church service flow | None | None | None | None | Segment-based: Worship → Sermon → Last Worship → Idle. Maps to service order |
| Live feed preview | Yes (local) | Yes (local) | Yes (NDI video) | Yes (browser camera) | Yes: local (HLS/MJPEG) + remote (WebRTC) |
| Range limit / zone control | None | None (waypoint-based) | None | Zone monitor (alerts only, not PTZ) | Boundary box + smooth zoom-out when person leaves |
| Click-to-select tracking target | Auto-detect only | N/A | Auto-detect only | Auto-detect only (VLM) | Interactive: click feed overlay to assign track target |
| Cost | Free (requires BirdDog camera) | $2,995 USD | Free (GPL-3.0) | Free (MIT) | Free (AGPL-3.0) |
| Platform | Windows 10 | Windows | Windows/macOS/Linux (Python) | Browser (any) | Browser (any) + Windows agent |

## Sources

- **BirdDog Cam Control** — [birddog.tv/camcontrol-overview](https://birddog.tv/camcontrol-overview/) (official product page, fetched 2026-05-29). Features: auto tracking (facial/body), color matrix, 4-camera support, preset save/recall, free. MEDIUM confidence.
- **BirdDog Camera Director** — [birddog.tv/cameradirector-overview](https://birddog.tv/cameradirector-overview/) (official product page, fetched 2026-05-29). Features: group presets, individual PTZ paths, preset playlists, speed control, $2,995. EOL announced Oct 2025. MEDIUM confidence.
- **BirdDog House of Worship** — [birddog.tv/house-of-worship](https://birddog.tv/house-of-worship/) (official solutions page, fetched 2026-05-29). AI-powered tracking, centralized control, multi-site workflows via BirdDog Connect. HIGH confidence (official source).
- **AutoPTZ/autoptz** — [github.com/AutoPTZ/autoptz](https://github.com/AutoPTZ/autoptz) (GitHub repository, fetched 2026-05-29). 92 stars. NDI/USB/RTSP sources, dlib face recognition, VISCA control, PySide6 GUI, Python, GPL-3.0. HIGH confidence (official repo).
- **StreamGeeks/Visual Reasoning Playground** — [github.com/streamgeeks/visual-reasoning-playground](https://github.com/streamgeeks/visual-reasoning-playground) (GitHub repository, fetched 2026-05-29). 82 stars. 17 AI tools for broadcast: PTZ tracking, gesture OBS control, zone monitoring, framing assistant, voice triggers. Moondream VLM + PTZOptics API. MIT license. HIGH confidence (official repo).
- **CamFlow PRD.md** — Internal project PRD (read 2026-05-29). Full feature specification including auto-director, sermon mode, preset management, live feed, timing config. HIGH confidence (project canonical source).
- **CamFlow ARCHITECTURE.md** — Autotracker architecture spec (read 2026-05-29). Two-stage AI pipeline (YOLOv8 + nose pose), ONNX Runtime + DirectML, NDI protocol, Kivy GUI. HIGH confidence (project canonical source).
- **CamFlow PROJECT.md** — Project overview and constraints (read 2026-05-29). Two-track structure (web app + autotracker), NDI protocol only, single operator, Windows platform. HIGH confidence (project canonical source).

---
*Feature research for: Automated PTZ Camera Director (Church Live Streaming)*
*Researched: 2026-05-29*
