import { useState, useEffect, useRef, useCallback } from 'react';

export interface AgentHealth {
  agent: boolean;
  obs: boolean;
  ptz: boolean;
}

export interface CommandResult {
  requestId: string;
  status: 'ok' | 'error' | 'stale';
  error?: string;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbacksRef = useRef<Map<string, (result: CommandResult) => void>>(new Map());
  const wasConnectedRef = useRef(false);

  const [agentHealth, setAgentHealth] = useState<AgentHealth>({
    agent: false,
    obs: false,
    ptz: false,
  });
  const [wasEverConnected, setWasEverConnected] = useState(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem('camflow_token');
    if (!token) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/frontend?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      wasConnectedRef.current = true;
      setWasEverConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'agent_health') {
          setAgentHealth({
            agent: true,
            obs: msg.subsystems?.obs ?? false,
            ptz: msg.subsystems?.ptz ?? false,
          });
        } else if (msg.type === 'agent_state') {
          setAgentHealth({
            agent: msg.connected ?? false,
            obs: msg.health?.obs ?? false,
            ptz: msg.health?.ptz ?? false,
          });
          if (msg.connected) {
            wasConnectedRef.current = true;
            setWasEverConnected(true);
          }
        } else if (msg.type === 'agent_connected') {
          setAgentHealth(prev => ({ ...prev, agent: true }));
          wasConnectedRef.current = true;
          setWasEverConnected(true);
        } else if (msg.type === 'agent_disconnected') {
          setAgentHealth({ agent: false, obs: false, ptz: false });
        } else if (msg.type === 'command_result') {
          const callback = callbacksRef.current.get(msg.requestId);
          if (callback) {
            callback({
              requestId: msg.requestId,
              status: msg.status,
              error: msg.error,
            });
            callbacksRef.current.delete(msg.requestId);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setAgentHealth(prev => ({ ...prev, agent: false }));
      wsRef.current = null;

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      // Error is handled by onclose
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const onCommandResult = useCallback(
    (requestId: string, callback: (result: CommandResult) => void) => {
      callbacksRef.current.set(requestId, callback);
    },
    []
  );

  return {
    agentHealth,
    wasEverConnected,
    onCommandResult,
  };
}
