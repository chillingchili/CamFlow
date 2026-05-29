import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mock functions must be hoisted so vi.mock factory can access them
const { mockSetScene, mockRecallPreset, mockSavePreset, mockMove, mockZoom, mockStop } = vi.hoisted(() => ({
  mockSetScene: vi.fn(),
  mockRecallPreset: vi.fn(),
  mockSavePreset: vi.fn(),
  mockMove: vi.fn(),
  mockZoom: vi.fn(),
  mockStop: vi.fn(),
}));

vi.mock('../obs.js', () => ({
  setScene: mockSetScene,
}));

vi.mock('../ptz.js', () => ({
  recallPreset: mockRecallPreset,
  savePreset: mockSavePreset,
  move: mockMove,
  zoom: mockZoom,
  stop: mockStop,
}));

import { dispatch } from '../router.js';

let lastAck = null;

function createSendAck() {
  lastAck = null;
  return (ack) => {
    lastAck = ack;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lastAck = null;
  mockSetScene.mockResolvedValue(undefined);
  mockRecallPreset.mockResolvedValue(undefined);
  mockSavePreset.mockResolvedValue(undefined);
  mockMove.mockResolvedValue(undefined);
  mockZoom.mockResolvedValue(undefined);
  mockStop.mockResolvedValue(undefined);
});

describe('obs_scene dispatch', () => {
  it('dispatches obs_scene command to OBS setScene', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'obs_scene', sceneName: 'Cam 1 PTZ' },
      'req-123',
      sendAck
    );
    expect(mockSetScene).toHaveBeenCalledWith('Cam 1 PTZ');
  });

  it('sends ACK with status ok on success', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'obs_scene', sceneName: 'Cam 1 PTZ' },
      'req-456',
      sendAck
    );
    expect(lastAck).toEqual({
      type: 'ack',
      requestId: 'req-456',
      status: 'ok',
    });
  });

  it('sends ACK with status error on OBS failure', async () => {
    mockSetScene.mockRejectedValueOnce(new Error('OBS not connected'));
    const sendAck = createSendAck();
    await dispatch(
      { type: 'obs_scene', sceneName: 'Broken Scene' },
      'req-789',
      sendAck
    );
    expect(lastAck.type).toBe('ack');
    expect(lastAck.requestId).toBe('req-789');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('OBS not connected');
  });

  it('sends ACK error on OBS timeout (2s)', async () => {
    // Make setScene hang forever
    mockSetScene.mockImplementationOnce(() => new Promise(() => {}));
    const sendAck = createSendAck();

    const dispatchPromise = dispatch(
      { type: 'obs_scene', sceneName: 'Slow Scene' },
      'req-timeout-obs',
      sendAck
    );

    await dispatchPromise;

    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('timed out');
  }, 10000);
});

describe('ptz_preset_recall dispatch', () => {
  it('dispatches ptz_preset_recall to PTZ recallPreset', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_preset_recall', presetNumber: 3 },
      'req-recall',
      sendAck
    );
    expect(mockRecallPreset).toHaveBeenCalledWith(3);
  });

  it('sends ACK ok on success', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_preset_recall', presetNumber: 5 },
      'req-ok',
      sendAck
    );
    expect(lastAck).toEqual({
      type: 'ack',
      requestId: 'req-ok',
      status: 'ok',
    });
  });
});

describe('ptz_preset_save dispatch', () => {
  it('dispatches ptz_preset_save to PTZ savePreset', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_preset_save', presetNumber: 7 },
      'req-save',
      sendAck
    );
    expect(mockSavePreset).toHaveBeenCalledWith(7);
  });

  it('sends ACK error on PTZ timeout (5s)', async () => {
    mockSavePreset.mockImplementationOnce(() => new Promise(() => {}));
    const sendAck = createSendAck();

    const dispatchPromise = dispatch(
      { type: 'ptz_preset_save', presetNumber: 1 },
      'req-timeout',
      sendAck
    );

    await dispatchPromise;

    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toBeDefined();
  }, 10000);
});

