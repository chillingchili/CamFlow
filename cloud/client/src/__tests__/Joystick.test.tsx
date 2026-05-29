import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Joystick } from '../components/Joystick';

// Mock the API module
vi.mock('../services/api', () => ({
  ptzMove: vi.fn(),
  ptzZoom: vi.fn(),
  ptzStop: vi.fn(),
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

describe('Joystick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.ptzMove).mockResolvedValue({ requestId: 'req-move-1', status: 'pending' });
    vi.mocked(api.ptzZoom).mockResolvedValue({ requestId: 'req-zoom-1', status: 'pending' });
    vi.mocked(api.ptzStop).mockResolvedValue({ requestId: 'req-stop-1', status: 'pending' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Renders cross D-pad with up/down/left/right buttons
  it('renders cross D-pad with direction buttons', () => {
    render(<Joystick />);

    expect(screen.getByRole('button', { name: /up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /down/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /left/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /right/i })).toBeInTheDocument();
  });

  // Test 2: Renders zoom in/out buttons
  it('renders zoom in and zoom out buttons', () => {
    render(<Joystick />);

    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
  });

  // Test 3: Renders speed slider with 1-100 range
  it('renders speed slider with 1-100 range', () => {
    render(<Joystick />);

    const slider = screen.getByRole('slider', { name: /pan speed/i });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '100');
  });

  // Test 4: Press and hold sends ptzMove, release sends ptzStop
  it('press on direction button sends ptzMove, release sends ptzStop', async () => {
    render(<Joystick />);

    const upButton = screen.getByRole('button', { name: /up/i });

    // Mouse down = press
    fireEvent.pointerDown(upButton);
    expect(api.ptzMove).toHaveBeenCalledWith('up', expect.any(Number));

    // Mouse up = release
    fireEvent.pointerUp(upButton);
    expect(api.ptzStop).toHaveBeenCalled();
  });

  // Test 5: Speed slider updates the speed value
  it('speed slider changes the speed sent with move commands', async () => {
    render(<Joystick />);

    const slider = screen.getByRole('slider', { name: /pan speed/i });
    // Move slider to 75
    fireEvent.change(slider, { target: { value: '75' } });

    const upButton = screen.getByRole('button', { name: /up/i });
    fireEvent.pointerDown(upButton);

    expect(api.ptzMove).toHaveBeenCalledWith('up', 75);
  });

  // Test 6: Zoom buttons send ptzZoom
  it('zoom in button sends ptzZoom on press', async () => {
    render(<Joystick />);

    const zoomIn = screen.getByRole('button', { name: /zoom in/i });
    fireEvent.pointerDown(zoomIn);

    expect(api.ptzZoom).toHaveBeenCalledWith('in', expect.any(Number));
  });

  // Test 7: Zoom out button sends ptzZoom
  it('zoom out button sends ptzZoom on press', async () => {
    render(<Joystick />);

    const zoomOut = screen.getByRole('button', { name: /zoom out/i });
    fireEvent.pointerDown(zoomOut);

    expect(api.ptzZoom).toHaveBeenCalledWith('out', expect.any(Number));
  });

  // Test 8: Keyboard shortcuts display as hints on buttons
  it('displays keyboard shortcut hints on direction buttons', () => {
    render(<Joystick />);

    // Check for keyboard hint labels
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  // Test 9: Keyboard W triggers ptzMove up
  it('pressing W key triggers pan up', () => {
    render(<Joystick />);

    fireEvent.keyDown(document, { key: 'w' });
    expect(api.ptzMove).toHaveBeenCalledWith('up', expect.any(Number));
  });

  // Test 10: Keyboard R triggers zoom out, T triggers zoom in
  it('pressing R key triggers zoom out, T triggers zoom in', () => {
    render(<Joystick />);

    fireEvent.keyDown(document, { key: 'r' });
    expect(api.ptzZoom).toHaveBeenCalledWith('out', expect.any(Number));

    vi.clearAllMocks();
    fireEvent.keyDown(document, { key: 't' });
    expect(api.ptzZoom).toHaveBeenCalledWith('in', expect.any(Number));
  });

  // Test 11: Keyboard F/G adjust d-pad speed
  it('pressing F decreases speed, G increases speed', () => {
    render(<Joystick />);

    const panSlider = screen.getByRole('slider', { name: /pan speed/i });
    const initialSpeed = panSlider.getAttribute('value') || '50';

    fireEvent.keyDown(document, { key: 'g' });
    // Speed should increase
    expect(Number(panSlider.getAttribute('value'))).toBeGreaterThan(Number(initialSpeed));

    fireEvent.keyDown(document, { key: 'f' });
    // Speed should decrease back
    expect(Number(panSlider.getAttribute('value'))).toBe(Number(initialSpeed));
  });
});
