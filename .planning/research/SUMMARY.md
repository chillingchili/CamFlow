# Project Research Summary

**Project:** CamFlow — Cloud-Controlled PTZ Camera Director for Church Live Streaming
**Domain:** Automated live production (PTZ camera control + OBS scene switching + AI face tracking)
**Researched:** 2026-05-29
**Confidence:** HIGH

## Executive Summary

CamFlow is a cloud-controlled PTZ camera director app that automates church live stream direction. It replaces the cognitively demanding, full-attention manual camera operation with a pre-service setup workflow: the operator configures presets and timing before service, then the system auto-cycles PTZ presets with periodic wide-angle cuts during worship, and tracks the speaker's face during sermons. All control flows through a cloud-hosted React dashboard (Railway), relayed to hardware via a local Node.js agent on the streaming PC over a persistent outbound WebSocket tunnel — the standard IoT/edge pattern for devices behind NAT/firewalls.

The recommended approach is a **two-track parallel build**. Track A (web app + local agent) delivers the core remote-control and auto-director capabilities: WebSocket tunnel, PTZ preset management, OBS scene switching, and the worship auto-cycle state machine. Track B (autotracker rebuild) runs concurrently — it's a standalone Python/Kivy application using GPU-accelerated ONNX Runtime with DirectML for two-stage AI inference (YOLOv8 head detection → 19-point nose pose tracking), communicating with the BirdDog camera via NDI protocol. The tracks integrate at Phase 4 when the agent spawns the compiled autotracker as a subprocess for sermon mode. This parallel strategy shortens the critical path from ~50 days to ~30-35 days.

