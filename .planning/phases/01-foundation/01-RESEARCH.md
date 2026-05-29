# Phase 1: Foundation — Technical Research

**Researched:** 2026-05-29
**Confidence:** HIGH

## Research Summary

Phase 1 is the backbone — cloud backend + local agent tunnel + ACK protocol + auth + basic HW control. Project-level research (STACK.md, ARCHITECTURE.md, PITFALLS.md) covers all patterns. This document consolidates the Phase-1-specific implementation details verified against Context7/library docs.

## Key Implementation Patterns

### 1. Express + WebSocket Server Attachment (ws 8.21)

Use `noServer` mode to share the Express HTTP server:

```typescript
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Agent WebSocket upgrade on /ws path
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/ws') {
    // Authenticate agent via token in query or headers
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT);
```

### 2. JWT Auth Middleware (Express 5.2 + jsonwebtoken 9.0.3)

```typescript
// Login: POST /api/auth/login
// Validates passphrase against bcrypt hash, returns JWT
const token = jwt.sign(
  { role: 'operator' },
  process.env.JWT_SECRET,
  { expiresIn: '12h' }
);

// Auth middleware for all other routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err?.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}
```

### 3. better-sqlite3 with WAL Mode

```typescript
import Database from 'better-sqlite3';
const db = new Database('camflow.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

### 4. ACK Protocol Design

Every cloud→agent command gets a UUID `requestId`. Agent responds with `{ type: "ack", requestId, status: "ok"|"error", error?: string }`. Cloud tracks pending commands in a Map. Timeouts: 5s PTZ, 2s OBS. Map cleanup on ack or timeout.

### 5. Agent WebSocket Client (ws 8.21)

```typescript
import WebSocket from 'ws';

function connect() {
  const ws = new WebSocket(CLOUD_WS_URL, {
    headers: { 'Authorization': `Bearer ${AGENT_SECRET}` }
  });
  
  ws.on('message', (data) => {
    const cmd = JSON.parse(data.toString());
    router.dispatch(cmd); // → OBS or PTZ handler
  });
  
  ws.on('close', () => setTimeout(connect, backoff.next()));
}

// Heartbeat every 5s
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'health', ...health.getSnapshot() }));
  }
}, 5000);
```

## Validation Architecture

### Test Categories for Phase 1

1. **Unit Tests (Vitest):** Auth middleware, token sign/verify, ACK timeout handling, agent command routing
2. **Integration Tests:** WebSocket tunnel connect/disconnect/reconnect, OBS scene switch via mock, preset recall flow
3. **E2E Tests (Playwright):** Login → see status bar → send preset recall → see ACK confirmation
4. **Load/Resilience:** Tunnel reconnect under jitter, stale command rejection, heartbeat continuity

### Nyquist Sampling Points

- `POST /api/auth/login` — valid passphrase → 200 + JWT; wrong → 401
- `GET /api/health` — requires valid JWT → 200; no token → 401
- Agent WebSocket connect — valid secret → connected; wrong → rejected
- Command ACK round-trip: send preset recall → receive ack within 5s
- Agent heartbeat: every 5s, cloud detects stale after 15s
- Tunnel reconnect: kill agent → cloud detects stale → agent reconnects → health clears

## Sources

- Context7 /websockets/ws — WebSocketServer noServer mode, upgrade handling, authentication
- Context7 /auth0/node-jsonwebtoken — sign with expiresIn, verify middleware, error types
- Context7 /wiselibs/better-sqlite3 — WAL mode, synchronous API, foreign keys
- CamFlow STACK.md — Version matrix, installation commands, alternatives considered
- CamFlow ARCHITECTURE.md — System overview, command relay pattern, project structure
- CamFlow PITFALLS.md — ACK protocol necessity, stale queue rejection, Railway volume mount
