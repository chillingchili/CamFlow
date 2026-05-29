import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../config.js', () => ({
  default: {
    CLOUD_WS_URL: 'ws://localhost:8080/ws',
    AGENT_SHARED_SECRET: 'test-secret',
    OBS_PORT: 4455,
    OBS_PASSWORD: 'test-password',
    PTZ_IP: '192.168.1.100',
  },
}));

// Mock global fetch for PTZ REST API calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { recallPreset, savePreset, isReachable, clearReachableCache } from '../ptz.js';

beforeEach(() => {
  vi.clearAllMocks();
  clearReachableCache();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
  });
});

describe('ptz.recallPreset()', () => {
  it('sends POST to BirdDog REST API with preset number', async () => {
    await recallPreset(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/ptz/preset/recall');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.preset).toBe(3);
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(recallPreset(1)).rejects.toThrow('Network error');
  });
});

describe('ptz.savePreset()', () => {
  it('sends POST to BirdDog REST API with preset number', async () => {
    await savePreset(5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/ptz/preset/save');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.preset).toBe(5);
  });

  it('handles non-ok responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    await expect(savePreset(3)).rejects.toThrow('Camera returned status 500');
  });
});

describe('ptz.isReachable()', () => {
  it('returns boolean reflecting camera connection state', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const reachable = await isReachable();
    expect(typeof reachable).toBe('boolean');
  });

  it('returns false when camera is not reachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
    const reachable = await isReachable();
    expect(reachable).toBe(false);
  });
});
