import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPassphraseHash, initializeDb } from '../db/index.js';

const router = Router();

// Ensure DB is initialized when routes are loaded
initializeDb();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { passphrase } = req.body;

    if (!passphrase || typeof passphrase !== 'string' || passphrase.trim() === '') {
      res.status(400).json({ error: 'Passphrase is required' });
      return;
    }

    const storedHash = getPassphraseHash();
    if (!storedHash) {
      res.status(500).json({ error: 'Server not configured — no passphrase set' });
      return;
    }

    const match = await bcrypt.compare(passphrase, storedHash);

    if (!match) {
      res.status(401).json({ error: 'Wrong passphrase' });
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const token = jwt.sign(
      { role: 'operator' },
      secret,
      { expiresIn: '12h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
