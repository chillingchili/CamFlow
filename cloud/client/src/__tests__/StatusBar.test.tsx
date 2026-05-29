import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StatusBar } from '../components/StatusBar';

describe('StatusBar', () => {
  it('renders three indicators: Agent, OBS, PTZ — all red initially', () => {
    render(
      <StatusBar
        agentHealth={{ agent: false, obs: false, ptz: false }}
      />
    );

    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('OBS')).toBeInTheDocument();
    expect(screen.getByText('PTZ')).toBeInTheDocument();

    // All should show "Disconnected"
    const disconnectedLabels = screen.getAllByText('Disconnected');
    expect(disconnectedLabels).toHaveLength(3);
  });

  it('shows OBS green and PTZ red when agent_health says obs=true ptz=false', () => {
    render(
      <StatusBar
        agentHealth={{ agent: true, obs: true, ptz: false }}
      />
    );

    // Agent and OBS are connected, PTZ is disconnected
    const connectedLabels = screen.getAllByText('Connected');
    expect(connectedLabels).toHaveLength(2);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('shows all indicators as orange Reconnecting when agent is disconnected', () => {
    render(
      <StatusBar
        agentHealth={{ agent: false, obs: false, ptz: false }}
        wasEverConnected={true}
      />
    );

    const reconnectingLabels = screen.getAllByText('Reconnecting');
    expect(reconnectingLabels).toHaveLength(3);
  });

  it('is fixed at top and spans full width', () => {
    render(
      <StatusBar
        agentHealth={{ agent: false, obs: false, ptz: false }}
      />
    );

    const bar = screen.getByRole('banner');
    expect(bar).toHaveClass('fixed');
    expect(bar).toHaveClass('top-0');
    expect(bar).toHaveClass('left-0');
    expect(bar).toHaveClass('right-0');
  });
});
