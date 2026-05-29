import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { createServer } from 'http';
import fs from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Module imports — these will FAIL in RED phase (modules not implemented yet)
import { initializeDb, getPassphraseHash, getDb } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import authRouter from '../routes/auth.js';

const TEST_DB_PATH = join(tmpdir(), `camflow-test-${Date.now()}.db`);

// Set test environment variables before any imports use them
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.PASSPHRASE = 'test-passphrase';

let app: express.Express;

async function setupApp(): Promise<express.Express> {
  // Override DB path for tests
  process.env.DB_PATH = TEST_DB_PATH;

  // Initialize the database
  initializeDb();

  const testApp = express();
  testApp.use(express.json());

  // Mount auth routes (public)
  testApp.use('/api/auth', authRouter);

  // Mount protected test route
  testApp.get('/api/health', authenticateToken, (_req, res) => {
    res.json({ status: 'ok', user: (res.req as any).user });
  });

  return testApp;
}

beforeAll(async () => {
  app = await setupApp();
});

afterAll(() => {
  const db = getDb();
  if (db) db.close();
  // Clean up test DB files
  try { fs.unlinkSync(TEST_DB_PATH); } catch {}
  try { fs.unlinkSync(TEST_DB_PATH + '-wal'); } catch {}
  try { fs.unlinkSync(TEST_DB_PATH + '-shm'); } catch {}
});

describe('Authentication & Database', () => {
  // ===== DATABASE SCHEMA TESTS =====
  describe('Database Schema', () => {
    it('users table has passphrase_hash TEXT NOT NULL column', () => {
      const db = getDb();
      const info = db.pragma('table_info(users)') as any[];
      const hashCol = info.find((col: any) => col.name === 'passphrase_hash');
      expect(hashCol).toBeDefined();
      expect(hashCol.notnull).toBe(1);
      expect(hashCol.type.toUpperCase()).toContain('TEXT');
    });

    it('presets table has all required columns (id, name, ptz_number, active, sort_order, settle_time)', () => {
      const db = getDb();
      const info = db.pragma('table_info(presets)') as any[];
      const colNames = info.map((col: any) => col.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('name');
      expect(colNames).toContain('ptz_number');
      expect(colNames).toContain('active');
      expect(colNames).toContain('sort_order');
      expect(colNames).toContain('settle_time');
    });

    it('seeds passphrase hash on first run', () => {
      const hash = getPassphraseHash();
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('seeds 8 default presets', () => {
      const db = getDb();
      const count = db.prepare('SELECT COUNT(*) as count FROM presets').get() as any;
      expect(count.count).toBe(8);
    });

    it('preset ptz_number CHECK enforces 1-8 range', () => {
      const db = getDb();
      expect(() => {
        db.prepare(
          'INSERT INTO presets (name, ptz_number, active, sort_order, settle_time) VALUES (?, ?, ?, ?, ?)'
        ).run('Invalid', 9, 0, 9, 2.5);
      }).toThrow();
    });
  });

  // ===== AUTH ENDPOINT TESTS =====
  describe('POST /api/auth/login', () => {
    it('returns 200 + JWT token with valid passphrase', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ passphrase: 'test-passphrase' })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');

      // Verify the token is valid JWT
      const decoded: any = jwt.verify(res.body.token, process.env.JWT_SECRET!);
      expect(decoded.role).toBe('operator');
    });

    it('returns 401 with wrong passphrase', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ passphrase: 'wrong-passphrase' })
        .expect(401);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 with no passphrase', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 with empty passphrase', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ passphrase: '' })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  // ===== PROTECTED ROUTE TESTS =====
  describe('GET /api/health (protected)', () => {
    it('returns 200 with valid JWT', async () => {
      const token = jwt.sign(
        { role: 'operator' },
        process.env.JWT_SECRET!,
        { expiresIn: '12h' }
      );

      const res = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.user.role).toBe('operator');
    });

    it('returns 401 with expired JWT', async () => {
      const expiredToken = jwt.sign(
        { role: 'operator' },
        process.env.JWT_SECRET!,
        { expiresIn: '0s' }
      );

      // Wait a moment for the token to actually expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const res = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('returns 401 with no token', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(401);
    });

    it('returns 403 with invalid token', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(403);

      expect(res.body.error).toBeDefined();
    });

    it('returns 401 with malformed Authorization header (no Bearer prefix)', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Authorization', 'NotABearerToken')
        .expect(401);

      expect(res.body.error).toBeDefined();
    });
  });
});
