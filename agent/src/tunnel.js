// CamFlow Agent — WebSocket Tunnel Module
// Maintains persistent outbound WebSocket connection to the cloud backend
// with exponential backoff reconnection, heartbeat, and command dispatch.

import WebSocket from 'ws';
import config from './config.js';
import { getSnapshot } from './health.js';

// Module-level state
let ws = null;
let wsId = 0; // Track connection identity to prevent stale close handlers
let commandHandler = null;
let reconnectAttempt = 0;
let reconnectTimer = null;
let heartbeatTimer = null;
let lastHeartbeat = null;
let onConnectedCallback = null;
let intentionalClose = false;

// Constants (from CONTEXT.md)
const HEARTBEAT_INTERVAL = 5000;   // 5s
const STALE_THRESHOLD = 15000;     // 15s
const MAX_RECONNECT_DELAY = 30000; // 30s max
const BASE_RECONNECT_DELAY = 1000; // 1s base

// Pending command queue (commands received while disconnected)
let pendingQueue = [];

/**
 * Compute exponential backoff delay with ±50% jitter
 */
function getReconnectDelay(attempt) {
  const base = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
  const jitter = base * 0.5 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

/**
 * Replay queued commands, rejecting stale ones (>15s old)
 */
function replayQueuedCommands() {
  const now = Date.now();
  const validCommands = [];
  const staleCommands = [];

  for (const entry of pendingQueue) {
    if (now - entry.timestamp > STALE_THRESHOLD) {
      staleCommands.push(entry);
    } else {
      validCommands.push(entry);
    }
  }

  for (const entry of staleCommands) {
    send({
      type: 'ack',
      requestId: entry.requestId,
      status: 'error',
      error: 'Command rejected: stale (queued >15s)',
    });
  }

  pendingQueue = [];
  for (const entry of validCommands) {
    if (commandHandler) {
      commandHandler(entry.command, entry.requestId);
    }
  }
}

/**
 * Start the heartbeat interval
 */
function startHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  heartbeatTimer = setInterval(() => {
    const snapshot = getSnapshot();
    lastHeartbeat = Date.now();
    send({
      type: 'health',
      subsystems: {
        obs: snapshot.obs,
        ptz: snapshot.ptz,
      },
    });
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop the heartbeat interval
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Schedule a reconnect attempt with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  if (intentionalClose) return;

  const delay = getReconnectDelay(reconnectAttempt);
  console.log(`Tunnel disconnected — reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1})`);
  reconnectTimer = setTimeout(() => {
    reconnectAttempt++;
    connect().catch(() => {});
  }, delay);
}

/**
 * Connect to the cloud WebSocket server
 */
export function connect() {
  return new Promise((resolve, reject) => {
    // Clean up previous connection
    intentionalClose = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopHeartbeat();
    if (ws) {
      ws.removeAllListeners();
      try { ws.close(); } catch (e) { /* ignore */ }
      ws = null;
    }
    intentionalClose = false;

    const thisWsId = ++wsId;
    const url = `${config.CLOUD_WS_URL}?token=${config.AGENT_SHARED_SECRET}`;
    ws = new WebSocket(url);

    ws.on('open', () => {
      if (thisWsId !== wsId) return; // Stale connection
      console.log('Tunnel connected to cloud');
      reconnectAttempt = 0;
      lastHeartbeat = Date.now();
      replayQueuedCommands();
      startHeartbeat();
      if (onConnectedCallback) {
        onConnectedCallback();
      }
      resolve();
    });

    ws.on('message', (data) => {
      if (thisWsId !== wsId) return;
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'command' && commandHandler) {
          commandHandler(message.command, message.requestId);
        }
      } catch (err) {
        console.error('Failed to parse tunnel message:', err.message);
      }
    });

    ws.on('close', () => {
      if (thisWsId !== wsId) return; // Stale connection
      console.log('Tunnel disconnected');
      ws = null;
      stopHeartbeat();
      scheduleReconnect();
    });

    ws.on('error', (err) => {
      if (thisWsId !== wsId) return;
      console.error('Tunnel error:', err.message);
      // close handler will handle reconnect
      if (reconnectAttempt === 0 && ws && ws.readyState === WebSocket.OPEN) {
        reject(err);
      }
    });
  });
}

/**
 * Send a message over the WebSocket tunnel
 */
export function send(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (err) {
    console.error('Failed to send tunnel message:', err.message);
    return false;
  }
}

/**
 * Register a command handler callback
 */
export function onCommand(callback) {
  commandHandler = callback;
}

/**
 * Register a callback for connection established
 */
export function onConnected(callback) {
  onConnectedCallback = callback;
}

/**
 * Get current connection state
 */
export function getConnectionState() {
  return {
    connected: ws !== null && ws.readyState === WebSocket.OPEN,
    lastHeartbeat,
  };
}
