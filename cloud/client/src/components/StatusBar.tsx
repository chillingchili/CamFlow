import type { AgentHealth } from '../hooks/useWebSocket';

interface StatusBarProps {
  agentHealth: AgentHealth;
  wasEverConnected?: boolean;
}

function Indicator({
  label,
  connected,
  reconnecting,
}: {
  label: string;
  connected: boolean;
  reconnecting: boolean;
}) {
  let dotColor: string;
  let statusText: string;

  if (connected) {
    dotColor = 'bg-green-400';
    statusText = 'Connected';
  } else if (reconnecting) {
    dotColor = 'bg-orange-400 animate-pulse';
    statusText = 'Reconnecting';
  } else {
    dotColor = 'bg-red-400';
    statusText = 'Disconnected';
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="text-xs font-medium text-gray-300 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-xs text-gray-400">{statusText}</span>
    </div>
  );
}

export function StatusBar({ agentHealth, wasEverConnected = false }: StatusBarProps) {
  const reconnecting = wasEverConnected && !agentHealth.agent;

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 right-0 z-50 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 py-1.5 h-10"
    >
      <span className="text-sm font-semibold text-white tracking-tight">
        CamFlow
      </span>
      <div className="flex items-center gap-1">
        <Indicator
          label="Agent"
          connected={agentHealth.agent}
          reconnecting={reconnecting}
        />
        <Indicator
          label="OBS"
          connected={agentHealth.obs}
          reconnecting={reconnecting}
        />
        <Indicator
          label="PTZ"
          connected={agentHealth.ptz}
          reconnecting={reconnecting}
        />
      </div>
    </header>
  );
}
