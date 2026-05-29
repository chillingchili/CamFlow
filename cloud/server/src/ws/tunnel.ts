import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';

// ===== TYPES =====
export interface PendingCommand {
  requestId: string;
  command: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'ok' | 'error' | 'stale';
  error?: string;
}

export interface AgentState {
  connected: boolean;
  lastHeartbeat: number | null;
  health: {
    obs: boolean;
    ptz: boolean;
  };
}

// ===== STATE =====
let wss: WebSocketServer;
let agentSocket: WebSocket | null = null;
const frontendClients = new Set<WebSocket>();
const pendingCommands = new Map<string, PendingCommand>();

const agentState: AgentState = {
  connected: false,
  lastHeartbeat: null,
  health: { obs: false, ptz: false },
};

// ===== UPGRADE AUTHENTICATION =====
function authenticateUpgrade(request: IncomingMessage): { ok: boolean; role?: string; statusCode?: number; message?: string } {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token');

  if (!token) {
    return { ok: false, statusCode: 401, message: 'No token provided' };
  }

  if (url.pathname === '/ws') {
    // Agent authentication — uses shared secret
    const agentSecret = process.env.AGENT_SHARED_SECRET;
    if (!agentSecret) {
      return { ok: false, statusCode: 500, message: 'Server not configured' };
    }
    if (token !== agentSecret) {
      return { ok: false, statusCode: 401, message: 'Invalid agent token' };
    }
    return { ok: true, role: 'agent' };
  }

  if (url.pathname === '/frontend') {
    // Frontend authentication — uses JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return { ok: false, statusCode: 500, message: 'Server not configured' };
    }
    try {
      jwt.verify(token, jwtSecret);
      return { ok: true, role: 'frontend' };
    } catch {
      return { ok: false, statusCode: 401, message: 'Invalid JWT token' };
    }
  }

  return { ok: false, statusCode: 404, message: 'Unknown path' };
}

// ===== STALE COMMAND REJECTION =====
const STALE_THRESHOLD_MS = 15_000;
let staleCheckInterval: ReturnType<typeof setInterval> | null = null;

function startStaleChecker(): void {
  if (staleCheckInterval) return;
  staleCheckInterval = setInterval(() => {
    const now = Date.now();
    for (const [requestId, cmd] of pendingCommands) {
      if (cmd.status === 'pending' && now - cmd.timestamp > STALE_THRESHOLD_MS) {
        cmd.status = 'stale';
        cmd.error = 'Command timed out';
        broadcastToFrontend({
          type: 'command_result',
          requestId,
          status: 'stale',
          error: 'Command timed out',
        });
        pendingCommands.delete(requestId);
      }
    }
  }, 5000);
}

// ===== PUBLIC API =====
export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const auth = authenticateUpgrade(request);

    if (!auth.ok) {
      socket.write(`HTTP/1.1 ${auth.statusCode} ${auth.message}\r\n\r\n`);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, auth.role);
    });
  });

  wss.on('connection', (ws, request, role: string) => {
    if (role === 'agent') {
      // Only one agent connection at a time
      if (agentSocket && agentSocket.readyState === WebSocket.OPEN) {
        agentSocket.close(1000, 'New agent connected');
      }
      agentSocket = ws;
      agentState.connected = true;
      agentState.lastHeartbeat = Date.now();

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          handleAgentMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        if (agentSocket === ws) {
          agentSocket = null;
          agentState.connected = false;
          agentState.lastHeartbeat = null;
          agentState.health = { obs: false, ptz: false };

          broadcastToFrontend({
            type: 'agent_disconnected',
            timestamp: Date.now(),
          });
        }
      });

      ws.on('error', () => {
        // Error handled by close event
      });

      broadcastToFrontend({
        type: 'agent_connected',
        timestamp: Date.now(),
      });
    } else if (role === 'frontend') {
      frontendClients.add(ws);

      ws.on('close', () => {
        frontendClients.delete(ws);
      });

      ws.on('error', () => {
        frontendClients.delete(ws);
      });

      // Send current agent state to newly connected frontend
      ws.send(JSON.stringify({
        type: 'agent_state',
        ...getAgentState(),
      }));
    }
  });

  startStaleChecker();

  return wss;
}

export function sendToAgent(requestId: string, command: Record<string, unknown>): boolean {
  if (!agentSocket || agentSocket.readyState !== WebSocket.OPEN) {
    return false;
  }

  const message = {
    type: 'command',
    requestId,
    command,
    timestamp: Date.now(),
  };

  agentSocket.send(JSON.stringify(message));

  // Track pending command
  pendingCommands.set(requestId, {
    requestId,
    command,
    timestamp: Date.now(),
    status: 'pending',
  });

  return true;
}

export function broadcastToFrontend(message: Record<string, unknown>): void {
  const data = JSON.stringify(message);
  for (const client of frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function getAgentState(): AgentState {
  return { ...agentState };
}

export function getPendingCommand(requestId: string): PendingCommand | undefined {
  return pendingCommands.get(requestId);
}

// ===== INTERNAL MESSAGE HANDLERS =====
function handleAgentMessage(msg: Record<string, unknown>): void {
  switch (msg.type) {
    case 'ack': {
      const requestId = msg.requestId as string;
      const status = msg.status as string;
      const error = msg.error as string | undefined;

      const pending = pendingCommands.get(requestId);
      if (pending) {
        pending.status = status as PendingCommand['status'];
        if (error) pending.error = error;
        pendingCommands.delete(requestId);
      }

      broadcastToFrontend({
        type: 'command_result',
        requestId,
        status,
        error,
      });
      break;
    }

    case 'health': {
      const subsystems = msg.subsystems as { obs: boolean; ptz: boolean } | undefined;
      if (subsystems) {
        agentState.health = {
          obs: subsystems.obs ?? false,
          ptz: subsystems.ptz ?? false,
        };
      }
      agentState.lastHeartbeat = Date.now();

      broadcastToFrontend({
        type: 'agent_health',
        subsystems: agentState.health,
        timestamp: Date.now(),
      });
      break;
    }
  }
}
