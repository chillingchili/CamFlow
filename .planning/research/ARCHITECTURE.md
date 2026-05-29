# Architecture Research

**Domain:** Cloud-controlled PTZ camera production system with local agent
**Researched:** 2026-05-29
**Confidence:** HIGH

## Standard Architecture

### System Overview

Cloud-controlled PTZ production systems follow a **3-tier outbound-tunnel architecture** — the dominant pattern in IoT/edge systems where hardware sits behind NAT/firewalls. The local agent initiates a persistent outbound connection to the cloud; cloud never connects inbound to the local network.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUD TIER (Railway)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │   React Frontend     │  │   Express Backend     │  │   SQLite DB      │   │
│  │  (Director UI, live  │  │  (REST API, WebSocket │  │  (presets,       │   │
│  │   view, preset mgr)  │  │   server, auth)       │  │   director cfg,  │   │
│  └──────────┬───────────┘  └──────────┬───────────┘  │   service log)   │   │
│             │                         │               └──────────────────┘   │
│             │  HTTP/REST              │ WebSocket (ws)                       │
│             └─────────────┬───────────┘                                      │
├───────────────────────────┼──────────────────────────────────────────────────┤
│                           │ PERSISTENT OUTBOUND TUNNEL (WSS)                 │
│                    Cloud does NOT connect in — agent connects out             │
├───────────────────────────┼──────────────────────────────────────────────────┤
│                  CHURCH LOCAL NETWORK (Windows Streaming PC)                  │
│                           │                                                  │
│  ┌────────────────────────┴─────────────────────────────────────────────┐   │
│  │                    LOCAL AGENT (Node.js Windows Service)               │   │
│  │  ┌──────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ WebSocket│  │ OBS         │  │ PTZ          │  │ Autotracker  │    │   │
│  │  │ Tunnel   │  │ Controller  │  │ Controller   │  │ Manager      │    │   │
│  │  │ Mgr      │  │ (obs-ws-js) │  │ (NDI SDK)    │  │ (subprocess) │    │   │
│  │  └────┬─────┘  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘    │   │
│  │       │               │                │                  │           │   │
│  │       │    ┌──────────┴────────────────┴──────────────────┘           │   │
│  │       │    │  Command Router: dispatch cloud cmd → correct handler     │   │
│  │       │    │  Status Reporter: push hardware state → cloud every 5s    │   │
│  │       │    └──────────────────────────────────────────────────────┘    │   │
│  └───────┼───────────────┼────────────────┼──────────────────┼───────────┘   │
│          │               │                │                  │               │
├──────────┼───────────────┼────────────────┼──────────────────┼───────────────┤
│                       HARDWARE TIER (Hardware)                               │
│  ┌───────┴──────┐  ┌────┴─────┐  ┌───────┴──────┐  ┌──────────┴──────────┐   │
│  │ Cloud App    │  │ OBS      │  │ BirdDog PTZ  │  │ Autotracker (.exe)  │   │
│  │ (via WSS)    │  │ (WS v5)  │  │ (NDI)        │  │ (Kivy, ONNX, NDI)  │   │
│  └──────────────┘  └──────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|---------------|------------------------|
| **Cloud Backend** | REST API for auth/config; WebSocket server for agent tunnels; broadcast agent state to frontend; persist presets/timing config | Express + ws (or Socket.IO) + better-sqlite3 |
| **Cloud Frontend** | Director UI: segment selector, preset grid, camera switcher, PTZ joystick, live feed panel, status bar | React + Tailwind CSS |
| **Local Agent** | Single process with 4 sub-responsibilities: tunnel management, OBS control, PTZ control, autotracker lifecycle | Node.js + node-windows (service wrapper) |
| **Agent Tunnel Mgr** | Maintain persistent WSS connection to cloud; auto-reconnect with exponential backoff; command queue during disconnect; 5s heartbeat | ws library or Socket.IO client |
| **Agent OBS Controller** | Scene switching via obs-websocket-js; connection state monitoring; independent failure handling | obs-websocket-js (WebSocket v5 protocol) |
| **Agent PTZ Controller** | NDI PTZ commands (pan/tilt/zoom); preset recall/save; UDP fallback for VISCA if BirdDog-specific API unavailable | NDI SDK (NDIlib_send_send_ptz) |
| **Agent Autotracker Mgr** | Spawn Python subprocess; monitor health; kill on command; restart on crash | child_process.spawn |
| **Agent Live Feed** | FFmpeg subprocess: RTSP → MJPEG (local); WebRTC peer connection (remote, Phase 5) | FFmpeg + node-webrtc |
| **Autotracker** | Two-stage AI pipeline (YOLOv8 → 19-point nose pose); NDI video receive; PTZ correction calculation; Kivy GUI | Python 3.10, ONNX Runtime + DirectML, NDI SDK, OpenCV, Kivy |

