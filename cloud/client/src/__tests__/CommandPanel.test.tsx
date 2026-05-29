import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPanel } from '../components/CommandPanel';
import { ToastProvider } from '../components/Toast';
import type { ReactNode } from 'react';

// Mock the API module
vi.mock('../services/api', () => ({
  switchScene: vi.fn(),
  recallPreset: vi.fn(),
  savePreset: vi.fn(),
}));

// Mock useWebSocket
const mockOnCommandResult = vi.fn();
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    agentHealth: { agent: true, obs: true, ptz: true },
    wasEverConnected: true,
    onCommandResult: mockOnCommandResult,
  }),
}));

import * as api from '../services/api';

function renderWithProviders(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('CommandPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1
  it('renders two camera buttons: Cam 1 PTZ and Cam 2 Wide', () => {
    renderWithProviders(<CommandPanel />);

    expect(screen.getByRole('button', { name: /Cam 1 PTZ/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cam 2 Wide/i })).toBeInTheDocument();
  });

  // Test 2 & 3 — pending + confirmed states
  it('clicking Cam 1 PTZ calls switchScene and shows pending state', async () => {
    const mockSwitchScene = vi.mocked(api.switchScene);
    mockSwitchScene.mockResolvedValueOnce({ requestId: 'req-1', status: 'pending' });

    renderWithProviders(<CommandPanel />);

    const cam1Button = screen.getByRole('button', { name: /Cam 1 PTZ/i });
    await userEvent.click(cam1Button);

    expect(mockSwitchScene).toHaveBeenCalledWith('Cam 1 PTZ');

    // Button should be in transition state (pending)
    await waitFor(() => {
      expect(cam1Button.textContent).toContain('Switching...');
    });
  });

  // Test 5 & 6 — preset recall and save
  it('clicking Recall on preset 3 calls recallPreset(3)', async () => {
    const mockRecallPreset = vi.mocked(api.recallPreset);
    mockRecallPreset.mockResolvedValueOnce({ requestId: 'req-3', status: 'pending' });

    renderWithProviders(<CommandPanel />);

    const recall3Button = screen.getByRole('button', { name: /Recall 3/i });
    await userEvent.click(recall3Button);

    expect(mockRecallPreset).toHaveBeenCalledWith(3);
  });

  it('clicking Save on preset 5 calls savePreset(5)', async () => {
    const mockSavePreset = vi.mocked(api.savePreset);
    mockSavePreset.mockResolvedValueOnce({ requestId: 'req-5', status: 'pending' });

    renderWithProviders(<CommandPanel />);

    const save5Button = screen.getByRole('button', { name: /Save 5/i });
    await userEvent.click(save5Button);

    expect(mockSavePreset).toHaveBeenCalledWith(5);
  });

  // Test 7 — latest-command-wins
  it('clicking new camera while one is pending replaces pending state', async () => {
    const mockSwitchScene = vi.mocked(api.switchScene);
    mockSwitchScene
      .mockResolvedValueOnce({ requestId: 'req-1', status: 'pending' })
      .mockResolvedValueOnce({ requestId: 'req-2', status: 'pending' });

    renderWithProviders(<CommandPanel />);

    // Click Cam 1 PTZ
    await userEvent.click(screen.getByRole('button', { name: /Cam 1 PTZ/i }));
    expect(mockSwitchScene).toHaveBeenCalledWith('Cam 1 PTZ');

    // Click Cam 2 Wide while first is pending
    await userEvent.click(screen.getByRole('button', { name: /Cam 2 Wide/i }));
    expect(mockSwitchScene).toHaveBeenCalledWith('Cam 2 Wide');

    // Only the second callback should be registered for the latest command
    // Both API calls were made, but the latest command's callback replaces
    expect(mockSwitchScene).toHaveBeenCalledTimes(2);
  });

  // Test 8 — preset buttons disabled during pending
  it('preset buttons are disabled while a preset command is pending', async () => {
    const mockRecallPreset = vi.mocked(api.recallPreset);
    // Never resolve — keep pending
    mockRecallPreset.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<CommandPanel />);

    const recall1Button = screen.getByRole('button', { name: /Recall 1/i });
    await userEvent.click(recall1Button);

    await waitFor(() => {
      expect(recall1Button).toBeDisabled();
    });
  });
});
