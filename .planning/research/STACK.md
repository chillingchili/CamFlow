# Stack Research

**Domain:** Cloud-controlled PTZ camera director app with local agent architecture
**Researched:** 2026-05-29
**Confidence:** HIGH

## Recommended Stack

### Track A — Cloud Web App (Node.js + React + TypeScript)

#### Core Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | Current LTS line, stable on Railway, supports ESM natively. Railway deploys Node 22 by default. |
| TypeScript | 5.7+ | Language | Catches PTZ command protocol bugs at compile time. JWT payloads, WebSocket message types, and OBS scene names all benefit from strict typing. Express 5 has built-in TS support via @types/express. |
| Vite | 8.0.10 | Build tool | Create React App is officially deprecated. Vite provides instant HMR, native ESM, and the `@tailwindcss/vite` plugin for Tailwind v4. `npm create vite@latest -- --template react-ts` is the canonical bootstrap. |
| React | 19.2.0 | UI framework | Latest stable. React 19 removes deprecated APIs (propTypes, defaultProps, string refs). New JSX Transform is required. Server Components NOT used — this is a pure SPA dashboard. |
| React Router | 7.9.4 | Client routing | Latest major version. Uses `createBrowserRouter` + `RouterProvider` pattern. Simple routing for 2-3 pages (Live, Setup, Login). |
| Tailwind CSS | 4.3.x | Styling | Utility-first CSS. v4 has zero-config setup with Vite via `@tailwindcss/vite` plugin. No `tailwind.config.js` needed — config is CSS-first in v4. Responsive design for tablet/phone/desktop from the PRD is trivial with Tailwind breakpoints. |
| Express | 5.2.0 | HTTP server | Latest stable major version. Express 5 has native promise support for route handlers, simplified error handling, and the `req.query` parser default changed to `'simple'`. Used for REST API endpoints (auth, preset CRUD, settings) and as the base HTTP server that the WebSocket server upgrades from. |
| ws | 8.21.0 | WebSocket server + client | The standard for raw WebSocket in Node.js. Used on BOTH sides: server-side in the cloud backend (handles agent tunnel) and client-side in the local agent (connects to cloud). v8.21.0 includes a critical security fix for DoS via memory exhaustion. NOT socket.io — socket.io adds protocol overhead and fallback transports we don't need (single client, known environment). |
| better-sqlite3 | 12.6.2 | Database | Synchronous API, fastest SQLite driver for Node.js. No connection pool needed for single-user app. WAL mode enabled by default for concurrent reads. Stores presets, director settings, and service logs. |

#### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonwebtoken | 9.0.3 | JWT signing/verification | Auth endpoint: sign token on login, verify on every API request via Express middleware. HS256 algorithm with shared secret (no RSA key management needed for single-user app). |
| bcrypt | 6.0.0 | Password hashing | Hash the shared passphrase before storing. Use async API (bcrypt.hash/bcrypt.compare) to avoid blocking the event loop. Salt rounds: 10. |
| obs-websocket-js | latest | OBS WebSocket v5 client | Used in local agent only. Connects to OBS at `ws://localhost:4455`, calls `SetCurrentProgramScene` to switch cameras. Typed API with full TypeScript support. |
| node-windows | 1.0.0-beta.8 | Windows service wrapper | Installs the local agent as a Windows background service. Uses winsw under the hood. Starts on boot, auto-restarts on crash. Despite being a beta from Aug 2022, it's the standard tool (2.9k stars, 367 forks) and functionally stable for our use case. |
| env-var validation | — | Runtime config check | Validate .env vars at startup (cloud URL, shared secret, OBS password, PTZ IP). Use `process.env` directly + a validation block. No library needed — single-user app with 5-6 env vars. |

#### Authentication

| Technology | Version | Purpose |
|------------|---------|---------|
| Shared passphrase | — | Single password stored as bcrypt hash in SQLite. Operator enters passphrase on login page. |
| JWT (HS256) | 9.0.3 | Signed token returned on successful login. Stored in browser localStorage. 12-hour expiry. Validated on every API call via Express middleware. |

#### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint | Linting | Vite React-TS template includes ESLint config. Enable type-aware lint rules for production. |
| TypeScript | Type checking | Strict mode (`strict: true`). Catches protocol shape mismatches. |
| Railway CLI | Deployment | `railway up` deploys from project root. Railway auto-detects Node.js and runs the `start` script. |

