import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { createSchema } from './schema.js';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function initializeDb(): Database.Database {
  const dbPath = process.env.DB_PATH || './data/camflow.db';
  const dbDir = path.dirname(dbPath);

  // Ensure the data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create schema
  createSchema(db);

  // Seed passphrase hash if users table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  if (userCount.count === 0) {
    const passphrase = process.env.PASSPHRASE;
    if (!passphrase) {
      // In production, PASSPHRASE must be set
      // For tests, we'll skip seeding if not set
      console.warn('PASSPHRASE env var not set — skipping user seed');
      return db;
    }
    // Use synchronous hash for better-sqlite3 context
    const hash = bcrypt.hashSync(passphrase, 10);
    db.prepare('INSERT INTO users (id, passphrase_hash) VALUES (1, ?)').run(hash);
    console.log('Seeded passphrase hash for default user');
  }

  // Seed 8 default presets if presets table is empty
  const presetCount = db.prepare('SELECT COUNT(*) as count FROM presets').get() as any;
  if (presetCount.count === 0) {
    const insertPreset = db.prepare(
      'INSERT INTO presets (name, ptz_number, active, sort_order, settle_time) VALUES (?, ?, ?, ?, ?)'
    );
    const seedAll = db.transaction(() => {
      for (let i = 1; i <= 8; i++) {
        insertPreset.run(`Preset ${i}`, i, 0, i, 2.5);
      }
    });
    seedAll();
    console.log('Seeded 8 default presets');
  }

  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return db;
}

export function getPassphraseHash(): string | null {
  const database = getDb();
  const row = database.prepare('SELECT passphrase_hash FROM users WHERE id = 1').get() as any;
  return row?.passphrase_hash ?? null;
}

export function updatePassphraseHash(newHash: string): void {
  const database = getDb();
  database.prepare('UPDATE users SET passphrase_hash = ? WHERE id = 1').run(newHash);
}

export default db;
