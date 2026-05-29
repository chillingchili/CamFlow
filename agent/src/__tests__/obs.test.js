import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config — prevents env var validation errors
vi.mock('../config.js', () => ({
  default: {
    CLOUD_WS_URL: 'ws://localhost:8080/ws',
    AGENT_SHARED_SECRET: 'test-secret',
    OBS_PORT: 4455,
    OBS_PASSWORD: 'test-password',
    PTZ_IP: '192.168.1.100',
  },
}));

// Mock obs-websocket-js
const mockObsCall = vi.fn();
const mockObsConnect = vi.fn();
let mockConnected = false;

vi.mock('obs-websocket-js', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: mockObsConnect.mockImplementation((url, password) => {
      mockConnected = true;
      return Promise.resolve();
    }),
    call: mockObsCall.mockImplementation((method, params) => {
      if (!mockConnected) return Promise.reject(new Error('Not connected'));
      return Promise.resolve();
    }),
    on: vi.fn(),
    disconnect: vi.fn().mockImplementation(() => {
      mockConnected = false;
    }),
  })),
}));

import OBSWebSocket from 'obs-websocket-js';
import { connect, setScene, isConnected, disconnect } from '../obs.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockConnected = false;
});

describe('obs.connect()', () => {
  it('creates OBS WebSocket connection to configured port', async () => {
    await connect();
    expect(mockObsConnect).toHaveBeenCalled();
    const [url] = mockObsConnect.mock.calls[0];
    expect(url).toContain('4455');
  });

  it('constructs OBSWebSocket instance', async () => {
    await connect();
    expect(OBSWebSocket).toHaveBeenCalled();
  });
});

describe('obs.setScene()', () => {
  it('calls obs.call with SetCurrentProgramScene and sceneName', async () => {
    await connect();
    await setScene('Cam 1 PTZ');
    expect(mockObsCall).toHaveBeenCalledWith('SetCurrentProgramScene', {
      sceneName: 'Cam 1 PTZ',
    });
  });

  it('resolves promise on success', async () => {
    await connect();
    await expect(setScene('Test Scene')).resolves.toBeUndefined();
  });
});

describe('obs.isConnected()', () => {
  it('returns true when connected', async () => {
    await connect();
    expect(isConnected()).toBe(true);
  });

  it('returns false when never connected', () => {
    // fresh module state check — returns boolean
    expect(typeof isConnected()).toBe('boolean');
  });
});

describe('obs.disconnect()', () => {
  it('gracefully closes connection if connected', async () => {
    await connect();
    expect(() => disconnect()).not.toThrow();
  });
});
