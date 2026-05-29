import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { setupWebSocket } from './ws/tunnel.js';
import authRouter from './routes/auth.js';
import commandsRouter from './routes/commands.js';
import presetsRouter from './routes/presets.js';
import ptzMoveRouter from './routes/ptz-move.js';
import { authenticateToken } from './middleware/auth.js';
import { initializeDb } from './db/index.js';

// Initialize the database on startup
initializeDb();

const app = express();
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', authRouter);

// Protected health check
app.get('/api/health', authenticateToken, (req, res) => {
  res.json({ status: 'ok', user: (req as any).user });
});

// Protected command routes
app.use('/api', authenticateToken, commandsRouter);

// Protected preset management routes
app.use('/api/presets', authenticateToken, presetsRouter);

// Protected PTZ movement routes
app.use('/api/ptz', authenticateToken, ptzMoveRouter);

const server = createServer(app);
setupWebSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CamFlow cloud running on port ${PORT}`);
});

export { app, server };