## Recommended Project Structure

```
camflow/
├── cloud/                     # Cloud-hosted web application (Railway)
│   ├── server/                # Express backend
│   │   ├── src/
│   │   │   ├── routes/        # REST API routes (auth, presets, settings, log)
│   │   │   ├── ws/            # WebSocket server: agent tunnel handler, frontend broadcast
│   │   │   ├── services/      # Business logic: director engine, preset manager
│   │   │   ├── db/            # SQLite schema, migrations, queries
│   │   │   └── middleware/     # JWT auth, error handler
│   │   └── package.json
│   └── client/                # React frontend
│       ├── src/
│       │   ├── pages/         # LiveView, Setup, Login
│       │   ├── components/    # SegmentSelector, PresetGrid, CameraSwitcher, PTZJoystick
│       │   ├── hooks/         # useWebSocket, useAgentState, useAuth
│       │   ├── services/      # API client, WebSocket client
│       │   └── state/         # Zustand or React Context stores
│       └── package.json
├── agent/                     # Local Windows agent (runs on streaming PC)
│   ├── src/
│   │   ├── tunnel.js          # WebSocket client: connect, reconnect, heartbeat, queue
│   │   ├── router.js          # Command dispatch: cloud cmd → hardware action
│   │   ├── obs.js             # OBS WebSocket v5 integration
│   │   ├── ptz.js             # NDI PTZ control (pan/tilt/zoom, presets)
│   │   ├── autotracker.js     # Python subprocess lifecycle management
│   │   ├── feed.js            # FFmpeg subprocess: RTSP → MJPEG (Phase 4)
│   │   ├── health.js          # Status reporter: aggregate all subsystem states
│   │   └── config.js          # .env loading, validation
│   ├── package.json
│   └── service.js             # node-windows service entry point
├── autotracker/               # Track B: rebuilt Python autotracker
│   ├── src/
│   │   ├── main.py            # Kivy application entry point
│   │   ├── inference/         # ONNX Runtime AI pipeline
│   │   │   ├── head_detect.py # YOLOv8 stage
│   │   │   └── nose_pose.py   # 19-point landmark stage
│   │   ├── ndi/               # NDI video receive, PTZ send
│   │   ├── tracking/          # PTZ correction, smoothing, dead-zone
│   │   ├── gui/               # Kivy UI (style.kv, widgets)
│   │   └── config.py          # default_config.json loader
│   ├── model/                 # ONNX model files
│   └── requirements.txt
└── .planning/                 # GSD planning artifacts
```

### Structure Rationale

