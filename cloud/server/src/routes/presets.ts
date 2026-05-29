import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

// ===== GET /api/presets =====
// Returns all presets ordered by sort_order
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const presets = db.prepare(
      'SELECT id, name, ptz_number, active, sort_order, settle_time, created_at, updated_at FROM presets ORDER BY sort_order ASC'
    ).all();
    res.json(presets);
  } catch (error) {
    console.error('GET /api/presets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== PUT /api/presets/:id =====
// Updates a preset's name, ptz_number, active, and/or settle_time
router.put('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const presetId = parseInt(req.params.id, 10);

    if (isNaN(presetId) || presetId < 1) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    // Check preset exists
    const existing = db.prepare('SELECT id FROM presets WHERE id = ?').get(presetId);
    if (!existing) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    const { name, ptz_number, active, settle_time } = req.body;

    // Validate ptz_number if provided
    if (ptz_number !== undefined) {
      if (typeof ptz_number !== 'number' || !Number.isInteger(ptz_number) || ptz_number < 1 || ptz_number > 8) {
        res.status(400).json({ error: 'ptz_number must be an integer between 1 and 8' });
        return;
      }
    }

    // Validate active if provided
    if (active !== undefined) {
      if (active !== 0 && active !== 1) {
        res.status(400).json({ error: 'active must be 0 or 1' });
        return;
      }
    }

    // Validate settle_time if provided
    if (settle_time !== undefined) {
      if (typeof settle_time !== 'number' || settle_time <= 0) {
        res.status(400).json({ error: 'settle_time must be a positive number' });
        return;
      }
    }

    // Build update query dynamically — only update provided fields
    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(String(name));
    }
    if (ptz_number !== undefined) {
      updates.push('ptz_number = ?');
      values.push(ptz_number);
    }
    if (active !== undefined) {
      updates.push('active = ?');
      values.push(active);
    }
    if (settle_time !== undefined) {
      updates.push('settle_time = ?');
      values.push(settle_time);
    }

    // Always update updated_at
    updates.push("updated_at = datetime('now')");

    if (updates.length === 1) {
      // Only updated_at — nothing to change
      // Return existing preset as-is
      const preset = db.prepare('SELECT * FROM presets WHERE id = ?').get(presetId);
      res.json(preset);
      return;
    }

    values.push(presetId);

    db.prepare(`UPDATE presets SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Return the updated preset
    const updated = db.prepare(
      'SELECT id, name, ptz_number, active, sort_order, settle_time, created_at, updated_at FROM presets WHERE id = ?'
    ).get(presetId);
    res.json(updated);
  } catch (error) {
    console.error('PUT /api/presets/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== PATCH /api/presets/reorder =====
// Accepts array of {id, sort_order}, updates all in a transaction
router.patch('/reorder', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const reorderData = req.body;

    // Validate input is an array
    if (!Array.isArray(reorderData)) {
      res.status(400).json({ error: 'Request body must be an array of {id, sort_order} objects' });
      return;
    }

    if (reorderData.length === 0) {
      res.status(400).json({ error: 'Reorder array must not be empty' });
      return;
    }

    // Validate each item
    for (const item of reorderData) {
      if (typeof item.id !== 'number' || !Number.isInteger(item.id) || item.id < 1) {
        res.status(400).json({ error: `Invalid preset id: ${item.id}. Each item must have a valid id.` });
        return;
      }
      if (typeof item.sort_order !== 'number' || !Number.isInteger(item.sort_order)) {
        res.status(400).json({ error: `Invalid sort_order for preset ${item.id}. sort_order must be an integer.` });
        return;
      }
    }

    // Execute reorder in a transaction
    const updateStmt = db.prepare("UPDATE presets SET sort_order = ?, updated_at = datetime('now') WHERE id = ?");
    const reorder = db.transaction((items: Array<{ id: number; sort_order: number }>) => {
      for (const item of items) {
        updateStmt.run(item.sort_order, item.id);
      }
    });
    reorder(reorderData);

    // Return updated presets
    const presets = db.prepare(
      'SELECT id, name, ptz_number, active, sort_order, settle_time, created_at, updated_at FROM presets ORDER BY sort_order ASC'
    ).all();
    res.json(presets);
  } catch (error) {
    console.error('PATCH /api/presets/reorder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
