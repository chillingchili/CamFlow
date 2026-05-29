// CamFlow Agent — OBS Controller Module
// Controls OBS scene switching via obs-websocket-js (WebSocket v5 protocol)

import OBSWebSocket from 'obs-websocket-js';
import config from './config.js';

let obs = null;
let connected = false;

/**
 * Connect to OBS WebSocket server
 * Handles ConnectionClosed and ConnectionError events gracefully.
 * Does NOT crash on disconnect — OBS is an independent subsystem.
 */
export async function connect() {
  obs = new OBSWebSocket();

  obs.on('ConnectionClosed', () => {
    console.log('OBS WebSocket connection closed');
    connected = false;
    // Auto-retry after 5s per PITFALLS.md guidance
    setTimeout(() => {
      if (!connected) {
        connect().catch(err =>
          console.error('OBS reconnect failed:', err.message)
        );
      }
    }, 5000);
  });

  obs.on('ConnectionError', (err) => {
    console.error('OBS WebSocket connection error:', err.message);
    connected = false;
  });

  const port = config.OBS_PORT || 4455;
  const url = `ws://localhost:${port}`;

  try {
    await obs.connect(url, config.OBS_PASSWORD);
    connected = true;
    console.log('Connected to OBS WebSocket on port', port);
  } catch (err) {
    connected = false;
    console.error('OBS initial connect failed:', err.message);
    throw err;
  }
}

/**
 * Switch OBS to a different scene
 * @param {string} sceneName - Exact name of the OBS scene to switch to
 * @returns {Promise<void>}
 */
export async function setScene(sceneName) {
  if (!connected || !obs) {
    throw new Error('OBS not connected');
  }
  await obs.call('SetCurrentProgramScene', { sceneName });
}

/**
 * Check if OBS is connected
 * @returns {boolean}
 */
export function isConnected() {
  return connected && obs !== null;
}

/**
 * Gracefully disconnect from OBS
 */
export function disconnect() {
  if (obs && connected) {
    try {
      obs.disconnect();
    } catch (e) {
      // ignore disconnect errors
    }
    connected = false;
    obs = null;
  }
}
