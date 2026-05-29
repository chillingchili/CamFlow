// CamFlow Agent — Entry Point
// Wires together tunnel, OBS, PTZ, and router into a running agent.

import { connect, onCommand, onConnected, send } from './tunnel.js';
import { connect as connectOBS } from './obs.js';
import { dispatch } from './router.js';

async function start() {
  // Start OBS connection (non-blocking — OBS might not be running yet)
  connectOBS().catch(err =>
    console.error('OBS initial connect failed:', err.message)
  );

  // Set up command handler: tunnel receives → router dispatches → ACK sent back
  onCommand((command, requestId) => {
    dispatch(command, requestId, (ack) => {
      const sent = send(ack);
      if (!sent) {
        console.error('Failed to send ACK for request', requestId);
      }
    });
  });

  // Connect to cloud
  await connect();
  console.log('CamFlow agent started');
}

start().catch(err => {
  console.error('Agent startup failed:', err);
  process.exit(1);
});
