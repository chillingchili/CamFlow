import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, switchScene, recallPreset, savePreset, getAgentStatus } from '../services/api';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('exports login function', () => {
    expect(typeof login).toBe('function');
  });

  it('exports switchScene function', () => {
    expect(typeof switchScene).toBe('function');
  });

  it('exports recallPreset function', () => {
    expect(typeof recallPreset).toBe('function');
  });

  it('exports savePreset function', () => {
    expect(typeof savePreset).toBe('function');
  });

  it('exports getAgentStatus function', () => {
    expect(typeof getAgentStatus).toBe('function');
  });

  it('login sends POST to /api/auth/login with passphrase', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'test-token' }),
    });

    await login('my-secret');

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: 'my-secret' }),
    });
  });

  it('login throws on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Wrong passphrase' }),
    });

    await expect(login('wrong')).rejects.toThrow('Wrong passphrase');
  });

  it('switchScene sends POST to /api/obs/scene with auth header', async () => {
    localStorageMock.setItem('camflow_token', 'test-jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ requestId: 'abc', status: 'pending' }),
    });

    await switchScene('Cam 1 PTZ');

    expect(mockFetch).toHaveBeenCalledWith('/api/obs/scene', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-jwt',
      },
      body: JSON.stringify({ sceneName: 'Cam 1 PTZ' }),
    });
  });

  it('recallPreset sends POST to /api/ptz/preset/recall', async () => {
    localStorageMock.setItem('camflow_token', 'test-jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ requestId: 'xyz', status: 'pending' }),
    });

    await recallPreset(3);

    expect(mockFetch).toHaveBeenCalledWith('/api/ptz/preset/recall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-jwt',
      },
      body: JSON.stringify({ presetNumber: 3 }),
    });
  });

  it('savePreset sends POST to /api/ptz/preset/save', async () => {
    localStorageMock.setItem('camflow_token', 'test-jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ requestId: 'def', status: 'pending' }),
    });

    await savePreset(5);

    expect(mockFetch).toHaveBeenCalledWith('/api/ptz/preset/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-jwt',
      },
      body: JSON.stringify({ presetNumber: 5 }),
    });
  });

  it('getAgentStatus sends GET to /api/agent/status', async () => {
    localStorageMock.setItem('camflow_token', 'test-jwt');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        connected: true,
        lastHeartbeat: 1234567890,
        health: { obs: true, ptz: false },
      }),
    });

    const status = await getAgentStatus();

    expect(mockFetch).toHaveBeenCalledWith('/api/agent/status', {
      headers: { Authorization: 'Bearer test-jwt' },
    });
    expect(status.connected).toBe(true);
    expect(status.health.obs).toBe(true);
    expect(status.health.ptz).toBe(false);
  });

  it('clears token on 401 and rethrows', async () => {
    localStorageMock.setItem('camflow_token', 'expired-jwt');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Token expired' }),
    });

    await expect(getAgentStatus()).rejects.toThrow('Token expired');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('camflow_token');
  });
});
