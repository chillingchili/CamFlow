# Pitfalls Research

**Domain:** Automated PTZ camera direction + church live streaming automation
**Researched:** 2026-05-29
**Confidence:** HIGH (verified against AutoPTZ issue tracker, OBS WebSocket docs, project architecture)

---

## Critical Pitfalls

These cause rewrites, unrecoverable live-stream failures, or complete loss of operator trust.

### Pitfall 1: WebSocket Tunnel as Single Point of Failure

**What goes wrong:**
The cloud web app loses its WebSocket connection to the local agent. Since all commands flow cloud→agent, a dropped tunnel means the operator cannot control the PTZ, cannot switch OBS scenes, and cannot stop the autotracker — while the stream is live. The Auto-Director state machine running on the cloud has no awareness that commands never reached hardware, so it believes presets are still cycling when the camera is frozen in place.

**Why it happens:**
- Wi-Fi network blips during service (congestion from congregants' phones)
- Streaming PC enters power-saving sleep or Windows Update restarts the machine
- Railway cloud side restarts (deploy, crash, scaling event) during a service window
- WebSocket reconnect with exponential backoff takes longer than the timeout on a single preset dwell
- Agent correctly reconnects, but cloud-side state diverged — the queue replay causes stale commands

**How to avoid:**
1. **Heartbeat + timeout watchdog on both sides.** Agent sends a ping every 5 seconds (already specified). Cloud MUST detect when no pong/response arrives within 15 seconds and surface it as a critical error in the UI.
2. **Command acknowledgments — never fire-and-forget.** Every command sent cloud→agent must receive an explicit ACK. If no ACK within 2 seconds, the cloud retries or fails visibly. The auto-director timer must NOT advance unless the previous preset recall was acknowledged.
3. **Queue replay with staleness check.** When agent reconnects, it replays queued commands. But a 30-second-old "recall preset 3" is pointless if the auto-director has moved on. Queue entries need a timestamp; commands older than 15 seconds should be dropped, not replayed.
4. **Local fallback mode (Phase 5+).** The agent should have a minimal HTTP server on localhost that the operator can hit directly (phone on same WiFi) to issue basic Pause/Stop/Resume commands even when the cloud tunnel is down. Not full automation — just an emergency override.

**Warning signs:**
- "Agent connected" status flickers in dev testing
- Commands take >500ms when tunnel is healthy (indicates network instability)
- Agent logs show reconnection attempts during moderate network load
- Operator reports "the camera didn't move when I tapped" once — this is the canary

**Phase to address:**
- Phase 1 (basic tunnel): Implement ACK protocol and heartbeat from day one
- Phase 3 (auto-director): Timer must gate on ACKs, not wall-clock
- Phase 5 (hardening): Local fallback mode

---

### Pitfall 2: PTZ Preset Recall Without Settle Time Verification

**What goes wrong:**
The auto-director issues `recall preset 3`, waits exactly 1 second (the configurable `transition_delay`), then switches the OBS scene to the PTZ camera. But the camera servo hasn't finished moving — presets involving large pan/tilt/zoom changes take 2-4 seconds on mechanical PTZ hardware. Viewers see the camera mid-pan, mid-zoom. Worse: the 1-second delay is configurable but defaults to a value that works for small movements but fails badly for large preset jumps.

**Why it happens:**
- VISCA/NDI preset recall is a fire-and-forget command — there's no "movement complete" callback
- The transition delay assumes all presets take the same time to settle
- Testing is done with adjacent presets (small movements) while production services have presets at opposite ends of the room
- BirdDog cameras over NDI have variable PTZ speed based on camera model and firmware

**How to avoid:**
1. **Conservative default delay: 2.5 seconds, not 1.0.** The PRD currently defaults to 1s which is too aggressive for real-world use.
2. **Per-preset settle time overrides.** Allow each of the 8 preset slots to have an optional custom settle delay (settable in Setup). "Center stage → Drums" might need 3s; "Center stage → Stage Left" might need 1s.
3. **Fixed-delay approach, not "detect settled."** NDI PTZ does not expose a settled signal. Don't attempt motion detection from the RTSP feed to detect when the camera stopped — this is fragile, adds latency, and fails under lighting changes. Accept the fixed delay as good enough.
4. **OBS transition adds visual polish.** Use OBS's built-in 300ms fade transition on scene switches (not a hard cut). This masks any remaining sub-second timing imprecision.

**Warning signs:**
- While cycling presets in testing, viewer feedback says "the camera was still moving"
- Delays feel "too long" in testing with adjacent presets — resist the urge to shorten
- Specific preset pairs consistently show mid-motion frames

**Phase to address:**
- Phase 2 (core UI): Add per-preset settle time field to data model
- Phase 3 (auto-director): Implement preset-specific delays in the cycling state machine

---

### Pitfall 3: Autotracker Tracking Random Objects When Subject Leaves Frame

**What goes wrong:**
When the tracked person walks off-stage, the autotracker's head detection (YOLOv8) latches onto stage furniture, lighting fixtures, or microphone stands that have vaguely head-like shapes. The camera then pans/tilts/zooms toward a speaker stand or a wall sconce. This is the #1 reported issue in AutoPTZ's tracker (Issue #10: "tracking a random object when the individual is out of frame").

**Why it happens:**
- YOLOv8 head detector always returns the highest-confidence detection in frame, even if confidence is low
- No minimum confidence threshold is enforced ("it found something that's 35% a head — track it!")
- The existing architecture has a "maintain last position if no detection" idle behavior, but it only triggers on ZERO detections, not low-confidence ones
- The new range limit feature (boundary box → wide view on exit) doesn't help if the tracker is already tracking a false positive

**How to avoid:**
1. **Enforce a strict confidence floor.** Require confidence ≥ 0.65 for head detection to engage. Below that, treat it the same as zero detections — hold position. The current `conf_thresh=0.5` in ARCHITECTURE.md is too permissive.
2. **Temporal stability check.** The tracker must require 3 consecutive frames of confident detection before engaging a new target. A single-frame false positive on a light fixture collapses back to "no detection" on frame 2 — the camera never moves.
3. **Head size sanity check.** If a detected "head" box is >40% of frame width (a real person at a reasonable distance won't be that large), it's likely a false positive on nearby object.
4. **Range limit as secondary safety net.** The boundary box range limit acts as a final backstop — if the camera does drift to track a false positive, the range limit triggers the wide zoom-out before it drifts far enough to be embarrassing.

**Warning signs:**
- In testing, confidence scores on real heads hover near the threshold
- Camera occasionally "twitches" toward background objects (single-frame false positives getting through)
- Nose-pose model fails more often than head-detection (19-point landmarks on a chair look wrong — log the ratio of head-detection-pass to pose-detection-fail)

**Phase to address:**
- Track B (Autotracker rebuild): Implement confidence threshold, temporal stability, and size sanity check from the start
- Phase 4 (Sermon mode integration): Test with the actual pulpit camera view before deploying

---

### Pitfall 4: Cloud JWT Token Expiry During Service

**What goes wrong:**
The operator logs in 30 minutes before service, sets up presets, starts the auto-director. The JWT token expires after 12 hours (as designed) — but a cloud-side token validation error, server restart, or session invalidation causes the UI to log out mid-service. The operator sees a login screen instead of the live controls. The auto-director state machine on the cloud continues running, but the operator has zero visibility or control.

**Why it happens:**
- 12-hour expiry is fine for a single service, but server restarts lose in-memory token blacklists/validation state
- The system has a single shared passphrase — no concept of "session continuity" beyond the JWT
- Most JWT implementations validate on every request but the WebSocket connection may not re-validate after initial handshake
- The React frontend stores the token in localStorage and checks expiry client-side, but server-side invalidation is undetectable

**How to avoid:**
1. **Auto-director runs even without an active operator session.** The state machine is server-side and must NOT depend on an operator being logged in. The operator is an observer with override capability, not a required runtime dependency.
2. **Re-login must be seamless.** If the UI detects token expiry or server-side rejection, show a login overlay on top of the live view — don't redirect to a separate login page. The operator types the passphrase and the live controls reappear without losing state.
3. **WebSocket auth on reconnect.** When the agent WebSocket reconnects, re-authenticate with the shared secret. If the tunnel drops and reconnects, the agent must re-identify itself.
4. **Grace period on token expiry.** Accept tokens up to 30 minutes past expiry if the user was active (IP same, last request within 5 minutes). This prevents "I was mid-service and got logged out" scenarios.

**Warning signs:**
- Dev testing requires frequent re-logins — this shouldn't happen within a 2-hour window
- Server restart during testing causes all in-flight sessions to drop
- "Remember me" is not implemented (12 hours is fine for a single service, but token refresh within that window should be silent)

**Phase to address:**
- Phase 1 (basic auth): Implement JWT with refresh
- Phase 3 (auto-director): Ensure state machine decoupled from operator session
- Phase 5 (hardening): Login overlay instead of redirect

---

### Pitfall 5: FFmpeg Subprocess Consuming Streaming PC Resources

**What goes wrong:**
The local agent spawns an FFmpeg subprocess to transcode the PTZ RTSP stream into MJPEG for the operator's live feed. FFmpeg runs at high CPU, competing with OBS's encoding pipeline. During a service, OBS drops frames or the stream stutters because FFmpeg is consuming 25-40% CPU on the encoding PC. The operator's "nice to have" live feed degrades the viewer experience.

**Why it happens:**
- FFmpeg software-encodes the MJPEG stream (no hardware acceleration by default)
- OBS is also software-encoding the main stream to YouTube/Facebook
- A single streaming PC handles: OBS encoding + NDI video reception + autotracker GPU inference + local agent + FFmpeg
- The PRD acknowledges this as "a known trade-off" but doesn't specify resource limits

**How to avoid:**
1. **FFmpeg with hardware acceleration.** Use `-hwaccel d3d11va` or `-hwaccel qsv` (Intel QuickSync) on Windows to offload MJPEG encoding from CPU to GPU. This drops CPU usage from 25% to ~3%.
2. **Pause feed by default, not on-demand.** The live feed panel should default to PAUSED. The operator explicitly unpauses when they need to check framing. Auto-pause after 60 seconds of inactivity. The PRD says the feed is "collapsed by default in Live view" but doesn't specify the FFmpeg process should stop — just hiding the UI doesn't save CPU.
3. **Lower resolution and framerate for monitoring feed.** The operator doesn't need 1080p30 for framing reference. 640x360 at 5 FPS is sufficient for monitoring. This drastically reduces encode cost.
4. **CPU usage monitoring and auto-throttle.** The agent should monitor its own process CPU usage. If CPU exceeds 80% sustained, auto-pause the feed and notify the operator.
5. **Don't run FFmpeg on the streaming PC at all (Phase 5+).** Serve the RTSP stream directly via WebRTC from the camera (if BirdDog supports it) or use a separate low-power device (Raspberry Pi) as a dedicated stream relay.

**Warning signs:**
- In testing, OBS encoding lag increases when FFmpeg is running
- Streaming PC fan noise increases noticeably when feed is active
- Task Manager shows combined CPU usage >70% during test streams

**Phase to address:**
- Phase 4 (local live feed): Implement hardware-accelerated FFmpeg, low-res defaults, auto-pause behavior
- Phase 5 (remote feed + hardening): CPU monitoring, separate relay option

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code preset transition delay to 1s | Easy to implement, no per-preset config | Mid-motion OBS cuts, operator loses trust in automation | Never for production — at minimum use a conservative global default (2.5s) |
| Fire-and-forget PTZ commands (no ACK) | Simpler agent code, lower latency perception | Auto-director timer desyncs from hardware reality; silent failures | Only during Phase 1 prototype development; must add ACKs before Phase 3 |
| Agent command queue with infinite replay | Simple recovery logic | Stale 30-second-old commands re-execute, causing confusing camera jumps | Only with timestamp-based staleness rejection (commands >15s old are dropped) |
| Autotracker confidence threshold at 0.5 | Fewer "no detection" moments during demos | Tracker latches onto false positives (furniture, lights) — broadcast embarrassment | Never for production; 0.65 minimum with temporal stability |
| Single-passphrase auth with no token refresh | Simple implementation, no user management | Operator locked out mid-service, no recovery without manual intervention | Acceptable for Phase 1-2 development; add refresh and login overlay by Phase 3 |
| FFmpeg at full resolution and framerate | Best-looking monitoring feed during setup | Streaming PC CPU overload, OBS frame drops, viewer experience degraded | Never; monitoring feed should be 640x360 at 5 FPS by default |
| Agent running as a console app during development | Faster iteration, easier debugging | Service lifecycle not tested (startup order, crash recovery, Windows service context) | Acceptable through Phase 3; must be service-deployed before Phase 4 service testing |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **OBS WebSocket (obs-websocket-js)** | Assuming OBS WebSocket is always on port 4455 and auth is optional | Read OBS config at agent startup; support both authenticated and unauthenticated; handle auth failure (code 4008) with clear error in cloud UI |
| **OBS WebSocket (obs-websocket-js)** | Subscribing to all events, especially high-volume ones like InputVolumeMeters | Explicitly subscribe only to Scenes and Inputs events (as shown in Context7 docs); avoid volume meter subscriptions that flood the WebSocket |
| **BirdDog PTZ via NDI** | Mixing NDI PTZ and VISCA protocols | NDI PTZ commands send via `NDIlib_send_send_ptz()` with float pan/tilt/zoom values; VISCA is a completely different UDP binary protocol — the existing ARCHITECTURE.md correctly uses NDI but the PRD incorrectly references VISCA |
| **BirdDog PTZ via NDI** | Using NDI test/emulation sources (NDI Screen Capture, NDI Test Patterns) and expecting them to support PTZ commands | NDI PTZ control only works on real NDI PTZ cameras. Virtual/synthetic NDI sources don't respond to PTZ commands. The AutoPTZ issue #22 documents this exact confusion. |
| **RTSP Live Feed from PTZ** | Assuming all BirdDog cameras expose RTSP at a predictable URL | BirdDog cameras have model-specific RTSP URLs. The agent config must include the full RTSP URL, not just the camera IP. Some models require authentication on the RTSP stream. |
| **Python Subprocess (Autotracker)** | Spawning via `child_process.spawn()` and immediately sending commands before the Python/Kivy app is fully initialized | The autotracker must signal "ready" (via stdout or a local HTTP endpoint) before the agent sends any tracking commands. Startup time is 5-15 seconds depending on model loading. |
| **Windows Service (node-windows)** | Assuming the service runs with the same environment variables and PATH as the logged-in user | Windows services run in Session 0 with a restricted environment. Explicitly set PATH, PYTHON_HOME, and all NDI library paths in the service wrapper. Test by rebooting the machine and verifying the service starts without a user login. |
| **Railway Cloud Deploy** | Using Railway's filesystem for SQLite without a persistent volume | Railway's default filesystem is ephemeral (resets on deploy/restart). The `better-sqlite3` database MUST be on a Railway volume mount, or all preset configs are lost on every deploy. |
| **Kivy + DirectML GPU** | Assuming DirectML works on all Windows GPUs with the same performance | DirectML has varying performance across GPU vendors (NVIDIA >> AMD > Intel iGPU). Test on the actual streaming PC hardware. Fall back to CPU ONNX inference if DirectML initialization fails. |

---

## Performance Traps

Patterns that work in testing but fail under real conditions.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Agent command processing on single-threaded event loop** | PTZ commands queue up during heavy FFmpeg processing; 300ms latency target exceeded | Run PTZ command processing in its own worker thread; nothing in the main event loop should block PTZ dispatch | When FFmpeg spikes CPU; when OBS WebSocket responds slowly |
| **Autotracker runs AI inference + NDI capture + Kivy GUI on 2 threads** | GUI freezes during heavy inference; video feed stutters; PTZ commands lag | Already well-architected (3 threads: NDI receive, AI pipeline, Kivy GUI). Maintain this pattern. Ensure Python GIL isn't a bottleneck for NumPy operations. | When running on a machine without a discrete GPU, or when streaming at 4K |
| **Cloud WebSocket broadcasts to all connected clients** | With 1 operator this is fine; multi-operator (future) would need selective routing | Acceptable for v1 (single operator). Document that broadcast pattern exists so future developers know to refactor. | Not applicable for v1 (single operator) |
| **SQLite with better-sqlite3 for preset configs** | Lock contention if multiple writes occur simultaneously (e.g., rapid preset reorder drag) | better-sqlite3 is synchronous — fine for single-operator writes. Use WAL mode for better read concurrency. | When writes exceed ~50/second (not applicable for preset management) |
| **HLS/MJPEG served from local agent port** | Network congestion on church WiFi if multiple operator devices connect; local bandwidth consumption | Bind the feed to `127.0.0.1` only (not `0.0.0.0`); require operator to connect to the agent's machine, not serve to the whole network. For remote access, use WebRTC (Phase 5). | When >2 devices consume the local feed simultaneously |
| **Autotracker YOLOv8 inference on every frame** | GPU memory saturation if the streaming PC also runs OBS GPU encoding | Monitor VRAM usage. YOLOv8s (~12M params) should use ~500MB VRAM. If combined usage exceeds GPU RAM, DirectML falls back to CPU — catastrophic performance drop. Set OBS encoder to use a different GPU or reduce OBS GPU load. | When GPU has ≤4GB VRAM and OBS is also using GPU encoding |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Agent WebSocket tunnel uses shared secret in plaintext** | If someone captures the `.env` file or network traffic, they can impersonate the agent and control the church's PTZ camera and OBS remotely | Use HTTPS/WSS only (Railway provides TLS). Hash the shared secret in the `.env` file and compare hashes server-side. Rotate the secret periodically. |
| **Agent exposes FFmpeg HTTP server on `0.0.0.0`** | Anyone on the local church network can access the live camera feed without authentication | Bind MJPEG/HLS server to `127.0.0.1` only. For local network access in Phase 4, require the same JWT token from the cloud session. |
| **Autotracker subprocess runs with same privileges as agent** | If the autotracker Python process is compromised (unlikely but possible via model file or NDI injection), it has full access to the streaming PC | Run the autotracker in a separate restricted user context or use Windows sandboxing. Not critical for v1 (closed church environment). |
| **Cloud SQLite database accessible if Railway dashboard is compromised** | Preset configs and service log contain only operational data — no PII. Low risk. | Acceptable for v1. If service log includes operator IPs, consider log retention policy. |
| **No rate limiting on login endpoint** | Brute-force attack on the shared passphrase | Add exponential backoff after 5 failed attempts (1s, 2s, 4s, 8s...). Lock account (IP-based) for 15 minutes after 10 failures. |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Segment selector that immediately triggers camera movements** | Operator accidentally taps "Sermon" while in Worship — PTZ jerks to pulpit, autotracker activates, OBS cuts to PTZ. All while the worship band is still playing. | Add a confirmation step for segment transitions during active service: "Switch to Sermon mode? Camera will move to pulpit." Tap to confirm. The "Idle" segment should always be immediate (it's the panic button). |
| **Auto-director shows countdown but not which preset is next** | Operator knows "next cut in 5 seconds" but doesn't know where the camera will go — can't preemptively override if the next preset is wrong for that moment | Show the next preset name alongside the countdown: "Next: Drums (5s)" |
| **Hidden manual override controls** | During a crisis (camera tracking the wrong person), the operator can't find the manual PTZ joystick or camera switcher fast enough | Manual override (PTZ joystick + camera switcher) must be one tap away from EVERY screen — fixed bottom bar or slide-in panel, never buried in a menu |
| **Too many configuration options before first use** | Operator is overwhelmed by timing sliders, active/inactive toggles, preset naming before they've even seen the system work | Provide working defaults (dwell=15s, wide=8s, every 3 presets). Let the first-time flow be: name presets → set active toggles → go live. Config sliders are accessible but not required. |
| **Silent failure of PTZ commands** | Operator taps "recall preset 3" and nothing happens — no error, no feedback, just a frozen camera. They don't know if the command was sent, received, or failed. | Every command must have a visible state: "Sending..." → "Moving..." → "Settled" or "Failed." The preset indicator should grey out during transit. |
| **Too much information on the live view** | During service, the operator needs to monitor status at a glance. A cluttered UI with connection stats, logs, and config options forces cognitive load. | Live view shows only: active segment, current/next preset + countdown, camera switch buttons, and a single "Override" button. Everything else lives in Settings or Setup. |
| **Feed panel covering critical controls on mobile** | On a phone in portrait orientation, the live feed panel overlaps the camera switcher or segment selector | Feed is collapsible by default on mobile. When expanded, it pushes controls down rather than overlaying them. |

---

## "Looks Done But Isn't" Checklist

Things that appear complete in development but are missing critical pieces for production.

- [ ] **PTZ Preset Recall:** Appears working when tested with adjacent presets. Missing: verification against large-movement presets, timing variance across all 8 preset slots. Verify: test with the two farthest-apart presets and measure actual settle time.
- [ ] **WebSocket Reconnect:** Appears working when tested by killing and restarting the agent. Missing: behavior when cloud side restarts (agent detects and reconnects), behavior during exponential backoff while commands are queued. Verify: restart Railway during active auto-director cycle.
- [ ] **Autotracker Range Limit:** Appears working when tested with a single person walking in/out of frame. Missing: behavior when multiple people are in frame, when lighting changes mid-tracking, when the tracked person temporarily occludes another person. Verify: test with two people crossing paths.
- [ ] **Auto-Director Cycle:** Appears working with 8 active presets. Missing: behavior when only 1 preset is active, when 0 presets are active, when all presets are inactive. Edge case: what happens when the operator deactivates the current preset while it's the active shot? Verify: test all edge cases in the state machine.
- [ ] **Manual Override + Resume:** Appears working when tested once. Missing: behavior after multiple overrides, after switching modes and then resuming, after long pauses. Verify: override, switch to sermon, switch back to worship, confirm auto-director resumes correctly from the overridden state.
- [ ] **Windows Service Start on Boot:** Appears working when manually started. Missing: behavior when no user is logged in, when GPU drivers haven't loaded yet, when OBS hasn't started yet. Verify: reboot the streaming PC, don't log in, wait 5 minutes, check if agent is connected from cloud.
- [ ] **JWT Token Refresh:** Appears working in a 1-hour test. Missing: token behavior at 11.5 hours, during a server restart, when the operator's clock drifts. Verify: set token expiry to 10 minutes, run an auto-director cycle, confirm no interruption.
- [ ] **FFmpeg MJPEG Feed:** Appears working with a test RTSP stream. Missing: behavior when RTSP stream is unavailable (camera off, network issue), behavior when FFmpeg crashes, resource cleanup after FFmpeg crash. Verify: kill RTSP mid-feed, confirm agent detects and recovers without leaking FFmpeg processes.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cloud tunnel down mid-service | LOW (if local fallback exists) / HIGH (if no fallback) | 1. Operator walks to streaming PC. 2. Uses OBS directly for scene switching. 3. Uses BirdDog's native PTZ controller for camera. 4. After service: diagnose tunnel failure, add monitoring. |
| PTZ mid-motion OBS cut | LOW | 1. Operator taps "Cam 2 (wide)" to switch to safe shot. 2. Manually recalls preset or uses joystick to position. 3. Resumes auto-director from corrected state. |
| Autotracker tracking false target | LOW | 1. Manual override: tap Cam 2 (wide). 2. Stop autotracker from cloud UI. 3. Restart autotracker and re-select tracking target. |
| JWT logout mid-service | LOW | 1. Type passphrase on login overlay. 2. Resume where left off (state machine is server-side). 3. After service: add token refresh logic. |
| FFmpeg CPU overload | MEDIUM | 1. Pause feed from UI instantly. 2. OBS recovers within seconds. 3. After service: reconfigure FFmpeg with hardware acceleration and lower resolution. |
| Railway volume mount not configured | HIGH (all config lost) | 1. Re-enter all preset names, positions, timing settings. 2. This is a one-time data loss — config export/import feature needed to mitigate. |
| Windows service not starting after reboot | MEDIUM | 1. Operator RDPs or physically accesses streaming PC. 2. Checks Event Viewer for service errors. 3. Manually starts agent. 4. After service: fix service dependencies (delayed start, dependency on network). |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebSocket single point of failure | Phase 1: ACK protocol + heartbeat. Phase 3: Timer gates on ACKs. Phase 5: Local fallback. | Phase 3: Test auto-director cycling while killing agent. Verify state machine pauses, not advances blindly. |
| PTZ settle time too short | Phase 2: Per-preset settle time in data model. Phase 3: Conservative default (2.5s), per-preset overrides. | Phase 3: Time the two farthest presets on the actual BirdDog camera. Confirm delay ≥ measured settle time. |
| Autotracker false positives | Track B: Confidence ≥ 0.65, temporal stability (3 frames), head size sanity check. | Track B: Test with empty stage (no person). Confirm tracker stays idle, doesn't drift to furniture. |
| Cloud JWT logout | Phase 1: Token refresh. Phase 3: State machine decoupled from session. Phase 5: Login overlay. | Phase 3: Set token TTL to 10 minutes, run 30-minute auto-director cycle. Confirm no interruption. |
| FFmpeg CPU competition | Phase 4: Hardware acceleration, low-res default, auto-pause, CPU monitoring. | Phase 4: Run full test with OBS streaming + autotracker + FFmpeg. Confirm CPU <70% and no OBS frame drops. |
| PRD references VISCA instead of NDI | Phase 1: Agent implementation. | Phase 1: Verify agent sends NDI PTZ commands, not VISCA UDP packets. Correct PRD's tech stack section. |
| Service environment variables | Phase 1: node-windows service wrapper. | Phase 1: Reboot PC, don't log in, verify agent connects to cloud and responds to commands. |
| Railway SQLite ephemeral storage | Phase 1: Railway volume mount. | Phase 1: Deploy, add presets, redeploy. Confirm presets survive redeploy. |

---

## Sources

- **AutoPTZ/autoptz GitHub Issues** — Real-world tracking software pitfalls (issues #22, #14, #10, #9, #33). Directly relevant: same domain, same protocol (NDI), same use case (church camera tracking).
- **obs-websocket-js documentation** (Context7) — Error codes (4008 auth, -1 invalid subprotocol), reconnection patterns, event subscription best practices.
- **CamFlow Project Documents** — PROJECT.md (constraints: no physical camera, NDI protocol), PRD.md (feature specs, timing defaults, non-functional requirements), ARCHITECTURE.md (existing autotracker design: two-stage AI pipeline, threading model, DirectML backend).
- **OBS Studio backend documentation** — Video pipeline threading model, frame queue behavior, encoder contention awareness.
- **NDI SDK knowledge** — PTZ control is fire-and-forget (no settled callback), NDI test sources don't support PTZ, BirdDog cameras have model-specific RTSP URLs.
- **General live production knowledge** — Deterministic timing in broadcast is preferred over "detect settled" heuristics; manual override accessibility is safety-critical; monitoring feeds should never compete with production encoding.

---

*Pitfalls research for: CamFlow — automated PTZ camera director + church streaming*
*Researched: 2026-05-29*
