// CamFlow Agent — Command Router
// Central dispatch: receives cloud commands from the tunnel and routes
// to the correct hardware module, then sends ACK responses back.

import { setScene } from './obs.js';
import { recallPreset, savePreset } from './ptz.js';

const PTZ_TIMEOUT = 5000;  // 5s per CONTEXT.md
const OBS_TIMEOUT = 2000;  // 2s per CONTEXT.md

/**
 * Create a timeout promise that rejects after ms milliseconds
 */
function timeout(ms, message) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}

/**
 * Dispatch a command from the cloud to the appropriate hardware module
 * @param {object} command - { type: string, sceneName?, presetNumber? }
 * @param {string} requestId - Unique request identifier for ACK correlation
 * @param {function} sendAck - Callback to send ACK response via tunnel
 */
export async function dispatch(command, requestId, sendAck) {
  try {
    switch (command.type) {
      case 'obs_scene': {
        await Promise.race([
          setScene(command.sceneName),
          timeout(OBS_TIMEOUT, 'OBS scene switch timed out'),
        ]);
        sendAck({ type: 'ack', requestId, status: 'ok' });
        break;
      }
      case 'ptz_preset_recall': {
        await Promise.race([
          recallPreset(command.presetNumber),
          timeout(PTZ_TIMEOUT, 'PTZ preset recall timed out'),
        ]);
        sendAck({ type: 'ack', requestId, status: 'ok' });
        break;
      }
      case 'ptz_preset_save': {
        await Promise.race([
          savePreset(command.presetNumber),
          timeout(PTZ_TIMEOUT, 'PTZ preset save timed out'),
        ]);
        sendAck({ type: 'ack', requestId, status: 'ok' });
        break;
      }
      default:
        sendAck({
          type: 'ack',
          requestId,
          status: 'error',
          error: `Unknown command type: ${command.type}`,
        });
    }
  } catch (err) {
    sendAck({
      type: 'ack',
      requestId,
      status: 'error',
      error: err.message,
    });
  }
}
