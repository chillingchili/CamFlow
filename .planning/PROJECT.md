# CamFlow

## What This Is

CamFlow is a two-track project for automating church live stream camera direction:

- **Track A — Web App:** Cloud-hosted director UI (React/Express/SQLite on Railway) that controls OBS scene switching and PTZ camera positioning through a local Node.js agent running on the streaming PC. Shifts the operator's role from constant manual control to pre-service setup and occasional oversight.
- **Track B — Autotracker:** A rebuilt Python/Kivy autotracker (ONNX Runtime + DirectML GPU inference, NDI protocol) with a new boundary box range limit. When the tracked person leaves the defined zone, the camera smoothly zooms out to a wide view instead of continuing to track.

Target camera: BirdDog PTZ via NDI protocol.

## Core Value

Hands-off automated camera direction during church live streams — the camera operator stops operating and starts overseeing.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Cloud web app controls OBS scenes and PTZ camera via local agent
- [ ] Local agent runs as Windows service, bridges cloud commands to OBS (WebSocket) and PTZ (NDI)
- [ ] Auto-director worship mode cycles PTZ presets on configurable timer with periodic wide cuts
- [ ] Sermon mode activates face tracking on pulpit with manual B-roll tap
- [ ] Autotracker rebuilt from ARCHITECTURE.md with GPU-accelerated inference pipeline
- [ ] Range limit: boundary box on normalized coordinates, smooth zoom-out to wide when person leaves zone
- [ ] Click-to-select face tracking (not automatic first-detection)
- [ ] Pre-service preset management (8 slots, drag reorder, active/inactive toggle)
- [ ] Manual PTZ joystick and camera switcher always available as override
- [ ] Live camera feed from PTZ RTSP via local agent (local network HLS/MJPEG, remote WebRTC)
- [ ] Single shared passphrase auth with JWT

### Out of Scope

- Multi-user / role-based access — single operator covers all needs
- Audio-triggered automatic switching — complexity exceeds v1 value
- AI director decisions — preset cycling is deterministic, operator chooses modes
- Native mobile app — web responsive covers phone/tablet/desktop
- Recording control (OBS start/stop) — operator handles manually
- Graphics / lower-third control — not in camera director scope
- Multiple church locations — single location, single streaming PC
- VISCA protocol — using NDI via BirdDog camera

## Context

**Existing autotracker (tracker.exe):** Compiled PyInstaller distribution in `C:\Users\hibye\Documents\Church\tracker.dist`. Architecture documented in `ARCHITECTURE.md` — two-stage AI pipeline (YOLOv8 head detection → 19-point nose pose), NDI camera control, Kivy GUI. Built as a fork/rewrite of AutoPTZ/autoptz (github.com/AutoPTZ/autoptz) but significantly different — replaced PySide6/dlib/VISCA with Kivy/ONNX Runtime/NDI. Source code was lost; must be rebuilt from the architecture spec.

**Current church workflow:** Operator manually clicks faces in autotracker, switches OBS scenes, monitors constantly throughout service. Cognitively demanding, requires dedicated person for full duration.

**PRD:** Full specification in `CamFlow PRD.md` — 5 original build phases, detailed feature breakdown, data model, non-functional requirements.

**No physical camera access:** PTZ control must be verified against NDI spec documentation, not live hardware.

## Constraints

- **Protocol — NDI**: BirdDog camera, PTZ commands via NDI (not VISCA)
- **Platform — Windows**: Local agent and autotracker run on Windows streaming PC
- **Testing**: No physical camera — implement to NDI SDK spec, verify when hardware available
- **Deployment**: Cloud app on Railway, local agent as Windows service, autotracker as Python app
- **Users**: Single operator (also admin), no permissions system needed
- **Performance**: Command latency <300ms cloud-to-PTZ, agent reconnect <30s, UI load <2s

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rebuild autotracker from ARCHITECTURE.md | Source lost, spec is detailed enough | — Pending |
| NDI protocol over VISCA | BirdDog camera uses NDI, autotracker already uses it | — Pending |
| Parallel tracks (web app + autotracker) | Both needed, independent enough to build concurrently | — Pending |
| Interactive mode (not YOLO) | User wants approval at every gate | — Pending |
| Range limit as default behavior | Always active, no toggle needed | — Pending |

---
*Last updated: 2026-05-29 after initialization*
