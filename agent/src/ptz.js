// CamFlow Agent — PTZ Controller Module
// Sends NDI PTZ preset commands to BirdDog camera via REST API.
// Uses configurable PTZ_PROTOCOL (default: 'rest' for BirdDog HTTP API).
// All commands wrapped in 5s timeout per CONTEXT.md.

import config from './config.js';

const PTZ_TIMEOUT = 5000; // 5s per CONTEXT.md
let reachableCache = null;
let reachableCacheTime = 0;
const CACHE_TTL = 5000; // 5s cache

/**
 * Send a PTZ command to the camera via REST API with timeout
 * @param {string} endpoint - API endpoint path (e.g., '/v1/ptz/preset/recall')
 * @param {object} body - Request body
 * @returns {Promise<void>}
 */
async function ptzRequest(endpoint, body) {
  const url = `http://${config.PTZ_IP}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PTZ_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Camera returned status ${response.status}: ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Recall a PTZ preset
 * @param {number} presetNumber - Preset number (1-8)
 * @returns {Promise<void>}
 */
export async function recallPreset(presetNumber) {
  await ptzRequest('/v1/ptz/preset/recall', { preset: presetNumber });
}

/**
 * Save current PTZ position as a preset
 * @param {number} presetNumber - Preset number (1-8)
 * @returns {Promise<void>}
 */
export async function savePreset(presetNumber) {
  await ptzRequest('/v1/ptz/preset/save', { preset: presetNumber });
}

/**
 * Check if the PTZ camera is reachable
 * Caches result for 5s to avoid excessive network calls.
 * @returns {Promise<boolean>}
 */
/**
 * Clear the reachability cache (useful for testing)
 */
export function clearReachableCache() {
  reachableCache = null;
  reachableCacheTime = 0;
}

export async function isReachable() {
  const now = Date.now();
  if (reachableCache !== null && (now - reachableCacheTime) < CACHE_TTL) {
    return reachableCache;
  }

  try {
    const url = `http://${config.PTZ_IP}/v1/status`;
    const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(2000) });
    reachableCache = response.ok;
  } catch (err) {
    reachableCache = false;
  }
  reachableCacheTime = now;
  return reachableCache;
}
