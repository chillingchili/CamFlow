import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Module imports — will FAIL in RED phase (presets route doesn't exist yet)
import presetsRouter from '../routes/presets.js';
import { authenticateToken } from '../middleware/auth.js';
import { initializeDb, getDb } from '../db/index.js';

const JWT_SECRET = 'test-jwt-secret-for-presets';

process.env.JWT_SECRET = JWT_SECRET;

let app: express.Express;
let validToken: string;
let db: ReturnType<typeof getDb>;

beforeAll(() => {
  process.env.DB_PATH = ':memory:';
  initializeDb();
  db = getDb();

  validToken = jwt.sign({ role: 'operator' }, JWT_SECRET, { expiresIn: '12h' });

  const testApp = express();
  testApp.use(express.json());

  // Mount protected preset routes: /api/presets/*
  testApp.use('/api/presets', authenticateToken, presetsRouter);

  app = testApp;
});

// Reset presets to defaults before each test for isolation
beforeEach(() => {
  // Delete all presets and reset autoincrement so IDs restart at 1
  db.exec('DELETE FROM presets');
  db.exec("DELETE FROM sqlite_sequence WHERE name = 'presets'");
  const insertPreset = db.prepare(
    'INSERT INTO presets (id, name, ptz_number, active, sort_order, settle_time) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const seedAll = db.transaction(() => {
    for (let i = 1; i <= 8; i++) {
      insertPreset.run(i, `Preset ${i}`, i, 0, i, 2.5);
    }
  });
  seedAll();
});

describe('Preset Management API', () => {
  // ===== AUTH TESTS =====
  describe('Authentication', () => {
    it('GET /api/presets returns 401 without JWT', async () => {
      await request(app)
        .get('/api/presets')
        .expect(401);
    });

    it('PUT /api/presets/:id returns 401 without JWT', async () => {
      await request(app)
        .put('/api/presets/1')
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('PATCH /api/presets/reorder returns 401 without JWT', async () => {
      await request(app)
        .patch('/api/presets/reorder')
        .send([{ id: 1, sort_order: 100 }])
        .expect(401);
    });
  });

  // ===== GET /api/presets =====
  describe('GET /api/presets', () => {
    it('returns all 8 presets ordered by sort_order with valid JWT', async () => {
      const res = await request(app)
        .get('/api/presets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body).toHaveLength(8);
      // Verify sort_order ordering
      for (let i = 0; i < 8; i++) {
        expect(res.body[i].sort_order).toBe(i + 1);
      }
    });

    it('each preset has all expected fields', async () => {
      const res = await request(app)
        .get('/api/presets')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const preset = res.body[0];
      expect(preset).toHaveProperty('id');
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('ptz_number');
      expect(preset).toHaveProperty('active');
      expect(preset).toHaveProperty('sort_order');
      expect(preset).toHaveProperty('settle_time');
      expect(preset).toHaveProperty('created_at');
      expect(preset).toHaveProperty('updated_at');
    });
  });

  // ===== PUT /api/presets/:id =====
  describe('PUT /api/presets/:id', () => {
    it('updates name, ptz_number, active, and settle_time for a preset', async () => {
      const res = await request(app)
        .put('/api/presets/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Pastor Wide',
          ptz_number: 3,
          active: 1,
          settle_time: 3.0,
        })
        .expect(200);

      expect(res.body.id).toBe(1);
      expect(res.body.name).toBe('Pastor Wide');
      expect(res.body.ptz_number).toBe(3);
      expect(res.body.active).toBe(1);
      expect(res.body.settle_time).toBe(3.0);

      // Verify persistence in database
      const row = db.prepare('SELECT * FROM presets WHERE id = 1').get() as any;
      expect(row.name).toBe('Pastor Wide');
      expect(row.ptz_number).toBe(3);
      expect(row.active).toBe(1);
      expect(row.settle_time).toBe(3.0);
      // updated_at may equal created_at in sub-second test runs (SQLite second precision)
      expect(row.updated_at).toBeDefined();
    });

    it('partial update — only name changes', async () => {
      const res = await request(app)
        .put('/api/presets/2')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Choir' })
        .expect(200);

      expect(res.body.name).toBe('Choir');
      // Other fields should remain unchanged
      const row = db.prepare('SELECT * FROM presets WHERE id = 2').get() as any;
      expect(row.name).toBe('Choir');
      expect(row.ptz_number).toBe(2); // original value
    });

    it('returns 404 for invalid preset ID (0)', async () => {
      const res = await request(app)
        .put('/api/presets/0')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Nowhere' })
        .expect(404);

      expect(res.body.error).toBe('Preset not found');
    });

    it('returns 404 for invalid preset ID (999)', async () => {
      const res = await request(app)
        .put('/api/presets/999')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Nowhere' })
        .expect(404);

      expect(res.body.error).toBe('Preset not found');
    });

    it('validates ptz_number range (must be 1-8)', async () => {
      const res = await request(app)
        .put('/api/presets/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ ptz_number: 0 })
        .expect(400);

      expect(res.body.error).toMatch(/ptz_number.*1.*8/i);
    });

    it('validates ptz_number range — rejects 9', async () => {
      const res = await request(app)
        .put('/api/presets/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ ptz_number: 9 })
        .expect(400);

      expect(res.body.error).toMatch(/ptz_number.*1.*8/i);
    });

    it('validates settle_time > 0', async () => {
      const res = await request(app)
        .put('/api/presets/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ settle_time: 0 })
        .expect(400);

      expect(res.body.error).toMatch(/settle_time/i);
    });

    it('validates settle_time — rejects negative', async () => {
      const res = await request(app)
        .put('/api/presets/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ settle_time: -1 })
        .expect(400);

      expect(res.body.error).toMatch(/settle_time/i);
    });

    it('validates active is boolean-like (0 or 1)', async () => {
      const res = await request(app)
        .put('/api/presets/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ active: 5 })
        .expect(400);

      expect(res.body.error).toMatch(/active/i);
    });
  });

  // ===== PATCH /api/presets/reorder =====
  describe('PATCH /api/presets/reorder', () => {
    it('reorders all presets in a transaction', async () => {
      const res = await request(app)
        .patch('/api/presets/reorder')
        .set('Authorization', `Bearer ${validToken}`)
        .send([
          { id: 1, sort_order: 5 },
          { id: 2, sort_order: 3 },
          { id: 3, sort_order: 8 },
          { id: 4, sort_order: 1 },
          { id: 5, sort_order: 4 },
          { id: 6, sort_order: 7 },
          { id: 7, sort_order: 2 },
          { id: 8, sort_order: 6 },
        ])
        .expect(200);

      expect(res.body).toHaveLength(8);
      // Verify sort orders were applied
      const row1 = db.prepare('SELECT sort_order FROM presets WHERE id = 1').get() as any;
      expect(row1.sort_order).toBe(5);
      const row4 = db.prepare('SELECT sort_order FROM presets WHERE id = 4').get() as any;
      expect(row4.sort_order).toBe(1);
    });

    it('returns 400 for empty reorder array', async () => {
      const res = await request(app)
        .patch('/api/presets/reorder')
        .set('Authorization', `Bearer ${validToken}`)
        .send([])
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for non-array body', async () => {
      const res = await request(app)
        .patch('/api/presets/reorder')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ id: 1, sort_order: 5 })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for missing sort_order in an item', async () => {
      const res = await request(app)
        .patch('/api/presets/reorder')
        .set('Authorization', `Bearer ${validToken}`)
        .send([{ id: 1 }, { id: 2, sort_order: 2 }])
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });
});
