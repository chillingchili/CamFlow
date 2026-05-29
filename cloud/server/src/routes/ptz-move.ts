import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { sendToAgent, getAgentState } from '../ws/tunnel.js';

const router = Router();

// ===== VALIDATION HELPERS =====
const VALID_MOVE_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
const VALID_ZOOM_DIRECTIONS = ['in', 'out'] as const;

function validateDirection(
  direction: unknown,
  validSet: readonly string[]
): { valid: false; error: string } | { valid: true; value: string } {
  if (!direction || typeof direction !== 'string' || direction.trim() === '') {
    return { valid: false, error: `direction must be one of: ${validSet.join(', ')}` };
  }
  const dir = direction.trim().toLowerCase();
  if (!validSet.includes(dir)) {
    return { valid: false, error: `direction must be one of: ${validSet.join(', ')}` };
  }
  return { valid: true, value: dir };
}

function validateSpeed(speed: unknown): { valid: false; error: string } | { valid: true; value: number } {
  if (typeof speed !== 'number' || isNaN(speed)) {
    return { valid: false, error: 'speed must be a number between 1 and 100' };
  }
  if (speed < 1 || speed > 100) {
    return { valid: false, error: 'speed must be between 1 and 100' };
  }
  return { valid: true, value: speed };
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

// ===== PTZ MOVEMENT ENDPOINTS =====
// POST /api/ptz/move — pan/tilt in a direction
router.post('/move', (req: Request, res: Response) => {
  try {
    const directionValidation = validateDirection(req.body?.direction, VALID_MOVE_DIRECTIONS as unknown as string[]);
    if (!directionValidation.valid) {
      res.status(400).json({ error: directionValidation.error });
      return;
    }

    const speedValidation = validateSpeed(req.body?.speed);
    if (!speedValidation.valid) {
      res.status(400).json({ error: speedValidation.error });
      return;
    }

    if (!ensureAgentConnected(res)) return;

    queueCommand(res, {
      type: 'ptz_move',
      direction: directionValidation.value,
      speed: speedValidation.value,
    });
  } catch (error) {
    console.error('PTZ move error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ptz/zoom — zoom in or out
router.post('/zoom', (req: Request, res: Response) => {
  try {
    const directionValidation = validateDirection(req.body?.direction, VALID_ZOOM_DIRECTIONS as unknown as string[]);
    if (!directionValidation.valid) {
      res.status(400).json({ error: directionValidation.error });
      return;
    }

    const speedValidation = validateSpeed(req.body?.speed);
    if (!speedValidation.valid) {
      res.status(400).json({ error: speedValidation.error });
      return;
    }

    if (!ensureAgentConnected(res)) return;

    queueCommand(res, {
      type: 'ptz_zoom',
      direction: directionValidation.value,
      speed: speedValidation.value,
    });
  } catch (error) {
    console.error('PTZ zoom error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/ptz/stop — stop all PTZ movement
router.post('/stop', (_req: Request, res: Response) => {
  try {
    if (!ensureAgentConnected(res)) return;

    queueCommand(res, { type: 'ptz_stop' });
  } catch (error) {
    console.error('PTZ stop error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