### Track A — Local Agent (Windows, Node.js)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | Same version as cloud for consistency. |
| ws (client) | 8.21.0 | WebSocket tunnel to cloud | Persistent auto-reconnecting WebSocket client. Reconnection: exponential backoff (1s → 2s → 4s → 8s → 16s → 30s cap). Commands queued during disconnect, replayed on reconnect. |
| obs-websocket-js | latest | OBS scene switching | Calls `obs.call('SetCurrentProgramScene', { sceneName })`. Monitors OBS connection via `obs.on('ConnectionClosed')`. |
| NDI SDK | Vendor (BirdDog) | PTZ camera control | BirdDog cameras use NDI protocol natively. PTZ commands via `NDIlib_send_send_ptz()` — NOT VISCA. The PRD specified VISCA for a Canon camera; the actual hardware is BirdDog NDI. This is the critical protocol correction. |
| node-windows | 1.0.0-beta.8 | Install as Windows service | `svc.install()` registers the agent. Auto-start on boot, survives logout. Config via `.env` file read at startup. |
| FFmpeg | System install | RTSP → MJPEG transcoding | Spawned as child process. Reads PTZ RTSP stream, serves MJPEG on `localhost:8080`. Used for local network live feed (Phase 4). |
| child_process (Node built-in) | — | Subprocess management | Spawn FFmpeg for feed relay. Spawn Python process for autotracker. Kill gracefully on shutdown. |

### Track B — Autotracker (Python, Windows)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12 | Runtime | Sweet spot: ONNX Runtime DirectML 1.24.4 supports 3.11-3.14, Kivy 2.3.1 has wheels for 3.8-3.13, OpenCV 4.13 has wheels for 3.7-3.14. Python 3.12 is the most tested intersection. 3.13 is newer but Kivy 2.3.1 has wheels for it; 3.12 is the safer conservative choice. |
| Kivy | 2.3.1 | GUI framework | OpenGL-accelerated UI for real-time video texture rendering. Same framework the original tracker.exe used. SDL2 + GLEW backend on Windows. Kivy 2.3.1 (Dec 2024) is the latest stable release. |
| ONNX Runtime DirectML | 1.24.4 | GPU inference engine | Microsoft's DirectML backend for hardware-accelerated inference on ANY GPU (AMD, NVIDIA, Intel) via DirectX 12. No CUDA dependency. v1.24.4 is the latest (Mar 2026). Replaces the original's older ONNX Runtime version. |
| OpenCV | 4.13.0.92 | Computer vision | Frame capture, resize, normalization, NMS filtering. Latest stable (Feb 2026). Use `opencv-python` (standard package with GUI support, since Kivy handles the display). |
| NumPy | (bundled) | Array operations | Installed as dependency of ONNX Runtime and OpenCV. Frame format conversions, normalization. |
| NDI SDK | Vendor (BirdDog) | Camera video + PTZ | `NDIlib_recv_capture()` for video frames, `NDIlib_send_send_ptz()` for camera control. Proprietary SDK from NewTek/BirdDog. Must match the version installed on the streaming PC. |
| PyInstaller | 6.x | Single-exe packaging | Bundle Python app + all dependencies into a single `.exe`. The original tracker.exe was 27MB PyInstaller output. Modern PyInstaller 6.x supports Python 3.12. |

#### AI Model Files (from ARCHITECTURE.md)

| Model | File | Architecture | Input | Purpose |
|-------|------|-------------|-------|---------|
| Head Detection | `head_640_v8s.onnx` | YOLOv8 small | 640×640 RGB | Locate person(s) in frame |
| Facial Landmarks | `nose-pose19Ps.onnx` | 19-point keypoint | Head crop region | Precise nose tracking point |

These ONNX models are format-compatible with ONNX Runtime 1.24.4. No retraining needed — the models are input to the inference engine, not tied to a specific runtime version.

## Installation

### Track A — Cloud Web App

```bash
# Core
npm create vite@latest camflow-web -- --template react-ts
cd camflow-web
npm install react-router@^7.9.4 @tailwindcss/vite@latest tailwindcss@latest
npm install express@^5.2.0 ws@^8.21.0 better-sqlite3@^12.6.2
npm install jsonwebtoken@^9.0.3 bcrypt@^6.0.0

# Dev dependencies
npm install -D @types/express @types/ws @types/better-sqlite3 @types/jsonwebtoken @types/bcrypt
npm install -D typescript@^5.7 eslint
```

### Track A — Local Agent

