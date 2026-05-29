import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import WebSocket from 'ws';
import { AddressInfo } from 'net';

// Module imports — will FAIL in RED phase (ptz-move route doesn't exist yet)
import { setupWebSocket } from '../ws/tunnel.js';
import ptzMoveRouter from '../routes/ptz-move.js';
import { authenticateToken } from '../middleware/auth.js';
import { initializeDb } from '../db/index.js';

const JWT_SECRET = 'test-jwt-secret-for-ptz';
const AGENT_SECRET = 'test-agent-secret-for-ptz';

process.env.JWT_SECRET = JWT_SECRET;
process.env.AGENT_SHARED_SECRET = AGENT_SECRET;

let app: express.Express;
let httpServer: ReturnType<typeof createServer>;
let baseUrl: string;
let wsBaseUrl: string;
let validToken: string;

function getPort(): number {
  const addr = httpServer.address() as AddressInfo;
  return addr.port;
}

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  initializeDb();

  validToken = jwt.sign({ role: 'operator' }, JWT_SECRET, { expiresIn: '12h' });

  const testApp = express();
  testApp.use(express.json());

  // Mount protected PTZ movement routes: /api/ptz/*
  testApp.use('/api/ptz', authenticateToken, ptzMoveRouter);

  app = testApp;
  httpServer = createServer(app);
  setupWebSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });

  const port = getPort();
  baseUrl = `http://localhost:${port}`;
  wsBaseUrl = `ws://localhost:${port}`;
});

afterAll(() => {
  httpServer.close();
});

describe('PTZ Movement API', () => {
  // ===== AUTH TESTS =====
  describe('Authentication', () => {
    it('POST /api/ptz/move returns 401 without JWT', async () => {
      await request(app)
        .post('/api/ptz/move')
        .send({ direction: 'up', speed: 50 })
        .expect(401);
    });

    it('POST /api/ptz/zoom returns 401 without JWT', async () => {
      await request(app)
        .post('/api/ptz/zoom')
        .send({ direction: 'in', speed: 30 })
        .expect(401);
    });

    it('POST /api/ptz/stop returns 401 without JWT', async () => {
      await request(app)
        .post('/api/ptz/stop')
        .expect(401);
    });
  });

  // ===== POST /api/ptz/move =====
  describe('POST /api/ptz/move', () => {
    it('returns 202 with requestId when agent is connected', async () => {
      const agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });

      try {
        const res = await request(app)
          .post('/api/ptz/move')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ direction: 'up', speed: 50 })
          .expect(202);

        expect(res.body.requestId).toBeDefined();
        expect(typeof res.body.requestId).toBe('string');
        expect(res.body.status).toBe('pending');
      } finally {
        agentWs.close();
      }
    });

    it('validates direction is one of: up, down, left, right', async () => {
      const res = await request(app)
        .post('/api/ptz/move')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'diagonal', speed: 50 })
        .expect(400);

      expect(res.body.error).toMatch(/direction/i);
    });

    it('rejects empty direction', async () => {
      const res = await request(app)
        .post('/api/ptz/move')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: '', speed: 50 })
        .expect(400);

      expect(res.body.error).toMatch(/direction/i);
    });

    it('validates speed is number between 1-100', async () => {
      const res = await request(app)
        .post('/api/ptz/move')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'up', speed: 0 })
        .expect(400);

      expect(res.body.error).toMatch(/speed/i);
    });

    it('rejects speed > 100', async () => {
      const res = await request(app)
        .post('/api/ptz/move')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'up', speed: 101 })
        .expect(400);

      expect(res.body.error).toMatch(/speed/i);
    });

    it('rejects missing direction', async () => {
      const res = await request(app)
        .post('/api/ptz/move')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ speed: 50 })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('rejects missing speed', async () => {
      const res = await request(app)
        .post('/api/ptz/move')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'up' })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 503 when no agent is connected', async () => {
      const res = await request(app)
        .post('/api/ptz/move')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'up', speed: 50 })
        .expect(503);

      expect(res.body.error).toBe('Agent not connected');
    });
  });

  // ===== POST /api/ptz/zoom =====
  describe('POST /api/ptz/zoom', () => {
    it('returns 202 with requestId when agent is connected', async () => {
      const agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });

      try {
        const res = await request(app)
          .post('/api/ptz/zoom')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ direction: 'in', speed: 30 })
          .expect(202);

        expect(res.body.requestId).toBeDefined();
        expect(res.body.status).toBe('pending');
      } finally {
        agentWs.close();
      }
    });

    it('validates direction is one of: in, out', async () => {
      const res = await request(app)
        .post('/api/ptz/zoom')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'sideways', speed: 30 })
        .expect(400);

      expect(res.body.error).toMatch(/direction/i);
    });

    it('validates zoom speed is number 1-100', async () => {
      const res = await request(app)
        .post('/api/ptz/zoom')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'in', speed: 150 })
        .expect(400);

      expect(res.body.error).toMatch(/speed/i);
    });

    it('returns 503 when no agent is connected', async () => {
      const res = await request(app)
        .post('/api/ptz/zoom')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ direction: 'in', speed: 30 })
        .expect(503);

      expect(res.body.error).toBe('Agent not connected');
    });
  });

  // ===== POST /api/ptz/stop =====
  describe('POST /api/ptz/stop', () => {
    it('returns 202 with requestId when agent is connected', async () => {
      const agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });

      try {
        const res = await request(app)
          .post('/api/ptz/stop')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(202);

        expect(res.body.requestId).toBeDefined();
        expect(res.body.status).toBe('pending');
      } finally {
        agentWs.close();
      }
    });

    it('returns 503 when no agent is connected', async () => {
      const res = await request(app)
        .post('/api/ptz/stop')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(503);

      expect(res.body.error).toBe('Agent not connected');
    });
  });
});