describe('ptz_move dispatch', () => {
  it('dispatches ptz_move to ptz.move() with correct direction and speed', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_move', direction: 'up', speed: 50 },
      'req-move-up',
      sendAck
    );
    expect(mockMove).toHaveBeenCalledWith('up', 50);
  });

  it('sends ACK ok on success', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_move', direction: 'down', speed: 75 },
      'req-move-ok',
      sendAck
    );
    expect(lastAck).toEqual({
      type: 'ack',
      requestId: 'req-move-ok',
      status: 'ok',
    });
  });

  it('sends ACK error on ptz.move() failure', async () => {
    mockMove.mockRejectedValueOnce(new Error('Camera unreachable'));
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_move', direction: 'right', speed: 30 },
      'req-move-fail',
      sendAck
    );
    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('Camera unreachable');
  });

  it('sends ACK error on timeout (5s)', async () => {
    mockMove.mockImplementationOnce(() => new Promise(() => {}));
    const sendAck = createSendAck();
    const dispatchPromise = dispatch(
      { type: 'ptz_move', direction: 'left', speed: 10 },
      'req-move-timeout',
      sendAck
    );
    await dispatchPromise;
    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('timed out');
  }, 10000);

  it('sends ACK error on invalid direction', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_move', direction: 'diagonal', speed: 50 },
      'req-invalid-dir',
      sendAck
    );
    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('Invalid direction');
  });

  it('sends ACK error on speed 0', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_move', direction: 'up', speed: 0 },
      'req-speed-0',
      sendAck
    );
    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('Speed must be 1-100');
  });

  it('sends ACK error on speed 101', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_move', direction: 'up', speed: 101 },
      'req-speed-101',
      sendAck
    );
    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('Speed must be 1-100');
  });
});

describe('ptz_zoom dispatch', () => {
  it('dispatches ptz_zoom to ptz.zoom() with correct direction and speed', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_zoom', direction: 'in', speed: 60 },
      'req-zoom-in',
      sendAck
    );
    expect(mockZoom).toHaveBeenCalledWith('in', 60);
  });

  it('sends ACK ok on success', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_zoom', direction: 'out', speed: 40 },
      'req-zoom-ok',
      sendAck
    );
    expect(lastAck).toEqual({
      type: 'ack',
      requestId: 'req-zoom-ok',
      status: 'ok',
    });
  });

  it('sends ACK error on ptz.zoom() failure', async () => {
    mockZoom.mockRejectedValueOnce(new Error('Zoom motor error'));
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_zoom', direction: 'in', speed: 80 },
      'req-zoom-fail',
      sendAck
    );
    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('Zoom motor error');
  });
});

describe('ptz_stop dispatch', () => {
  it('dispatches ptz_stop to ptz.stop()', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_stop' },
      'req-stop',
      sendAck
    );
    expect(mockStop).toHaveBeenCalled();
  });

  it('sends ACK ok on success', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_stop' },
      'req-stop-ok',
      sendAck
    );
    expect(lastAck).toEqual({
      type: 'ack',
      requestId: 'req-stop-ok',
      status: 'ok',
    });
  });

  it('sends ACK error on ptz.stop() failure', async () => {
    mockStop.mockRejectedValueOnce(new Error('Camera not connected'));
    const sendAck = createSendAck();
    await dispatch(
      { type: 'ptz_stop' },
      'req-stop-fail',
      sendAck
    );
    expect(lastAck.type).toBe('ack');
    expect(lastAck.status).toBe('error');
    expect(lastAck.error).toContain('Camera not connected');
  });
});

describe('unknown command type', () => {
  it('sends ACK error for unknown command types', async () => {
    const sendAck = createSendAck();
    await dispatch(
      { type: 'invalid_command' },
      'req-unknown',
      sendAck
    );
    expect(lastAck).toEqual({
      type: 'ack',
      requestId: 'req-unknown',
      status: 'error',
      error: 'Unknown command type: invalid_command',
    });
  });
});
