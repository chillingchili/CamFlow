import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { WebSocketServer } from 'ws';

// All constants needed by hoisted mocks must be in vi.hoisted()
const { AGENT_SECRET, testUrlRef } = vi.hoisted(() => {
  return {
    AGENT_SECRET: 'test-agent-secret-123',
    testUrlRef: { url: 'ws://placeholder' },
  };
});

vi.mock('../config.js', () => ({
  default: {
    get CLOUD_WS_URL() { return testUrlRef.url; },
    AGENT_SHARED_SECRET: AGENT_SECRET,
    OBS_PORT: 4455,
    OBS_PASSWORD: 'test-password',
    PTZ_IP: '192.168.1.100',
    PTZ_PROTOCOL: 'rest',
  },
}));

vi.mock('../health.js', () => ({
  getSnapshot: vi.fn().mockReturnValue({ obs: false, ptz: false, timestamp: Date.now() }),
}));

import config from '../config.js';
import { connect, send, onCommand, getConnectionState } from '../tunnel.js';
import { getSnapshot } from '../health.js';

let testServer;

beforeAll(async () => {
  testServer = new WebSocketServer({ port: 0, host: '127.0.0.1' });

  await new Promise((resolve) => {
    testServer.on('listening', () => {
      const port = testServer.address().port;
      testUrlRef.url = `ws://127.0.0.1:${port}`;

      testServer.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        const token = url.searchParams.get('token');

        if (token !== AGENT_SECRET) {
          ws.close(4001, 'Unauthorized');
          return;
        }

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            // Echo back as a command so we can test onCommand
            if (msg.type === 'health') {
              // track health messages silently
            }
          } catch (e) { /* ignore */ }
        });
      });

      resolve();
    });
  });
});

afterAll(() => {
  if (testServer) {
    testServer.close();
  }
});

describe('config', () => {
  it('exports all required config values', () => {
    expect(config.CLOUD_WS_URL).toBeTruthy();
    expect(config.AGENT_SHARED_SECRET).toBe(AGENT_SECRET);
    expect(config.OBS_PORT).toBe(4455);
    expect(config.OBS_PASSWORD).toBeTruthy();
    expect(config.PTZ_IP).toBeTruthy();
  });
});

describe('connect()', () => {
  it('establishes WebSocket connection and reports connected', async () => {
    await connect();
    const state = getConnectionState();
    expect(state.connected).toBe(true);
  });
});

describe('send()', () => {
  it('returns true when connected', async () => {
    await connect();
    const result = send({ type: 'health', subsystems: { obs: false, ptz: false } });
    expect(result).toBe(true);
  });
});

describe('getConnectionState()', () => {
  it('returns { connected, lastHeartbeat } after connection', async () => {
    await connect();
    const state = getConnectionState();
    expect(state).toHaveProperty('connected');
    expect(state).toHaveProperty('lastHeartbeat');
    expect(state.connected).toBe(true);
  });
});

describe('heartbeat', () => {
  it('calls health.getSnapshot() on heartbeat interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    getSnapshot.mockClear();

    await connect();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5100);

    expect(getSnapshot).toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('onCommand', () => {
  it('registers a command handler without throwing', () => {
    expect(() => onCommand((cmd, rid) => {})).not.toThrow();
  });
});
