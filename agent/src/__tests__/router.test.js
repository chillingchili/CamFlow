import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mock functions must be hoisted so vi.mock factory can access them
const { mockSetScene, mockRecallPreset, mockSavePreset } = vi.hoisted(() => ({
  mockSetScene: vi.fn(),
  mockRecallPreset: vi.fn(),
  mockSavePreset: vi.fn(),
}));

vi.mock('../obs.js', () => ({
  setScene: mockSetScene,
}));

vi.mock('../ptz.js', () => ({
  recallPreset: mockRecallPreset,
  savePreset: mockSavePreset,
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
