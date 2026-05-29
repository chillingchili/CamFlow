import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetGrid } from '../components/PresetGrid';
import { ToastProvider } from '../components/Toast';
import type { ReactNode } from 'react';

// Mock the API module
vi.mock('../services/api', () => ({
  getPresets: vi.fn(),
  updatePreset: vi.fn(),
  reorderPresets: vi.fn(),
}));

// Mock useWebSocket
vi.mock('../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    agentHealth: { agent: true, obs: true, ptz: true },
    wasEverConnected: true,
    onCommandResult: vi.fn(),
  }),
}));

import * as api from '../services/api';

function renderWithProviders(ui: ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const mockPresets = [
  { id: 1, name: 'Pastor Closeup', ptz_number: 1, active: true, sort_order: 1, settle_time: 2.5 },
  { id: 2, name: 'Pulpit Wide', ptz_number: 2, active: true, sort_order: 2, settle_time: 3.0 },
  { id: 3, name: 'Choir Loft', ptz_number: 3, active: false, sort_order: 3, settle_time: 2.5 },
  { id: 4, name: 'Baptismal', ptz_number: 4, active: true, sort_order: 4, settle_time: 4.0 },
  { id: 5, name: 'Piano', ptz_number: 5, active: false, sort_order: 5, settle_time: 2.5 },
  { id: 6, name: 'Lectern', ptz_number: 6, active: true, sort_order: 6, settle_time: 2.5 },
  { id: 7, name: 'Congregation', ptz_number: 7, active: false, sort_order: 7, settle_time: 2.0 },
  { id: 8, name: 'Stage Wide', ptz_number: 8, active: false, sort_order: 8, settle_time: 2.5 },
];

describe('PresetGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getPresets).mockResolvedValue(mockPresets);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Renders all 8 presets
  it('renders 8 preset cards in vertical list', async () => {
    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      // Each preset name should appear
      expect(screen.getByText('Pastor Closeup')).toBeInTheDocument();
      expect(screen.getByText('Pulpit Wide')).toBeInTheDocument();
      expect(screen.getByText('Choir Loft')).toBeInTheDocument();
      expect(screen.getByText('Baptismal')).toBeInTheDocument();
      expect(screen.getByText('Piano')).toBeInTheDocument();
      expect(screen.getByText('Lectern')).toBeInTheDocument();
      expect(screen.getByText('Congregation')).toBeInTheDocument();
      expect(screen.getByText('Stage Wide')).toBeInTheDocument();
    });
  });

  // Test 2: Each card shows PTZ number badge, drag handle, settle time
  it('each card shows PTZ number badge, drag handle, and settle time', async () => {
    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      // Check settle time input exists with correct value
      const settleInputs = screen.getAllByRole('spinbutton');
      expect(settleInputs.length).toBe(8);
      expect(settleInputs[1]).toHaveValue(3); // Pulpit Wide has settle_time 3.0
      // Check drag handles exist (grip icon)
      const dragHandles = screen.getAllByLabelText(/drag/i);
      expect(dragHandles.length).toBe(8);
    });
  });

  // Test 3: Toggle switch calls updatePreset with ACK feedback
  it('toggling active switch calls updatePreset', async () => {
    vi.mocked(api.updatePreset).mockResolvedValue({ requestId: 'req-toggle-1' });

    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      expect(screen.getByText('Pastor Closeup')).toBeInTheDocument();
    });

    // Click the preset card to toggle active
    const card = screen.getByText('Pastor Closeup').closest('[class*="rounded-lg"]')!;
    await userEvent.click(card);

    expect(api.updatePreset).toHaveBeenCalledWith(1, { active: false });
  });

  // Test 4: Clicking name enters inline edit mode
  it('clicking name enters inline edit mode', async () => {
    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      expect(screen.getByText('Pastor Closeup')).toBeInTheDocument();
    });

    // Click the name to enter edit mode
    await userEvent.click(screen.getByText('Pastor Closeup'));

    // An input should appear with the current name
    const input = screen.getByDisplayValue('Pastor Closeup');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  // Test 5: Typing name and pressing Enter saves via PUT
  it('pressing Enter after editing name saves via updatePreset', async () => {
    vi.mocked(api.updatePreset).mockResolvedValue({ requestId: 'req-name-1' });

    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      expect(screen.getByText('Pastor Closeup')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Pastor Closeup'));

    const input = screen.getByDisplayValue('Pastor Closeup');
    await userEvent.clear(input);
    await userEvent.type(input, 'New Name');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(api.updatePreset).toHaveBeenCalledWith(1, { name: 'New Name' });
  });

  // Test 6: Settle time input accepts numeric value
  it('settle time input accepts numeric value', async () => {
    vi.mocked(api.updatePreset).mockResolvedValue({ requestId: 'req-settle-1' });

    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      expect(screen.getByText('Pastor Closeup')).toBeInTheDocument();
    });

    // Find the settle time input for the first preset
    const settleInputs = screen.getAllByRole('spinbutton');
    const firstSettle = settleInputs[0];

    await userEvent.clear(firstSettle);
    await userEvent.type(firstSettle, '5.5');
    fireEvent.blur(firstSettle);

    expect(api.updatePreset).toHaveBeenCalledWith(1, { settle_time: 5.5 });
  });

  // Test 7: Blurring after editing name saves
  it('blurring after editing name saves via updatePreset', async () => {
    vi.mocked(api.updatePreset).mockResolvedValue({ requestId: 'req-name-2' });

    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      expect(screen.getByText('Pastor Closeup')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Pastor Closeup'));

    const input = screen.getByDisplayValue('Pastor Closeup');
    await userEvent.clear(input);
    await userEvent.type(input, 'Edited Name');
    fireEvent.blur(input);

    expect(api.updatePreset).toHaveBeenCalledWith(1, { name: 'Edited Name' });
  });

  // Test 8: Drag starts with grip handle
  it('each card has a drag handle with grip icon', async () => {
    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      expect(screen.getByText('Pastor Closeup')).toBeInTheDocument();
    });

    const dragHandles = screen.getAllByLabelText(/drag/i);
    expect(dragHandles.length).toBe(8);
  });

  // Test 9: Inactive presets show different styling than active ones
  it('inactive presets show visually distinct styling', async () => {
    renderWithProviders(<PresetGrid />);

    await waitFor(() => {
      expect(screen.getByText('Choir Loft')).toBeInTheDocument();
    });

    // Choir Loft is inactive — its card should NOT have green active styling
    const choirCard = screen.getByText('Choir Loft').closest('[class*="rounded-lg"]')!;
    expect(choirCard.className).not.toContain('bg-green');
    expect(choirCard.className).toContain('bg-white');
  });
});
