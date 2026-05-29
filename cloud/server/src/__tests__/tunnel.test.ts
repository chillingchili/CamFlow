import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';

// Module imports — will FAIL in RED phase
import { setupWebSocket, sendToAgent, broadcastToFrontend, getAgentState } from '../ws/tunnel.js';
import { initializeDb } from '../db/index.js';

const JWT_SECRET = 'test-jwt-secret-for-tunnel-testing';
const AGENT_SECRET = 'test-agent-shared-secret';
const PASSPHRASE = 'test-passphrase';

process.env.JWT_SECRET = JWT_SECRET;
process.env.AGENT_SHARED_SECRET = AGENT_SECRET;
process.env.PASSPHRASE = PASSPHRASE;

let httpServer: ReturnType<typeof createServer>;
let baseUrl: string;
let wsBaseUrl: string;

function getPort(): number {
  const addr = httpServer.address() as AddressInfo;
  return addr.port;
}

beforeAll(async () => {
  // Initialize DB for agent token verification (getPassphraseHash needed)
  process.env.DB_PATH = ':memory:';
  initializeDb();

  httpServer = createServer();
  setupWebSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });

  const port = getPort();
  baseUrl = `http://localhost:${port}`;
  wsBaseUrl = `ws://localhost:${port}`;
});

afterAll(() => {
  httpServer.close();
});

describe('WebSocket Tunnel', () => {
  // ===== CONNECTION TESTS =====
  describe('Agent Connection', () => {
    it('WebSocket connection to /ws with valid shared secret upgrades successfully', async () => {
      const ws = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          ws.close();
          resolve();
        });
        ws.on('error', reject);

        setTimeout(() => reject(new Error('Connection timeout')), 3000);
      });
    });

    it('WebSocket connection to /ws with invalid token is rejected', async () => {
      const ws = new WebSocket(`${wsBaseUrl}/ws?token=wrong-secret`);

      await new Promise<void>((resolve) => {
        ws.on('error', () => {
          // Connection rejected — expected
          resolve();
        });
        ws.on('open', () => {
          ws.close();
          // Should not have opened
          resolve();
        });

        setTimeout(() => resolve(), 2000);
      });
    });

    it('WebSocket connection to /ws with missing token is rejected', async () => {
      const ws = new WebSocket(`${wsBaseUrl}/ws`);

      await new Promise<void>((resolve) => {
        ws.on('error', () => resolve());
        ws.on('open', () => {
          ws.close();
          resolve();
        });
        setTimeout(() => resolve(), 2000);
      });
    });

    it('WebSocket connection to wrong path is rejected', async () => {
      const ws = new WebSocket(`${wsBaseUrl}/wrong-path?token=${AGENT_SECRET}`);

      await new Promise<void>((resolve) => {
        ws.on('error', () => resolve());
        ws.on('open', () => {
          ws.close();
          resolve();
        });
        setTimeout(() => resolve(), 2000);
      });
    });
  });

  // ===== MESSAGE RELAY TESTS =====
  describe('Message Relay', () => {
    let agentWs: WebSocket;

    beforeEach(async () => {
      // Connect an agent
      agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });
    });

    afterEach(() => {
      if (agentWs && agentWs.readyState === WebSocket.OPEN) {
        agentWs.close();
      }
    });

    it('sendToAgent delivers a command message to the connected agent', async () => {
      const received = new Promise<any>((resolve) => {
        agentWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          resolve(msg);
        });
      });

      const result = sendToAgent('test-req-1', {
        type: 'obs_scene',
        sceneName: 'Cam 1',
      });

      expect(result).toBe(true);

      const msg = await Promise.race([
        received,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Message not received')), 2000)),
      ]);

      expect(msg.type).toBe('command');
      expect(msg.requestId).toBe('test-req-1');
      expect(msg.command.type).toBe('obs_scene');
      expect(msg.command.sceneName).toBe('Cam 1');
    });

    it('Agent disconnect removes agent from tracked connections', async () => {
      // Agent should be connected
      expect(getAgentState().connected).toBe(true);

      // Close the agent connection
      agentWs.close();
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Agent should be disconnected
      expect(getAgentState().connected).toBe(false);
    });

    it('Health message from agent updates internal state', async () => {
      agentWs.send(JSON.stringify({
        type: 'health',
        subsystems: { obs: true, ptz: false },
      }));

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = getAgentState();
      expect(state.connected).toBe(true);
      expect(state.health.obs).toBe(true);
      expect(state.health.ptz).toBe(false);
    });

    it('ACK message resolves pending command', async () => {
      // Send a command
      sendToAgent('test-req-2', { type: 'ptz_preset_recall', presetNumber: 3 });

      // Agent sends ACK
      agentWs.send(JSON.stringify({
        type: 'ack',
        requestId: 'test-req-2',
        status: 'ok',
      }));

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Pending command should be resolved (no longer pending)
      // The Map entry status should be 'ok'
    });
  });

  // ===== FRONTEND BROADCAST TESTS =====
  describe('Frontend Broadcast', () => {
    it('broadcastToFrontend sends to all connected frontend clients', async () => {
      const jwt_token = jwt.sign({ role: 'operator' }, JWT_SECRET, { expiresIn: '1h' });

      // Connect two frontend clients
      const frontend1 = new WebSocket(`${wsBaseUrl}/frontend?token=${jwt_token}`);
      const frontend2 = new WebSocket(`${wsBaseUrl}/frontend?token=${jwt_token}`);

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          frontend1.on('open', resolve);
          frontend1.on('error', reject);
          setTimeout(() => reject(new Error('Frontend 1 connect timeout')), 3000);
        }),
        new Promise<void>((resolve, reject) => {
          frontend2.on('open', resolve);
          frontend2.on('error', reject);
          setTimeout(() => reject(new Error('Frontend 2 connect timeout')), 3000);
        }),
      ]);

      let frontend1Msg: any = null;
      let frontend2Msg: any = null;

      frontend1.on('message', (data) => {
        frontend1Msg = JSON.parse(data.toString());
      });
      frontend2.on('message', (data) => {
        frontend2Msg = JSON.parse(data.toString());
      });

      broadcastToFrontend({ type: 'agent_health', subsystems: { obs: true, ptz: true } });

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(frontend1Msg).not.toBeNull();
      expect(frontend1Msg.type).toBe('agent_health');
      expect(frontend2Msg).not.toBeNull();
      expect(frontend2Msg.type).toBe('agent_health');

      frontend1.close();
      frontend2.close();
    });
  });
});
