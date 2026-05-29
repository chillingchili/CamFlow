import { type ReactNode } from 'react';
import { StatusBar } from './StatusBar';
import { ToastProvider } from './Toast';
import { useWebSocket } from '../hooks/useWebSocket';

export function Dashboard({ children }: { children: ReactNode }) {
  const { agentHealth, wasEverConnected } = useWebSocket();

  return (
    <ToastProvider>
      <StatusBar agentHealth={agentHealth} wasEverConnected={wasEverConnected} />
      <main className="pt-10 min-h-screen bg-gray-50 dark:bg-gray-950">
        {children}
      </main>
    </ToastProvider>
  );
}
