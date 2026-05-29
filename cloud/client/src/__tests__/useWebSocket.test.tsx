import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '../hooks/useWebSocket';

// Mock WebSocket
class MockWebSocket {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0; // CONNECTING
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  send() {}

  // Helper to simulate connection open
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  // Helper to simulate message
  simulateMessage(data: object) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

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

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    MockWebSocket.instances = [];
    // @ts-expect-error - mock
    global.WebSocket = MockWebSocket;
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'http:',
        host: 'localhost:5173',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to correct WebSocket URL with JWT token', async () => {
    localStorageMock.setItem('camflow_token', 'test-jwt');

    renderHook(() => useWebSocket());

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('/frontend?token=test-jwt');
  });

  it('does not connect without JWT token', () => {
    renderHook(() => useWebSocket());
    expect(MockWebSocket.instances.length).toBe(0);
  });

  it('updates agentHealth on agent_health message', async () => {
    localStorageMock.setItem('camflow_token', 'test-jwt');

    const { result } = renderHook(() => useWebSocket());

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'agent_health',
        subsystems: { obs: true, ptz: false },
      });
    });

    await waitFor(() => {
      expect(result.current.agentHealth.agent).toBe(true);
      expect(result.current.agentHealth.obs).toBe(true);
      expect(result.current.agentHealth.ptz).toBe(false);
    });
  });

  it('sets agent to false on WebSocket close', async () => {
    localStorageMock.setItem('camflow_token', 'test-jwt');

    const { result } = renderHook(() => useWebSocket());

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'agent_health',
        subsystems: { obs: true, ptz: true },
      });
    });

    await waitFor(() => {
      expect(result.current.agentHealth.agent).toBe(true);
    });

    act(() => {
      ws.close();
    });

    await waitFor(() => {
      expect(result.current.agentHealth.agent).toBe(false);
    });
  });
});
