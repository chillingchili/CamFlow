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

import { recallPreset, savePreset, isReachable, clearReachableCache, move, zoom, stop } from '../ptz.js';

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

describe('ptz.move()', () => {
  it('sends correct REST API request for pan up', async () => {
    await move('up', 50);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/ptz/move');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.direction).toBe('up');
    expect(body.speed).toBe(50);
  });

  it('sends pan down with speed 100', async () => {
    await move('down', 100);
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.direction).toBe('down');
    expect(body.speed).toBe(100);
  });

  it('sends pan left with speed 25', async () => {
    await move('left', 25);
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.direction).toBe('left');
    expect(body.speed).toBe(25);
  });

  it('sends pan right with speed 75', async () => {
    await move('right', 75);
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.direction).toBe('right');
    expect(body.speed).toBe(75);
  });

  it('throws on invalid direction', async () => {
    await expect(move('diagonal', 50)).rejects.toThrow('Invalid direction');
  });

  it('throws if speed is below 1', async () => {
    await expect(move('up', 0)).rejects.toThrow('Speed must be 1-100');
  });

  it('throws if speed is above 100', async () => {
    await expect(move('up', 101)).rejects.toThrow('Speed must be 1-100');
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(move('up', 50)).rejects.toThrow('Network error');
  });
});

describe('ptz.zoom()', () => {
  it('sends zoom in REST API request', async () => {
    await zoom('in', 50);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/ptz/zoom');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.direction).toBe('in');
    expect(body.speed).toBe(50);
  });

  it('sends zoom out request with speed 30', async () => {
    await zoom('out', 30);
    const [url, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.direction).toBe('out');
    expect(body.speed).toBe(30);
  });

  it('throws on invalid direction', async () => {
    await expect(zoom('sideways', 50)).rejects.toThrow('Invalid direction');
  });

  it('throws if speed is below 1', async () => {
    await expect(zoom('in', 0)).rejects.toThrow('Speed must be 1-100');
  });

  it('throws if speed is above 100', async () => {
    await expect(zoom('in', 101)).rejects.toThrow('Speed must be 1-100');
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(zoom('in', 50)).rejects.toThrow('Network error');
  });
});

describe('ptz.stop()', () => {
  it('sends stop command to camera', async () => {
    await stop();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/ptz/stop');
    expect(options.method).toBe('POST');
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    await expect(stop()).rejects.toThrow('Network error');
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