Key risks center on the WebSocket tunnel as a single point of failure (commands can't reach hardware if the tunnel drops), PTZ preset settle-time misconfigurations causing mid-motion OBS cuts on air, and autotracker false-positive tracking of background objects. Mitigations: command acknowledgment protocol with stale-queue rejection, conservative 2.5s default settle delay with per-preset overrides, and strict confidence thresholding (≥0.65) with 3-frame temporal stability for the AI tracker. The autotracker must also avoid competing with OBS for GPU/CPU resources — the live feed is 640×360 at 5 FPS with hardware-accelerated FFmpeg and auto-pause by default.

## Key Findings

### Recommended Stack

The system spans three distinct technology stacks — cloud web app, local Windows agent, and Python autotracker — with zero runtime code sharing between them. Each is independently deployable.

**Core technologies:**

| Layer | Technology | Purpose | Why Recommended |
|-------|-----------|---------|-----------------|
| Cloud Frontend | React 19.2 + Vite 8 + Tailwind CSS 4.3 | Director SPA dashboard | Latest stable React with new JSX Transform; Vite replaces deprecated CRA; Tailwind v4 zero-config via `@tailwindcss/vite` plugin |
| Cloud Backend | Express 5.2 + ws 8.21 + better-sqlite3 12.6 | REST API, WebSocket server, database | Express 5 has native promise support; ws 8.21 includes critical DoS security fix; better-sqlite3 is fastest SQLite driver with WAL mode — no connection pool needed for single-operator app |
| Cloud Auth | jsonwebtoken 9.0.3 + bcrypt 6.0 | Single shared passphrase + JWT | HS256 JWT with 12hr expiry; bcrypt async API avoids event loop blocking; single operator needs no RBAC |
| Local Agent | Node.js 22 + obs-websocket-js + NDI SDK | Hardware bridge on streaming PC | Same runtime as cloud for consistency; obs-websocket-js for OBS WebSocket v5; NDI SDK for BirdDog PTZ control (NOT VISCA — critical protocol correction from PRD) |
| Local Agent Service | node-windows 1.0.0-beta.8 | Windows service installation | Standard tool (2.9k stars); auto-start on boot, survives logout; functionally stable despite beta label |
| Live Feed Relay | FFmpeg (system) | RTSP → MJPEG transcoding | Hardware-accelerated via `-hwaccel d3d11va`; 640×360 at 5 FPS default; auto-pause after 60s inactivity |
| Autotracker Runtime | Python 3.12 | Inference + GUI runtime | Sweet spot: all dependencies (ONNX Runtime DirectML 1.24.4, Kivy 2.3.1, OpenCV 4.13) have cp312-win_amd64 wheels |
| Autotracker GUI | Kivy 2.3.1 | OpenGL-accelerated video rendering | Native video texture support for NDI frames; same framework as original tracker.exe; SDL2 + GLEW backend |
| Autotracker AI | ONNX Runtime DirectML 1.24.4 + YOLOv8s + 19-point nose pose | GPU inference on any GPU (AMD/NVIDIA/Intel) | DirectML eliminates CUDA dependency; two-stage pipeline (head detect → nose pose) is proven from original tracker.exe architecture |
| Autotracker CV | OpenCV 4.13 | Frame capture, resize, NMS | Latest stable; cp37-abi3 wheel for broad Python compatibility |
| Autotracker Packaging | PyInstaller 6.x | Single .exe distribution | Same pattern as original tracker.exe; supports Python 3.12 |

**Critical version requirements:**
- Express must be 5.x (4.x lacks native promise support)
- ws must be 8.21.0+ (security fix for DoS)
- Python must be 3.12 (3.11 is minimum for ONNX Runtime DirectML 1.24.4; 3.13 has partial Kivy wheel support edge cases)
- ONNX Runtime DirectML must be 1.24.4 (latest as of Mar 2026)

### Expected Features

**Must have (table stakes — Phase 1-2):**
- PTZ preset save/recall (8 named slots) — every PTZ software has this; non-negotiable
- Manual PTZ joystick (pan/tilt/zoom) — required for preset setup and emergency override
- OBS camera switcher (cut between PTZ and wide scenes) — standard integration path
- Status/connection health display — operators must know system state at a glance
- Authentication (shared passphrase + JWT) — even single-operator church tools need access control
- Active/inactive toggle per preset — weekly stage layout changes require flexible presets
- Preset reordering (drag-and-drop) — worship set order varies weekly
- Configurable timing (dwell, wide duration, cycle frequency) — baseline for automation
- Live camera feed preview — operators must see what the camera sees for framing

**Should have (competitive differentiators — Phase 3):**
- Cloud-hosted director UI (operate from anywhere) — **the architectural differentiator**; all competitors run locally on the streaming PC
- Auto-director worship mode (preset cycling + periodic wide cuts) — no competitor offers church-service-structured automation
- Service segment automation (worship → sermon → last worship → idle) — maps directly to church service flow
- Responsive web UI (tablet/phone/desktop) — tablet landscape primary target, phone portrait for emergency override
- OBS integration synced with PTZ cuts (settle delay + OBS fade transition) — bridges camera control and scene switching
- Manual override + resume — one tap to take control, one tap to return to automation

**Should have (Phase 4 — post-v1 validation):**
- AI face tracking with GPU acceleration (ONNX Runtime + DirectML) — two-stage pipeline beats CPU-bound dlib competitors
- Click-to-select face tracking (not auto first-detection) — removes ambiguity in multi-person church stages
- Boundary range limit with smooth zoom-out — unique to CamFlow; prevents PTZ chasing wrong targets
- Standalone autotracker (Track B) — usable independently of cloud director; NDI protocol native

**Defer (v2+):**
- AI director decisions (automatic cutting based on who's singing) — false positives in worship; unpredictable results anger congregations
- Audio-triggered switching — multi-channel audio routing, latency matching, false triggers from ambient noise; adds 3+ weeks complexity
- Native mobile app — app store delays; responsive web + Add to Home Screen covers needs
- Remote live feed (WebRTC) — complex signaling; local MJPEG sufficient for v1
- Multi-church / multi-location — requires multi-tenant architecture for hypothetical need
- VISCA protocol support — church has BirdDog NDI camera; VISCA adds protocol complexity for zero immediate value
- Voice commands — ambient noise in church makes this dangerous for live production

### Architecture Approach

The system follows a **3-tier outbound-tunnel architecture** — the standard pattern for IoT/edge systems where hardware sits behind NAT/firewalls. The local agent initiates a persistent WebSocket connection to the cloud; the cloud never connects inbound to the church network. This eliminates firewall configuration, works through any router, and is battle-tested across the industry.

**Major components:**

1. **Cloud Backend (Express + ws + better-sqlite3)** — REST API for auth and config CRUD; WebSocket server for agent tunnels with per-connection state; broadcasts agent health to all frontend clients; hosts the auto-director state machine (server-side so it survives frontend page reloads); SQLite database for presets, director settings, and service log

2. **Cloud Frontend (React SPA)** — Director UI with segment selector, preset grid, camera switcher, PTZ joystick, live feed panel, and status bar; tablet-first responsive design with collapsible panels; WebSocket client for real-time agent state and command acknowledgments

3. **Local Agent (Node.js Windows Service)** — Single process with five flat modules: tunnel manager (WebSocket client with exponential-backoff reconnect and stale-queue rejection), OBS controller (scene switching via obs-websocket-js), PTZ controller (NDI commands via NDI SDK), autotracker manager (Python subprocess lifecycle), and feed relay (FFmpeg subprocess for RTSP→MJPEG). Each module has independent error boundaries — a PTZ failure doesn't crash OBS control. Health reporter aggregates all subsystem states every 5 seconds.

4. **Autotracker (Python/Kivy, Track B)** — Standalone application with three threads: NDI video receive, two-stage AI inference pipeline (YOLOv8s head detection → 19-point nose pose tracking via ONNX Runtime DirectML), and Kivy GUI rendering. Connects to NDI camera directly (its own NDI SDK connection). Communicates with agent only via process management (spawn/kill, stdout health check). Compiles to single .exe via PyInstaller.

**Key patterns:**
- **Outbound WebSocket Tunnel:** Agent connects out → cloud; never inbound. Standard NAT traversal.
- **Command Relay with Acknowledgment:** Every hardware command has a requestId; UI shows "pending" until agent ACKs success/failure. No fire-and-forget.
- **Subprocess Lifecycle Management:** Agent spawns/kills autotracker; independent failure domains.
- **Independent Hardware Subsystems:** OBS, PTZ, autotracker, and feed are isolated modules — a camera disconnect doesn't break OBS switching.

### Critical Pitfalls

From PITFALLS.md research (verified against AutoPTZ issue tracker, OBS WebSocket docs, live production best practices):

1. **WebSocket Tunnel as Single Point of Failure** — If the cloud-to-agent tunnel drops, ALL commands stop reaching hardware mid-service. **Prevent with:** ACK protocol from day one, 15s heartbeat timeout detection, stale-queue rejection (commands >15s old dropped on reconnect), auto-director timer MUST gate on ACKs not wall-clock. Phase 5: local HTTP fallback server on agent for emergency pause/stop.

2. **PTZ Settle Time Too Short (OBS Cuts Mid-Motion)** — The PRD defaults to 1s transition delay, but mechanical PTZ presets involving large movements take 2-4 seconds. Viewers see the camera mid-pan. **Prevent with:** Conservative 2.5s default, per-preset custom settle time overrides, OBS fade transition (300ms) to mask sub-second imprecision. Fixed-delay approach — don't attempt motion detection from RTSP feed.

3. **Autotracker Tracking False Positives (Furniture, Lights)** — When the tracked person leaves frame, the YOLOv8 head detector latches onto stage furniture with vaguely head-like shapes. This is the #1 reported AutoPTZ issue. **Prevent with:** Strict confidence floor (≥0.65, not 0.5), temporal stability (require 3 consecutive confident frames before engaging new target), head size sanity check (>40% frame width = false positive), boundary range limit as secondary safety net.

4. **Cloud JWT Token Expiry During Service** — Server restart or token invalidation logs operator out mid-service; auto-director continues but operator has zero visibility. **Prevent with:** Auto-director state machine MUST run decoupled from operator session, re-login via overlay (not page redirect), grace period on token expiry (30min if same IP and recent activity), WebSocket re-auth on reconnect.

5. **FFmpeg Subprocess Consuming Streaming PC Resources** — FFmpeg software-encodes MJPEG, competing with OBS's encoding pipeline, causing frame drops on the live stream. **Prevent with:** Hardware acceleration (`-hwaccel d3d11va`), 640×360 at 5 FPS default (not 1080p30), feed auto-paused by default (unpause only when checking framing, auto-pause after 60s), CPU monitoring with auto-throttle at 80% sustained usage.

## Implications for Roadmap

Based on combined research, the suggested phase structure follows the dependency graph from ARCHITECTURE.md, adjusted for parallel Track B development and pitfall prevention:

### Phase 1: Foundation — Cloud Backend + Agent Tunnel + Basic Hardware Control

**Rationale:** The WebSocket tunnel is the backbone — without it, no remote control exists. Cloud Backend must be deployed first so the agent has something to connect to. This phase establishes the ACK protocol and heartbeat from day one (Pitfall 1 prevention). OBS switching and PTZ recall are the minimum viable hardware integrations.

**Delivers:** Cloud backend on Railway (Express, JWT auth, SQLite with Railway volume mount), local agent as Windows service (Node.js + node-windows with correct Session 0 environment), persistent WebSocket tunnel with auto-reconnect and stale-queue rejection, OBS scene switching with acknowledgment, PTZ preset recall via NDI (NOT VISCA), health heartbeat every 5s.

**Addresses:** Local agent + Cloud tunnel, Authentication (JWT + passphrase), OBS scene switching, PTZ preset save/recall.

**Avoids:** Pitfall 1 (ACK protocol + heartbeat from day one), Pitfall 4 (JWT with refresh, state machine decoupled from session), Pitfall 6 (NDI protocol, not VISCA — correct PRD's tech stack section), Railway SQLite ephemeral storage (use volume mount).

**Research flag:** LOW — well-documented patterns. WebSocket tunnel + JWT auth + OBS WebSocket v5 are standard integrations. No deep research needed.

### Phase 2: Core UI + Preset Management

**Rationale:** The operator needs a usable interface to set up presets and control cameras before automation can be built on top. Manual PTZ joystick is required for preset positioning. Per-preset settle time field added to data model now (Pitfall 2 prevention) so the auto-director can use it later. Status bar gives operator confidence the system is alive.

**Delivers:** React frontend with LiveView and Setup pages, responsive tablet-first layout, manual PTZ joystick (D-pad + zoom), camera switcher UI (two big buttons with active highlight), preset grid with drag-reorder, active/inactive toggle, name editing, status bar with agent/OBS/PTZ connection indicators, per-preset settle time field in data model, live feed panel placeholder (collapsed by default).

**Addresses:** Manual PTZ joystick, Preset management UI (toggle/reorder), Camera switcher UI, Status bar.

**Avoids:** Pitfall 2 (per-preset settle time in data model), UX pitfalls (manual override always one tap away, live view shows only essential info).

**Research flag:** LOW — standard CRUD UI with React + Tailwind. React Router 7 patterns are well-documented.

### Phase 3: Auto-Director Engine + Service Segments

**Rationale:** This is the core automation — the feature that shifts the operator from constant control to oversight. Depends on Phase 2 (presets must exist to cycle through them). The auto-director state machine runs entirely on the cloud backend so it survives frontend page reloads. Timer MUST gate on command ACKs, not wall-clock (Pitfall 1 prevention). Per-preset settle delays are used from Phase 2's data model.

**Delivers:** Auto-director worship mode state machine (cloud-hosted), preset cycling with configurable dwell + periodic wide cuts, service segment selector (Worship/Sermon/Last Worship/Idle) with confirmation step, configurable timing settings (dwell seconds, wide duration, cut frequency, transition delay with conservative 2.5s default), manual override (pause/resume) with one-tap access, next-preset preview alongside countdown, OBS fade transition on scene switches.

**Addresses:** Auto-director worship mode, Configurable timing settings, Manual override + resume, Service segment selector.

**Avoids:** Pitfall 1 (timer gates on ACKs), Pitfall 2 (conservative 2.5s default, per-preset overrides), Pitfall 4 (state machine decoupled from operator session — runs even if operator logged out), UX pitfalls (confirmation for segment transitions, next-preset preview, one-tap manual override from every screen).

**Research flag:** MEDIUM — state machine design for live production automation has edge cases (0 active presets, 1 active preset, deactivating current preset mid-cycle). Needs careful state transition mapping. Consider `/gsd-research-phase` for state machine design patterns.

### Phase 4: Sermon Mode + Autotracker Integration + Local Live Feed

**Rationale:** Sermon mode requires the autotracker to be operational. The autotracker (Track B) is built in parallel with Phases 1-3 — it has zero runtime dependencies on the cloud app. By Phase 4, the autotracker should be compiled and tested. Local live feed enhances the Setup workflow (operator can see camera view while positioning presets).

**Delivers:** Sermon mode (face tracking on pulpit + manual B-roll tap to wide), agent autotracker subprocess management (spawn/kill/health monitor), local live feed via FFmpeg (hardware-accelerated, 640×360, 5 FPS, auto-paused by default), click-to-select face tracking in autotracker GUI, end-to-end service flow (Worship → Sermon → Last Worship → Idle).

**Addresses:** Sermon mode + AutoPTZ integration, Live camera feed (local), Click-to-select face tracking.

**Avoids:** Pitfall 3 (confidence ≥0.65 + temporal stability + head size sanity check in autotracker), Pitfall 5 (hardware-accelerated FFmpeg, low-res default, auto-pause, CPU monitoring at 80% threshold), integration gotchas (autotracker startup delay before commands, Session 0 environment for service, GPU VRAM monitoring).

**Research flag:** HIGH for autotracker rebuild — the Python/Kivy/ONNX Runtime DirectML/NDI integration is complex and the source code was lost (must rebuild from ARCHITECTURE.md spec). Consider `/gsd-research-phase` for ONNX Runtime DirectML API on Windows, Kivy video texture integration, and NDI SDK Python bindings.

### Phase 5: Remote Feed + Hardening + Polish

**Rationale:** Once the core service flow works, add remote live feed for off-site operators, local fallback mode for tunnel outages, and production hardening. These are "nice to have" features that don't block the core automation.

**Delivers:** Remote live feed via WebRTC (peer-to-peer, cloud signaling only), local HTTP fallback server on agent (emergency pause/stop when tunnel is down), boundary range limit with smooth zoom-out, service log with timestamped events, CPU/VRAM monitoring with auto-throttle, PWA add-to-home-screen, login overlay (not page redirect).

**Addresses:** Remote live feed (WebRTC), Boundary range limit, Service log.

**Avoids:** Pitfall 1 (local fallback mode), Pitfall 4 (login overlay instead of redirect), performance traps (WebRTC peer-to-peer avoids cloud bandwidth costs).

**Research flag:** MEDIUM for WebRTC — needs STUN/TURN server research and signaling protocol design between agent and cloud.

### Phase Ordering Rationale

- **Phase 1 before everything:** The tunnel is the backbone — no remote control without it. OBS and PTZ are the minimum hardware integrations needed to validate the architecture.
- **Phase 2 before Phase 3:** Presets must be saved and tested before the auto-director can cycle through them. Per-preset settle times must exist in the data model before the state machine uses them.
- **Phase 3 before Phase 4:** Segment switching infrastructure (mode transitions, OBS scene switches, auto-director pause/resume) must work before integrating the autotracker for sermon mode.
- **Track B parallel with Phases 1-3:** The autotracker has zero runtime dependencies on the cloud app. Building it concurrently shortens the critical path from ~50 days to ~30-35 days. By Phase 4, it should be compiled, tested, and ready for agent integration.
- **Phase 4 before Phase 5:** Local live feed is the prerequisite for remote feed (WebRTC signaling builds on the same FFmpeg pipeline). Boundary range limit builds on stabilized autotracker core.
- **Longest dependency chain (critical path):** Cloud auth → Agent tunnel + OBS → PTZ control → Preset management CRUD + UI → Director state machine → Autotracker integration → Live feed FFmpeg → WebRTC remote feed. ~30-35 days sequential. Autotracker rebuild (~15-20 days) runs in parallel.

### Research Flags

**Phases likely needing deeper research during planning (`/gsd-research-phase`):**

- **Phase 3 (Auto-Director State Machine):** Live production automation state machines have subtle edge cases — 0 active presets, 1 active preset, deactivating the current preset mid-cycle, mode transitions while a preset is in transit, manual override resume behavior after long pause. Needs formal state transition diagram and edge case enumeration.
- **Phase 4 (Autotracker Rebuild — Track B):** The Python/Kivy/ONNX Runtime DirectML/NDI integration is complex. Source code was lost; must rebuild from ARCHITECTURE.md spec. Key unknowns: ONNX Runtime DirectML 1.24.4 API specifics on Windows, Kivy 2.3.1 video texture integration with NDI frames, Python NDI SDK bindings availability, and GPU inference performance on the actual streaming PC hardware.
- **Phase 5 (WebRTC Remote Feed):** STUN/TURN server requirements for NAT traversal, signaling protocol design between agent and cloud, browser WebRTC API integration with MJPEG fallback. Needs research into available TURN services (Railway may not provide one).

**Phases with well-documented standard patterns (skip research-phase):**

- **Phase 1 (Cloud Backend + Agent Tunnel):** Express 5 REST API, ws WebSocket server/client, JWT auth, better-sqlite3 CRUD, OBS WebSocket v5 integration, node-windows service installation. All are standard, well-documented integrations with Context7 coverage.
- **Phase 2 (Core UI + Preset Management):** React 19 SPA with Tailwind CSS 4, React Router 7 routing, standard CRUD forms, drag-and-drop preset reordering, responsive design with Tailwind breakpoints. Straightforward frontend work with no novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against Context7, npm, PyPI, and GitHub releases. Version compatibility matrix confirmed for all package pairs. Only MEDIUM-confidence item: node-windows 1.0.0-beta.8 (old release, but functionally stable with 2.9k stars). |
| Features | HIGH | Thorough competitor analysis (BirdDog Cam Control, BirdDog Camera Director, AutoPTZ, StreamGeeks VRP) verified against official product pages and GitHub repos. Internal PRD/ARCHITECTURE.md/PROJECT.md are canonical sources. Anti-features identified from real-world live production pitfalls. |
| Architecture | HIGH | 3-tier outbound-tunnel pattern is industry-standard for IoT/edge. Component boundaries verified against existing autotracker binary analysis. Anti-patterns documented from real-world systems (AutoPTZ issues, OBS WebSocket docs). MEDIUM-confidence only on NDI PTZ specifics (page unavailable, verified through decompiled binary usage). |
| Pitfalls | HIGH | Verified against AutoPTZ GitHub issue tracker (issues #22, #14, #10, #9, #33 — directly relevant to same domain), OBS WebSocket error codes and reconnection patterns, general live production best practices. UX pitfalls informed by church live streaming operator workflow knowledge. |

**Overall confidence:** HIGH — Research is thorough and cross-validated across multiple source types (official docs, competitor repos, issue trackers, internal project specs, decompiled binary analysis).

### Gaps to Address

These areas couldn't be fully resolved during research and need attention during planning/implementation:

- **Autotracker source code lost:** Must be rebuilt from ARCHITECTURE.md spec. The spec is detailed (446 lines of architecture documentation including threading model, data flow, and NDI protocol usage) but reconstructing exact behavior requires iterative testing. **Mitigation:** Start Track B rebuild early (parallel with Phase 1); validate against the original tracker.exe behavior observed in the compiled binary.
- **No physical BirdDog camera for testing:** PTZ control implementation must be written against NDI SDK documentation spec, not verified against live hardware. **Mitigation:** Build with NDI emulation/test harness where possible; schedule hardware validation session before Phase 3 auto-director goes live; document all assumptions about NDI PTZ command behavior.
- **NDI SDK Python bindings:** The existing tracker.exe used `NDIlib.pyd` (compiled Python extension). Availability and API compatibility with the latest NDI SDK version needs verification. **Mitigation:** Research NDI SDK Python bindings during Track B planning; consider Node.js NDI bindings via `ffi-napi` as fallback if Python bindings are unavailable.
- **Streaming PC resource budget:** The combined load of OBS encoding + NDI video reception + autotracker GPU inference + local agent + FFmpeg on a single machine hasn't been profiled. **Mitigation:** Implement resource monitoring from Phase 4; establish safe thresholds (CPU <70%, VRAM headroom >500MB) with auto-throttle; document recommended PC specs.
- **Railway WebSocket connection limits:** Free tier may limit concurrent WebSocket connections. **Mitigation:** Single agent + few frontend clients should be within limits; monitor during Phase 1 deployment; Hobby plan upgrade if needed ($5/month).
- **OBS WebSocket plugin availability:** Assumes OBS WebSocket v5 plugin is installed on the streaming PC. **Mitigation:** Document as prerequisite in setup guide; agent should detect missing plugin at startup and surface clear error.

## Sources

### Primary (HIGH confidence)
- [Context7 /facebook/react] — React 19.2.0, JSX Transform, breaking changes
- [Context7 /vitejs/vite] — Vite 8.0.10, scaffolding, React-TS template
- [Context7 /expressjs/express] — Express 5.2.0, migration guide, native promises
- [Context7 /websockets/ws] — ws 8.21.0, server + client API, security fix
- [Context7 /remix-run/react-router] — React Router 7.9.4, routing patterns
- [Context7 /tailwindlabs/tailwindcss.com] — Tailwind CSS 4.3, Vite plugin
- [Context7 /wiselibs/better-sqlite3] — better-sqlite3 12.6.2, WAL mode, CRUD
- [Context7 /obs-websocket-community-projects/obs-websocket-js] — OBS WebSocket v5 API
- [npm: jsonwebtoken v9.0.3, bcrypt v6.0.0] — Auth implementation
- [PyPI: onnxruntime-directml v1.24.4] — GPU inference, Python ≥3.11
- [PyPI: opencv-python v4.13.0.92] — Computer vision
- [PyPI: Kivy v2.3.1] — GUI framework, Python 3.8-3.13
- [GitHub: websockets/ws releases] — v8.21.0 security fix details
- [BirdDog House of Worship] — Official product/solutions page
- [AutoPTZ/autoptz GitHub] — Competitor repo, real-world tracking issues
- [StreamGeeks/visual-reasoning-playground GitHub] — Competitor repo, PTZOptics API
- CamFlow PROJECT.md — Project overview, constraints, key decisions
- CamFlow PRD.md — Full feature specification, data model, non-functional requirements
- CamFlow ARCHITECTURE.md — Autotracker architecture spec, AI pipeline, threading model

### Secondary (MEDIUM confidence)
- [GitHub: coreybutler/node-windows] — v1.0.0-beta.8 (Aug 2022), functionally stable
- [BirdDog Cam Control product page] — Feature comparison
- [BirdDog Camera Director product page] — Feature comparison, EOL announced
- [ARCHITECTURE.md autotracker reference] — Source code lost, architecture spec only
- [OBS Studio backend documentation] — Video pipeline, encoder contention

### Tertiary (LOW confidence)
- [NDI SDK documentation (ndi.video)] — Page unavailable; PTZ functions confirmed via decompiled binary analysis only

---
*Research completed: 2026-05-29*
*Ready for roadmap: yes*