- **cloud/ and agent/ are separate npm packages:** They share no runtime code; each has its own dependencies. Cloud deploys to Railway; agent installs on Windows. This prevents accidental Node.js version coupling.
- **agent/src/*.js are flat modules:** Each handles one hardware integration. A failure in `obs.js` must not crash `ptz.js` or the tunnel. Flat modules with independent error boundaries achieve this.
- **autotracker/ is a separate Python project:** It ships as a compiled PyInstaller `.exe`. The agent only needs to know the executable path and how to spawn/kill the process. No Python interpreter needed on the streaming PC at agent install time.
- **No shared code between tracks:** The cloud app and autotracker communicate only through the agent (subprocess spawn/kill). The autotracker runs standalone with its own NDI connections.

## Architectural Patterns

### Pattern 1: Outbound WebSocket Tunnel (Agent-Initiated Connection)

**What:** The local agent (behind NAT/firewall) initiates a persistent WebSocket connection to the cloud server. All commands flow cloud→agent over this tunnel. The cloud never needs to know the agent's IP or open firewall ports. This is the standard pattern for all IoT/edge-to-cloud communication.

**When to use:** Whenever hardware is behind a NAT/router and you need bidirectional command relay. Mandatory for church environments where the streaming PC is on a private LAN.

**Trade-offs:**
- Pro: No firewall configuration needed; works with any router; agent can reconnect transparently
- Pro: Agent identity authenticated once at connection — no per-request auth needed
- Con: Cloud cannot initiate contact during agent disconnect (need reconnection strategy)
- Con: Command latency bound by WebSocket round-trip (acceptable at <300ms target)

**Example (agent → cloud connect with reconnect):**
```javascript
// agent/src/tunnel.js — Socket.IO client
import { io } from "socket.io-client";

const socket = io(CLOUD_URL, {
  auth: { token: AGENT_SECRET },
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,        // start at 1s
  reconnectionDelayMax: 30000,    // cap at 30s
  randomizationFactor: 0.5,        // jitter to avoid thundering herd
});

socket.on("command", (cmd) => router.dispatch(cmd));
socket.on("disconnect", (reason) => {
  logger.warn(`Tunnel down: ${reason}. Queuing commands.`);
  commandQueue.enable();
});

setInterval(() => {
  if (socket.connected) {
    socket.emit("health", health.getSnapshot());
  }
}, 5000);
```

### Pattern 2: Command Relay with Acknowledgment

**What:** Cloud issues a command, agent executes it against hardware, agent sends back an acknowledgment (success/failure). The cloud UI only updates state after receiving the ack. This is a simplified two-phase commit — no rollback needed since hardware commands are idempotent or near-idempotent.

**When to use:** For any command where the cloud UI shows "pending" state until hardware confirms. Essential for preset recall (camera might be unreachable), OBS scene switch (OBS might not be running), and autotracker toggle (subprocess might fail to start).

**Trade-offs:**
- Pro: UI never lies about hardware state
- Pro: Natural error handling path — hardware failure surfaces immediately
- Con: Adds one RTT latency (acceptable — <300ms is the target anyway)
- Con: Edge case when agent reconnects mid-command — queue replay needed

**Example flow (preset recall):**
```
Cloud UI: "Recalling preset 3..." (pending state)
    ↓
Cloud Backend → WSS: { cmd: "preset_recall", preset: 3, requestId: "abc" }
    ↓
Agent Router → PTZ Controller: send NDIPTZ preset 3
    ↓
Agent PTZ Controller: hardware ack or timeout
    ↓
Agent → WSS: { type: "ack", requestId: "abc", status: "ok" }
    ↓
Cloud Backend → Frontend: state = "active", currentPreset = 3
```

### Pattern 3: Subprocess Lifecycle Management

**What:** The agent manages a heavyweight Python subprocess (the autotracker) with start/stop commands and health monitoring. The agent spawns the process, monitors its stdout/stderr for errors, checks it's alive periodically, and can kill and restart it. The autotracker is the only component not written in Node.js — it communicates with hardware directly (NDI) rather than through the agent.

**When to use:** When an existing compiled application (tracker.exe) needs to be controlled by a lighter-weight orchestrator. The autotracker runs independently once spawned — the agent is just lifecycle management.

**Trade-offs:**
- Pro: No need to rewrite working tracking logic in Node.js
- Pro: Independent failure domains — autotracker crash doesn't take down OBS control
- Pro: Easy to develop/debug autotracker standalone
- Con: Process management is fragile (zombie processes, graceful shutdown)
- Con: Two processes consuming GPU resources (must coordinate via process priority)

**Example (spawn, health check, kill):**
```javascript
// agent/src/autotracker.js
const { spawn } = require("child_process");

let trackerProcess = null;

function start() {
  trackerProcess = spawn(TRACKER_EXE_PATH, [], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  trackerProcess.on("exit", (code) => {
    logger.warn(`Autotracker exited with code ${code}`);
    trackerProcess = null;
  });
}

function isAlive() {
  return trackerProcess !== null && trackerProcess.exitCode === null;
}

function stop() {
  if (trackerProcess) {
    trackerProcess.kill("SIGTERM");
    setTimeout(() => {
      if (trackerProcess) trackerProcess.kill("SIGKILL");
    }, 5000);
  }
}
```

### Pattern 4: Independent Hardware Subsystems (Failure Isolation)

**What:** The local agent's four hardware integrations (OBS, PTZ, autotracker, live feed) are independent modules with their own error handling. A failure in one does not crash others or the tunnel. The agent's health reporter aggregates all subsystem states.

**When to use:** When hardware components are physically independent (camera ≠ OBS PC ≠ autotracker). A PTZ camera disconnect shouldn't prevent OBS scene switching.

**Trade-offs:**
- Pro: System partially functional during partial hardware failures
- Pro: Each module simple to test and debug independently
- Con: Aggregate health state can be ambiguous (is system "healthy" if PTZ is down but OBS works?)
- Con: Startup ordering subtle — tunnel must be established before any commands flow

**Example (health aggregation):**
```javascript
// agent/src/health.js
function getSnapshot() {
  return {
    tunnel: tunnel.isConnected(),
    obs: obs.isConnected(),
    ptz: ptz.isReachable(),
    autotracker: autotracker.isAlive(),
    feed: feed.isStreaming(),
    timestamp: Date.now(),
  };
}
```

## Data Flow

### Primary Command Flow (Cloud → Hardware)

```
Operator clicks "Preset 3" in React UI
    ↓
React → Express POST /api/preset/recall { preset: 3 }
    ↓
Express validates JWT, looks up preset 3 in SQLite
    ↓
Express → WSS: emit to agent socket: { cmd: "preset_recall", preset: 3, requestId: "xyz" }
    ↓
Agent tunnel receives command → router.js dispatches to ptz.js
    ↓
ptz.js: NDIlib_send_send_ptz() with preset recall parameters
    ↓
BirdDog camera executes mechanical movement
    ↓
ptz.js: detects movement complete (or timeout) → sends ack
    ↓
Agent → WSS: { type: "ack", requestId: "xyz", status: "ok" }
    ↓
Express receives ack → broadcasts new state to all frontend sockets
    ↓
React updates: preset indicator = "Center Stage (3)", countdown timer resets
```

### Status Flow (Hardware → Cloud, periodic)

```
Every 5 seconds:
    Agent health.js gathers all subsystem states
    Agent → WSS: { type: "health", subsystems: { obs: true, ptz: true, ... } }
    Express receives → stores latest snapshot in memory
    Express broadcasts to all connected frontend clients
    React status bar updates: green/grey/red indicators for each subsystem
```

### State Management Pattern

```
Cloud Backend is source of truth for:
  - Preset configurations (SQLite)
  - Director timing settings (SQLite)
  - Service log (SQLite)

Local Agent is source of truth for:
  - Hardware connection states
  - Autotracker process state
  - Live feed state

Frontend merges both via WebSocket events:
  - Cloud state: loaded on connect, updated via events
  - Agent health: pushed every 5s from agent
  - UI shows "pending" for in-flight commands awaiting ack
```

### Key Data Flows

1. **Command flow (cloud→hardware):** Synchronous request-ack pattern. Cloud waits for agent ack before updating UI state. Timeout: 5s for PTZ commands, 2s for OBS commands.

2. **Health heartbeat (hardware→cloud):** Periodic push (5s interval). Stateless — each push is a complete snapshot. Cloud marks agent "disconnected" after 15s without heartbeat.

3. **Director state machine (cloud-local):** Worship mode timer runs entirely in cloud backend. Each tick sends a command to agent (recall preset → wait settle → switch scene). The state machine is cloud-hosted so it survives frontend page reloads.

4. **Autotracker data (hardware-local only):** NDI video frames and PTZ commands stay on the local machine. No video or AI inference data flows to cloud. Only start/stop commands and health status cross the tunnel.

5. **Live feed (Phase 4-5):** Local: RTSP → FFmpeg → MJPEG served on localhost:PORT. Browser on same network connects directly to agent IP (bypasses cloud). Remote: WebRTC peer connection via cloud signaling server.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 church, 1 operator (current) | Monolith cloud backend is fine. SQLite is sufficient. Single agent, single WebSocket tunnel. No scaling concerns. |
| 1 church, 2-3 operator devices | Already supported — multiple frontend clients subscribe to same agent state via cloud WebSocket broadcast. No change needed. |
| 2-5 churches (multi-tenant) | Need: agent→church registration table, per-church credential isolation, likely PostgreSQL for multi-tenancy. Agent secret must be unique per church. Out of scope for v1. |
| 10+ churches | Consider: agent sharding (separate Railway instances per region), Redis for pub/sub between instances, connection pooling. Not relevant for v1. |

### Scaling Priorities

1. **First bottleneck:** WebSocket connection count on Railway free tier (often limited). Mitigation: Railway Hobby plan if needed. Not a concern at single-church scale.
2. **Second bottleneck:** SQLite write contention if multiple church operators hammer config updates. Mitigation: SQLite handles ~100 writes/sec fine; single operator means ~1 write/sec. No issue.
3. **Third bottleneck:** Live feed bandwidth if multiple remote viewers (Phase 5). Mitigation: single operator, single feed consumer. WebRTC is peer-to-peer so cloud bandwidth minimal.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| BirdDog PTZ Camera | NDI SDK (native C library via Python bindings or Node.js ffi) | Camera at static IP on local LAN. NDI discovery finds it. PTZ commands via `NDIlib_send_send_ptz()`. High confidence: documented in existing autotracker ARCHITECTURE.md. |
| OBS Studio | WebSocket v5 protocol via obs-websocket-js | Requires OBS WebSocket plugin installed and configured with port + password. Agent connects as WebSocket client on localhost. HIGH confidence: OBS docs confirm v5 protocol. |
| Autotracker (tracker.exe) | Subprocess spawn/kill | Agent spawns Python executable. Autotracker connects to NDI independently (its own NDI SDK). Agent only manages lifecycle. Compilation target: PyInstaller single-exe. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Cloud frontend ↔ Cloud backend | HTTP REST (auth, config CRUD) + WebSocket (agent state, live events) | REST for request-response; WebSocket for push updates. Don't use WebSocket for everything — REST is simpler for config CRUD. |
| Cloud backend ↔ Local agent | Single persistent WebSocket (WSS) | Outbound from agent. Agent authenticates with shared secret on connect. All commands and acks over this one tunnel. |
| Local agent ↔ OBS | WebSocket (localhost:4455) | Local connection, no TLS needed. Agent is WebSocket client, OBS is server. |
| Local agent ↔ PTZ camera | NDI (Ethernet, LAN) | UDP-based, low latency. Camera at static IP. Agent sends normalized float PTZ values. |
| Local agent ↔ Autotracker | OS process management | No IPC needed. Agent spawns/kills process. Autotracker's lifecycle is all that crosses this boundary. |
| Local agent ↔ FFmpeg (live feed) | Subprocess with pipe | Agent spawns FFmpeg, reads stderr for errors. FFmpeg serves MJPEG on localhost port. |
| Autotracker ↔ NDI camera | NDI SDK (direct) | Autotracker has its own NDI connection. Receives video frames, sends PTZ commands. Does NOT go through agent for NDI operations. |

## Anti-Patterns

### Anti-Pattern 1: Cloud-Initiated Connection to Agent

**What people do:** Cloud backend tries to open a TCP connection to the agent's IP address on the church LAN.

**Why it's wrong:** Church routers use NAT. The streaming PC's IP is private (192.168.x.x). Cloud can't route to it. Even with port forwarding, dynamic IPs break it. Security: exposing a port opens attack surface.

**Do this instead:** Agent initiates outbound WebSocket to cloud. Cloud never needs to know agent's IP. Works through any NAT. Single authenticated connection.

### Anti-Pattern 2: Agent as Monolithic Process

**What people do:** One big try-catch around all hardware integrations. If PTZ errors, the OBS connection goes down too.

**Why it's wrong:** Hardware failures are independent. Camera disconnected ≠ OBS crashed. The system should continue working with partial functionality.

**Do this instead:** Each hardware module has its own error boundary. `ptz.js` failure sets `ptz.status = "error"` in health and keeps retrying. `obs.js` continues uninterrupted. UI shows which subsystems are down.

### Anti-Pattern 3: Blocking the Tunnel with Video Data

**What people do:** Send NDI video frames over the WebSocket tunnel to display in the cloud UI.

**Why it's wrong:** WebSocket isn't designed for 30fps video streaming. 1080p NDI is ~150Mbps. The tunnel would saturate instantly. Cloud bandwidth costs would be enormous.

**Do this instead:** Live feed uses separate channels: local MJPEG (Phase 4, same network, no cloud bandwidth) or WebRTC (Phase 5, peer-to-peer). The tunnel carries commands and health data only — tiny JSON payloads.

### Anti-Pattern 4: Silent Command Failures

**What people do:** Fire-and-forget commands to hardware. UI assumes success.

**Why it's wrong:** Camera might be off. OBS might not be running. UI shows "preset 3 active" but camera hasn't moved. Operator makes decisions based on wrong state.

**Do this instead:** Every command has a requestId. Agent acks success/failure. UI shows "pending" until ack arrives, then transitions to "active" or "error". Timeout (5s) transitions to "unconfirmed" with retry option.

### Anti-Pattern 5: Autotracker Direct-Embed in Agent

**What people do:** Rewrite the Python autotracker in Node.js and embed it in the agent process.

**Why it's wrong:** ONNX Runtime with DirectML requires native C++ DLLs and GPU access. Node.js wrappers for ONNX (onnxruntime-node) exist but are immature for GPU acceleration on Windows. The Python ecosystem has mature ONNX + DirectML support. Rebuilding 446 lines of proven architecture adds months of risk.

**Do this instead:** Keep autotracker as a standalone Python process. Agent manages its lifecycle. If later migration to Node.js becomes worthwhile, the subprocess boundary makes it a clean swap.

## Build Order Implications

Based on component dependencies, the recommended build order is:

### Build Graph (dependency → dependent)

```
Cloud Backend (auth, DB, WSS)
    ↓
┌───────────────────────────────────────┐
│  Phase 1: Agent + OBS + PTZ basics    │
│  Depends on: Cloud Backend being up   │
│  Delivers: agent tunnel, scene switch,│
│            preset recall              │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  Phase 2: Core UI + preset management │
│  Depends on: Phase 1 (needs working   │
│              agent to test against)    │
│  Delivers: LiveView, Setup UI, manual │
│            PTZ joystick, cam switcher │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  Phase 3: Auto-director engine        │
│  Depends on: Phase 2 (needs preset    │
│              grid for timing config)   │
│  Delivers: Worship mode state machine │
│            entirely in cloud backend   │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  Phase 4: Sermon mode + autotracker   │
│  + local live feed                    │
│  Depends on: Phase 3 (needs segment   │
│              switching infrastructure) │
│  Depends on: Autotracker rebuilt from │
│              ARCHITECTURE.md spec      │
│  Delivers: Full service flow, Cam2    │
│            B-roll, FFmpeg MJPEG feed   │
│  NOTE: Autotracker can be built in    │
│        parallel with Phases 1-3!      │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  Phase 5: Remote feed + hardening     │
│  Depends on: Phase 4 (local feed is   │
│              prerequisite for remote)  │
│  Delivers: WebRTC, resilience, polish │
└───────────────────────────────────────┘
```

### Parallel Track: Autotracker

The autotracker (Track B) has **zero runtime dependencies** on the cloud app or local agent. It can be built concurrently with Phases 1-3:

- Autotracker connects to NDI directly (its own NDI SDK connection)
- Autotracker has its own Kivy GUI (no cloud UI dependency)
- Agent only needs the compiled `.exe` path for Phase 4 integration

**Recommended:** Start autotracker rebuild in parallel with Phase 1. By Phase 4, the autotracker should be compiled, tested, and ready for agent integration.

### Longest Dependency Chain

```
Cloud auth setup (1-2 days)
  → Agent tunnel + OBS control (3-5 days)
    → PTZ control via NDI SDK (3-5 days) 
      → Preset management CRUD + UI (3-5 days)
        → Director state machine (5-7 days)
          → Autotracker integration in agent (2-3 days)
            → Live feed FFmpeg (2-3 days)
              → WebRTC remote feed (3-5 days)
```

Critical path: ~30-35 days of sequential work. Autotracker rebuild (15-20 days) runs in parallel, not on critical path.

## Sources

- CamFlow PRD.md — Sections 3 (System Architecture) and 7 (Local Agent Specification) — project-specific, MEDIUM confidence (internal doc)
- ARCHITECTURE.md (autotracker) — Sections 4 (Operation Flow), 6 (Threading Model), 7 (NDI Protocol) — project-specific, HIGH confidence (from compiled binary analysis)
- Socket.IO v4 Documentation (Context7, /websites/socket_io_v4) — Reconnection patterns, heartbeat mechanism — HIGH confidence
- BirdDog API documentation (birddog.tv/api/) — RESTful API for camera control, Postman collections — MEDIUM confidence (marketing page, not full API spec)
- OBS Studio Documentation (docs.obsproject.com) — Backend design, video pipeline — HIGH confidence
- NDI SDK documentation (ndi.video) — 404 on docs page, but NDI PTZ control functions confirmed via existing autotracker binary analysis — LOW confidence (page unavailable, verified through decompiled usage)

---
*Architecture research for: CamFlow — cloud-controlled PTZ camera director*
*Researched: 2026-05-29*