```bash
npm install ws@^8.21.0 obs-websocket-js@latest
npm install node-windows@^1.0.0-beta.8
npm install -D @types/ws
```

### Track B — Autotracker

```bash
# Windows x64, Python 3.12
pip install kivy==2.3.1
pip install onnxruntime-directml==1.24.4
pip install opencv-python==4.13.0.92
pip install numpy psutil pyinstaller

# NDI SDK must be installed separately from BirdDog/NewTek
# Download from: https://www.ndi.tv/sdk/
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | Vite 8 | Create React App | CRA is officially deprecated. No new features, stale dependencies. |
| CSS framework | Tailwind CSS 4 | CSS Modules / styled-components | Tailwind is faster for responsive dashboard UI. No runtime cost. The v4 Vite plugin is zero-config. |
| WebSocket | ws 8.21 | Socket.IO | Socket.IO adds protocol overhead (polling fallback, rooms, namespaces) we don't need. Single client, known WebSocket-capable environment. ws is lighter and faster. |
| State management | React Context + useState | Redux / Zustand | App state is simple: current mode, agent status, preset list, timer. No complex state graphs. Context + hooks sufficient. |
| Database | SQLite (better-sqlite3) | PostgreSQL | Single-user app with simple schema (presets, settings, logs). SQLite needs no server process, perfect for Railway's ephemeral filesystem (backed by volume). Postgres is overkill. |
| Python version | 3.12 | 3.13 / 3.14 | 3.12 has wheels for ALL packages (Kivy, ONNX Runtime, OpenCV). 3.13/3.14 have partial Kivy support but edge cases exist. |
| GUI framework | Kivy 2.3.1 | PySide6 / Tkinter / CustomTkinter | Kivy has native OpenGL video texture support. The original tracker.exe used Kivy — architecture spec is Kivy-based. PySide6 lacks built-in NDI frame rendering. |
| PTZ protocol | NDI | VISCA | The actual camera is BirdDog, which uses NDI natively. VISCA is for Canon/Sony cameras. The PRD is outdated on this point — PROJECT.md and ARCHITECTURE.md both specify NDI. |
| Python packaging | PyInstaller | Nuitka / cx_Freeze | The original tracker.exe used PyInstaller. Proven pattern for this specific project. PyInstaller 6.x supports Python 3.12. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Create React App | Officially deprecated. No React 19 support. | Vite 8 with react-ts template |
| Socket.IO | Adds unnecessary protocol overhead. Polling fallback not needed. | ws (raw WebSocket) |
| Express 4.x | Missing native promise support, req.query parsing issues. Express 5 is stable since Sep 2024. | Express 5.2.0 |
| VISCA protocol | BirdDog camera uses NDI. Sending VISCA packets to a BirdDog would fail silently. | NDI SDK |
| Python 3.10 | The original tracker.exe used 3.10 but ONNX Runtime DirectML 1.24.4 requires Python >=3.11. | Python 3.12 |
| PostgreSQL / MySQL | Requires a separate database server. Adds deployment complexity. Single-user app doesn't benefit. | SQLite via better-sqlite3 |
| Redux / Zustand | App state is too simple to justify a state management library. 2-3 pages, no complex state graphs. | React Context + useState |
| Next.js | SSR and file-based routing add complexity for a dashboard SPA that has no SEO or server-rendering needs. | Vite + React SPA |
| Electron (for local agent) | Massive bundle size, Chromium overhead. The local agent is a headless Windows service, not a desktop app. | Node.js + node-windows |
| Webpack | Slower builds, complex config. Vite is the standard for new React projects. | Vite 8 |
| Python virtual environment via venv | Works fine, but `pyinstaller` bundles everything anyway. | N/A — use venv during development, PyInstaller for distribution |

## Version Compatibility Matrix

| Package A | Version | Package B | Version | Compatible? |
|-----------|---------|-----------|---------|-------------|
| React | 19.2.0 | React Router | 7.9.4 | YES — React Router 7 supports React 18+19 |
| React | 19.2.0 | Tailwind CSS | 4.3.x | YES — independent concerns |
| Vite | 8.0.10 | @tailwindcss/vite | latest | YES — official Vite plugin |
| Express | 5.2.0 | ws | 8.21.0 | YES — ws server can attach to Express HTTP server |
| Node.js | 22 LTS | better-sqlite3 | 12.6.2 | YES — better-sqlite3 supports Node 20+ |
| Python | 3.12 | ONNX Runtime DirectML | 1.24.4 | YES — wheel available for cp312-win_amd64 |
| Python | 3.12 | Kivy | 2.3.1 | YES — wheel available for cp312-win_amd64 |
| Python | 3.12 | OpenCV | 4.13.0.92 | YES — wheel available for cp37-abi3-win_amd64 |
| ONNX Runtime | 1.24.4 | YOLOv8 ONNX models | existing | YES — ONNX format is version-independent |

## Stack Patterns by Component

**If building the cloud backend:**
- Use Express 5 for REST endpoints (auth, presets CRUD, settings CRUD)
- Use ws.Server attached to the Express HTTP server for the WebSocket tunnel
- Use better-sqlite3 with WAL mode for all data
- JWT middleware on every route except `/api/auth/login`

**If building the local agent:**
- Use ws client for persistent outbound tunnel to cloud
- Use obs-websocket-js for OBS scene switching
- Use NDI SDK for PTZ camera control
- Use node-windows Service API for Windows service registration
- All commands received over WebSocket, executed locally, status sent back

**If building the autotracker:**
- Use Kivy for the GUI window with OpenGL video texture
- Use ONNX Runtime DirectML for GPU-accelerated inference
- Use OpenCV for frame preprocessing (resize, normalize, NMS)
- Use NDI SDK for video capture and PTZ commands
- Package with PyInstaller into single .exe

**If deploying:**
- Cloud: Railway (auto-detects Node.js, runs `npm start`)
- Local Agent: Install as Windows service via `node agent.js --install`
- Autotracker: Distribute as PyInstaller .exe, run manually or spawned by local agent

## Sources

- [Context7 /facebook/react] — React 19.2.0 version, breaking changes, JSX Transform requirement — **HIGH confidence**
- [Context7 /vitejs/vite] — Vite 8.0.10 version, scaffolding command, React-TS template — **HIGH confidence**
- [Context7 /expressjs/express] — Express 5.2.0 version, Express 5 migration guide, API changes — **HIGH confidence**
- [Context7 /websockets/ws] — ws 8.21.0 (latest release), WebSocket server + client API, auto-reconnect pattern — **HIGH confidence**
- [Context7 /remix-run/react-router] — React Router 7.9.4, BrowserRouter + Routes + Route pattern — **HIGH confidence**
- [Context7 /tailwindlabs/tailwindcss.com] — Tailwind CSS v4.3, @tailwindcss/vite plugin installation — **HIGH confidence**
- [Context7 /wiselibs/better-sqlite3] — better-sqlite3 12.6.2, synchronous API, WAL mode, CRUD operations — **HIGH confidence**
- [Context7 /obs-websocket-community-projects/obs-websocket-js] — obs-websocket-js API, connect + call pattern, SetCurrentProgramScene — **HIGH confidence**
- [npm: jsonwebtoken] — v9.0.3, JWT sign/verify/decode API — **HIGH confidence**
- [npm: bcrypt] — v6.0.0, async hash/compare API, salt rounds — **HIGH confidence**
- [PyPI: onnxruntime-directml] — v1.24.4 (Mar 2026), Python >=3.11 requirement, cp311-cp314 win_amd64 wheels — **HIGH confidence**
- [PyPI: opencv-python] — v4.13.0.92 (Feb 2026), cp37-abi3 win_amd64 wheel — **HIGH confidence**
- [PyPI: Kivy] — v2.3.1 (Dec 2024), Python 3.8-3.13 support, cp312 win_amd64 wheel — **HIGH confidence**
- [GitHub: websockets/ws releases] — v8.21.0 release notes (May 22, 2026), security fix for DoS — **HIGH confidence**
- [GitHub: coreybutler/node-windows] — v1.0.0-beta.8 (Aug 2022), Windows service API, winsw-based — **MEDIUM confidence** (old release, but functionally stable)
- [ARCHITECTURE.md] — Existing autotracker stack reference (Kivy, ONNX Runtime DirectML, NDI, YOLOv8 models) — **MEDIUM confidence** (source code lost, architecture spec only)
- [PROJECT.md] — BirdDog camera confirmed, NDI protocol confirmed, VISCA is NOT used — **HIGH confidence**

---
*Stack research for: CamFlow — cloud-controlled PTZ camera director app*
*Researched: 2026-05-29*
*Confidence: HIGH — all versions verified against Context7, npm, PyPI, and GitHub releases*
