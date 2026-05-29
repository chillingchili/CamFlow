---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
last_updated: "2026-05-29T06:25:07.737Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
---

# State: CamFlow

**Last updated:** 2026-05-29
**Project phase:** Phase 1 Foundation — all 3 plans complete

## Project Reference

**Core value:** Hands-off automated camera direction during church live streams — the camera operator stops operating and starts overseeing.

**Current focus:** Phase 1 Foundation complete. Operator frontend built (React 19 SPA with login, status bar, command panel). Ready for Phase 2: Core UI + Presets.

**Key constraints:**
- NDI protocol only (BirdDog camera, not VISCA)
- Windows platform (local agent + autotracker on streaming PC)
- No physical camera access (implement to NDI SDK spec, verify when hardware available)
- Single operator, shared passphrase auth
- Command latency <300ms cloud-to-PTZ, agent reconnect <30s, UI load <2s
- 2.5s default PTZ settle time (not 1s)

## Current Position

**Phase:** Phase 1 Foundation — all 3 plans complete
**Plan:** 3 of 3 plans complete (Phase 1)
**Status:** Phase 1 completed — cloud backend + agent + frontend all built

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-05-29 |
| 2. Core UI + Presets | 0/4 | Not started | - |
| 3. Auto-Director Engine | 0/3 | Not started | - |
| TB. Autotracker Rebuild | 0/4 | Not started (parallel) | - |
| 4. Sermon + Feed + Integration | 0/4 | Not started | - |
| 5. Remote Feed + Hardening | 0/2 | Not started | - |

```
Progress:  ░░░░░░░░░░░░░░░░░░░░ 0/6 phases planned
```

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Cloud-to-PTZ command latency | <300ms | — |
| Agent tunnel reconnect | <30s (max backoff) | — |
| UI initial load | <2s | — |
| FFmpeg CPU usage | <10% (hardware accelerated) | — |
| Autotracker false positive rate | 0 on empty-stage test | — |
| OBS frame drops during feed | 0 | — |
| Phase 01-foundation P01-01 | 8min | 3 tasks | 13 files |
| Phase 01-foundation P01-03 | 12min | 3 tasks | 22 files |
| Phase 01-foundation P03 | 12min | 3 tasks | 22 files |

## Accumulated Context

### Decisions Made

| Decision | Phase | Rationale |
|----------|-------|-----------|
| ACK protocol from Phase 1 | 1 | Pitfall 1 prevention — never fire-and-forget |
| 2.5s default settle time | 2 | Pitfall 2 prevention — mechanical PTZ needs 2-4s; 2.5s is conservative safe default |
| Cloud-hosted state machine | 3 | Survives frontend page reloads and operator logout (Pitfall 4) |
| Timer gates on ACKs, not wall-clock | 3 | Pitfall 1 — prevents auto-director advancing on failed commands |
| Autotracker as subprocess (not embedded) | 4 | Anti-pattern 5 prevention — Python/ONNX/DirectML is mature; Node.js ONNX is not |
| Hardware-accelerated FFmpeg (`d3d11va`) | 4 | Pitfall 5 prevention — software encoding competes with OBS |
| NDI protocol (not VISCA) | All | BirdDog camera uses NDI. ARCHITECTURE.md and original tracker.exe confirm |
| Two parallel tracks | TB | Autotracker has zero runtime dependencies on cloud app |
| Boundary range limit always active | TB | No toggle needed — if person leaves zone, zoom out. Range limit is default behavior |
- [Phase 01-foundation]: Used synchronous bcrypt.hashSync for DB seeding in better-sqlite3 context (sync API)
| React 19 + Vite 8 + Tailwind CSS 4 frontend | 1 (P01-03) | Operator SPA with modern stack; Vite proxy for dev API calls |
| `camflow_token` key in localStorage | 1 (P01-03) | Per CONTEXT.md locked decision for JWT storage |
| ACK-based optimistic UI pattern | 1 (P01-03) | Latest-command-wins: pending buttons replaced by newest command, confirmed on ACK, error flash on NACK |
| WebSocket health derived from message receipt | 1 (P01-03) | Agent=true when receiving messages, false on WS close; wasEverConnected flag avoids red indicators on first load |
- [Phase 01-foundation]: WebSocket URL derived from window.location (protocol-aware ws:// vs wss://) for Railway deployment compatibility

### Pitfalls Being Actively Avoided

| Pitfall | Prevention | Phase Addressed |
|---------|------------|-----------------|
| Tunnel SPOF | ACK protocol + heartbeat + stale queue rejection + local fallback | 1, 3, 5 |
| Mid-motion OBS cuts | 2.5s default settle + per-preset overrides + OBS fade transition | 2, 3 |
| Autotracker false positives | Confidence ≥0.65 + 3-frame temporal stability + head size sanity + range limit backstop | TB |
| JWT logout mid-service | Token refresh + state machine session-decoupled + login overlay | 1, 3, 5 |
| FFmpeg CPU competition | Hardware acceleration + low-res default + auto-pause + CPU monitoring | 4 |
| Railway SQLite ephemeral | Volume mount for persistent storage | 1 |

### Open Questions

- NDI SDK Python bindings (NDIlib.pyd) — availability and API compatibility with latest NDI SDK needs verification during Phase TB
- Streaming PC resource budget (OBS + NDI + autotracker + FFmpeg + agent) — profiling needed during Phase 4
- Railway WebSocket connection limits on free tier — monitor during Phase 1
- Actual BirdDog camera RTSP URL format — model-specific; needs hardware validation

### Technical Debt Tracking

| Item | Incurred | Due |
|------|----------|-----|
| Agent as console app during dev | Phase 1-3 | Must be service before Phase 4 testing |
| Fire-and-forget acceptable in prototype | Phase 1 dev | Must add ACKs before Phase 3 |
| conf_thresh=0.5 acceptable for dev | TB dev | Must be 0.65 for production |

## Session Continuity

**Last session:** 2026-05-29T06:25:07.734Z
**Next action:** `/gsd-plan-phase 2` (Core UI + Presets) or `/gsd-execute-phase 01-foundation` (Phase 1 complete)

**Phase 1 completion notes:**
- Cloud backend deployed to Railway (Express + ws + better-sqlite3)
- Local agent built (Node.js WebSocket tunnel + OBS/PTZ command relay)
- Operator frontend built (React 19 SPA with login, status bar, command panel)
- ACK protocol implemented end-to-end: cloud ↔ agent ↔ hardware
- All 3 plans complete with 94 total passing tests

---

*State initialized: 2026-05-29*
