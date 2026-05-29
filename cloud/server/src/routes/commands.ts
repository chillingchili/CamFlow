import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { sendToAgent, getAgentState, getPendingCommand } from '../ws/tunnel.js';

const router = Router();

// ===== VALIDATION HELPERS =====
function validatePresetNumber(presetNumber: unknown): { valid: false; error: string } | { valid: true; value: number } {
  if (typeof presetNumber !== 'number' || !Number.isInteger(presetNumber)) {
    return { valid: false, error: 'presetNumber must be an integer between 1 and 8' };
  }
  if (presetNumber < 1 || presetNumber > 8) {
    return { valid: false, error: 'presetNumber must be between 1 and 8' };
  }
  return { valid: true, value: presetNumber };
}

function validateSceneName(sceneName: unknown): { valid: false; error: string } | { valid: true; value: string } {
  if (!sceneName || typeof sceneName !== 'string' || sceneName.trim() === '') {
    return { valid: false, error: 'sceneName must be a non-empty string' };
  }
  return { valid: true, value: sceneName.trim() };
}

function ensureAgentConnected(res: Response): boolean {
  if (!getAgentState().connected) {
    res.status(503).json({ error: 'Agent not connected' });
    return false;
  }
  return true;
}

function queueCommand(res: Response, command: Record<string, unknown>): void {
  const requestId = crypto.randomUUID();
  const sent = sendToAgent(requestId, command);

  if (!sent) {
    res.status(503).json({ error: 'Failed to send command to agent' });
    return;
  }

  res.status(202).json({ requestId, status: 'pending' });
}

// ===== OBS ENDPOINTS =====
// POST /api/obs/scene
router.post('/obs/scene', (req: Request, res: Response) => {
  try {
    const validation = validateSceneName(req.body?.sceneName);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    if (!ensureAgentConnected(res)) return;

    queueCommand(res, { type: 'obs_scene', sceneName: validation.value });
  } catch (error) {
    console.error('OBS scene error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== PTZ ENDPOINTS =====
// POST /api/ptz/preset/recall
router.post('/ptz/preset/recall', (req: Request, res: Response) => {
  try {
    const validation = validatePresetNumber(req.body?.presetNumber);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    if (!ensureAgentConnected(res)) return;

    queueCommand(res, { type: 'ptz_preset_recall', presetNumber: validation.value });
  } catch (error) {
    console.error('PTZ recall error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ptz/preset/save
router.post('/ptz/preset/save', (req: Request, res: Response) => {
  try {
    const validation = validatePresetNumber(req.body?.presetNumber);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    if (!ensureAgentConnected(res)) return;

    queueCommand(res, { type: 'ptz_preset_save', presetNumber: validation.value });
  } catch (error) {
    console.error('PTZ save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== AGENT STATUS ENDPOINT =====
// GET /api/agent/status
router.get('/agent/status', (_req: Request, res: Response) => {
  try {
    const state = getAgentState();
    res.json(state);
  } catch (error) {
    console.error('Agent status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== COMMAND STATUS ENDPOINT =====
// GET /api/command/:requestId
router.get('/command/:requestId', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const command = getPendingCommand(requestId);

    if (!command) {
      res.status(404).json({ error: 'Command not found' });
      return;
    }

    res.json({
      requestId: command.requestId,
      status: command.status,
      error: command.error,
    });
  } catch (error) {
    console.error('Command status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
