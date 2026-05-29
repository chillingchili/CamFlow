# Phase 1: Foundation - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Cloud backend (Express + ws + SQLite on Railway) + local agent (Node.js Windows service) + WebSocket tunnel with ACK protocol + single-user authentication (passphrase + JWT) + basic OBS scene switching and PTZ preset recall/save via NDI. This is the backbone every other phase connects to.
</domain>

<decisions>
## Implementation Decisions

### Agent setup flow
- One-click installer (.exe) that installs the agent as a Windows service
- Installer wizard prompts for: cloud URL, shared secret, OBS WebSocket port + password, BirdDog PTZ IP
- Installer runs connectivity tests after config: pings cloud, tests OBS WebSocket, probes PTZ IP — shows green/red inline
- Connections can be skipped with warning if they fail; operator fixes later via web app settings
- Config stored in ProgramData/CamFlow/Agent — preserved on upgrade, option to wipe on reinstall
- Agent auto-updates from cloud: checks for new version on startup, downloads and replaces itself
- Uninstall via Windows Add/Remove Programs: stops service, removes files, offers to keep config
- System tray icon shows connection status; right-click for restart/quit

### Status bar design
- Fixed top bar across all pages — never scrolls away
- Three indicators: Agent connection, OBS connection, PTZ camera reachability
- Color + label: green dot + "Connected", orange dot + "Reconnecting", red dot + "Disconnected"
- Degraded states pulse the indicator while reconnecting

### Command feedback UX
- Optimistic UI: button highlights immediately on click, turns solid when ACK arrives, flashes red + reverts + shows toast on NACK
- Latest-command-wins: new command replaces pending one — most recent intent matters
- Error toasts: 5 seconds visible, new toast replaces previous one (no stacking)

### Login session handling
- JWT stored in localStorage, persists across browser restarts, 12-hour expiry
- On expiry: redirect to login page (Phase 5 will add login overlay)
- Remember session only — no passphrase persistence in browser
- Login screen: minimal centered card with CamFlow logo, passphrase field, Login button
- Show/hide toggle on passphrase field, inline red error text on wrong passphrase

### OpenCode's Discretion
- Exact installer technology (NSIS, WiX, Squirrel, etc.)
- Status bar exact spacing, font sizes, animation timing
- Toast component implementation
- Login page exact layout dimensions and logo styling
- System tray icon design
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
(None — greenfield project)

### Established Patterns
- Phase 1 establishes all patterns for subsequent phases:
  - ACK protocol: every command gets requestId, agent responds ack/nack within timeout
  - Heartbeat: 5-second interval, agent reports health status
  - Tunnel: persistent outbound WebSocket, exponential backoff reconnection (max 30s)
  - Auth: shared passphrase, bcrypt hashing, JWT HS256, 12-hour expiry

### Integration Points
- Cloud backend deploys to Railway with volume mount for SQLite persistence
- Local agent connects to cloud WebSocket URL (outbound only — no inbound ports)
- OBS integration: obs-websocket-js v5 protocol
- PTZ integration: NDI protocol (NDIlib_send_send_ptz for preset recall/save/pan/tilt/zoom)
- Agent installs as Windows service via node-windows (runs on boot, no login required)

### Key Constants (from research and roadmap)
- PTZ settle time: 2.5s default
- Command timeout: 5s PTZ, 2s OBS
- Heartbeat interval: 5s
- Tunnel stale threshold: 15s
- JWT expiry: 12 hours
- Tunnel reconnect: exponential backoff, max 30s interval
</code_context>

<specifics>
## Specific Ideas

- Installer should feel like a modern app installer — not a developer tool
- Operator should be able to install, configure, and confirm everything works without touching a text file
- Status bar should be glanceable from across the room on a tablet during service
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope
</deferred>

---
*Phase: 01-foundation*
*Context gathered: 2026-05-29*
