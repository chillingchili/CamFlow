import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import WebSocket from 'ws';
import { AddressInfo } from 'net';

// Module imports — will FAIL in RED phase
import { setupWebSocket } from '../ws/tunnel.js';
import commandsRouter from '../routes/commands.js';
import { authenticateToken } from '../middleware/auth.js';
import { initializeDb } from '../db/index.js';

const JWT_SECRET = 'test-jwt-secret-for-commands';
const AGENT_SECRET = 'test-agent-secret-for-commands';
const PASSPHRASE = 'test-passphrase-for-commands';

process.env.JWT_SECRET = JWT_SECRET;
process.env.AGENT_SHARED_SECRET = AGENT_SECRET;
process.env.PASSPHRASE = PASSPHRASE;

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

  // Mount auth routes
  const { default: authRouter } = await import('../routes/auth.js');
  testApp.use('/api/auth', authRouter);

  // Mount protected command routes
  testApp.use('/api', authenticateToken, commandsRouter);

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

describe('REST Command Endpoints', () => {
  // ===== AUTH TESTS =====
  describe('Authentication', () => {
    it('POST /api/obs/scene returns 401 without JWT', async () => {
      await request(app)
        .post('/api/obs/scene')
        .send({ sceneName: 'Cam 1' })
        .expect(401);
    });

    it('POST /api/ptz/preset/recall returns 401 without JWT', async () => {
      await request(app)
        .post('/api/ptz/preset/recall')
        .send({ presetNumber: 3 })
        .expect(401);
    });

    it('GET /api/agent/status returns 401 without JWT', async () => {
      await request(app)
        .get('/api/agent/status')
        .expect(401);
    });
  });

  // ===== AGENT STATUS TEST =====
  describe('GET /api/agent/status', () => {
    it('returns agent state with valid JWT', async () => {
      const res = await request(app)
        .get('/api/agent/status')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('connected');
      expect(res.body).toHaveProperty('lastHeartbeat');
      expect(res.body).toHaveProperty('health');
      expect(res.body.health).toHaveProperty('obs');
      expect(res.body.health).toHaveProperty('ptz');
    });
  });

  // ===== OBS ENDPOINT TESTS =====
  describe('POST /api/obs/scene', () => {
    it('returns 503 when no agent is connected', async () => {
      const res = await request(app)
        .post('/api/obs/scene')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ sceneName: 'Cam 1' })
        .expect(503);

      expect(res.body.error).toBe('Agent not connected');
    });

    it('returns 202 with requestId when agent is connected', async () => {
      // Connect an agent
      const agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });

      try {
        const res = await request(app)
          .post('/api/obs/scene')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ sceneName: 'Cam 1' })
          .expect(202);

        expect(res.body.requestId).toBeDefined();
        expect(typeof res.body.requestId).toBe('string');
        expect(res.body.status).toBe('pending');
      } finally {
        agentWs.close();
      }
    });

    it('returns 400 when sceneName is missing', async () => {
      const res = await request(app)
        .post('/api/obs/scene')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 400 when sceneName is empty string', async () => {
      const res = await request(app)
        .post('/api/obs/scene')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ sceneName: '' })
        .expect(400);

      expect(res.body.error).toBeDefined();
    });
  });

  // ===== PTZ PRESET RECALL TESTS =====
  describe('POST /api/ptz/preset/recall', () => {
    it('returns 202 with requestId when agent is connected', async () => {
      const agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });

      try {
        const res = await request(app)
          .post('/api/ptz/preset/recall')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ presetNumber: 3 })
          .expect(202);

        expect(res.body.requestId).toBeDefined();
        expect(res.body.status).toBe('pending');
      } finally {
        agentWs.close();
      }
    });

    it('returns 400 with presetNumber 0', async () => {
      const res = await request(app)
        .post('/api/ptz/preset/recall')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ presetNumber: 0 })
        .expect(400);

      expect(res.body.error).toMatch(/presetNumber.*1.*8/i);
    });

    it('returns 400 with presetNumber 9', async () => {
      const res = await request(app)
        .post('/api/ptz/preset/recall')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ presetNumber: 9 })
        .expect(400);

      expect(res.body.error).toMatch(/presetNumber.*1.*8/i);
    });

    it('returns 400 with missing presetNumber', async () => {
      const res = await request(app)
        .post('/api/ptz/preset/recall')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);

      expect(res.body.error).toBeDefined();
    });

    it('returns 503 when no agent connected', async () => {
      const res = await request(app)
        .post('/api/ptz/preset/recall')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ presetNumber: 3 })
        .expect(503);

      expect(res.body.error).toBe('Agent not connected');
    });
  });

  // ===== PTZ PRESET SAVE TESTS =====
  describe('POST /api/ptz/preset/save', () => {
    it('returns 202 with requestId when agent is connected', async () => {
      const agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });

      try {
        const res = await request(app)
          .post('/api/ptz/preset/save')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ presetNumber: 5 })
          .expect(202);

        expect(res.body.requestId).toBeDefined();
        expect(res.body.status).toBe('pending');
      } finally {
        agentWs.close();
      }
    });

    it('returns 400 with invalid presetNumber', async () => {
      const res = await request(app)
        .post('/api/ptz/preset/save')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ presetNumber: 10 })
        .expect(400);

      expect(res.body.error).toMatch(/presetNumber.*1.*8/i);
    });
  });

  // ===== COMMAND STATUS TEST =====
  describe('GET /api/command/:requestId', () => {
    it('returns 404 for non-existent requestId', async () => {
      await request(app)
        .get('/api/command/nonexistent-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);
    });

    it('returns command status for valid pending command', async () => {
      const agentWs = new WebSocket(`${wsBaseUrl}/ws?token=${AGENT_SECRET}`);
      await new Promise<void>((resolve, reject) => {
        agentWs.on('open', resolve);
        agentWs.on('error', reject);
        setTimeout(() => reject(new Error('Agent connect timeout')), 3000);
      });

      try {
        // Send a command to get a requestId
        const cmdRes = await request(app)
          .post('/api/obs/scene')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ sceneName: 'Cam 1' })
          .expect(202);

        const requestId = cmdRes.body.requestId;

        // Now poll the command status
        const statusRes = await request(app)
          .get(`/api/command/${requestId}`)
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(statusRes.body.requestId).toBe(requestId);
        expect(statusRes.body.status).toBe('pending');
      } finally {
        agentWs.close();
      }
    });
  });
});
