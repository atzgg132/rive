import { Pool } from "pg";
import { newDb } from "pg-mem";
import dotenv from "dotenv";

dotenv.config();

// ── In-memory fallback DB ─────────────────────────────────
const memDb = newDb();
memDb.public.none(`
  CREATE TABLE IF NOT EXISTS waitlist (
    id         SERIAL PRIMARY KEY,
    email      VARCHAR(255) UNIQUE NOT NULL,
    type       VARCHAR(50)  NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`);
memDb.public.none(`
  CREATE TABLE IF NOT EXISTS page_views (
    id         SERIAL PRIMARY KEY,
    path       VARCHAR(255) NOT NULL,
    referrer   VARCHAR(500),
    user_agent VARCHAR(500),
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`);

const MemPool = memDb.adapters.createPg().Pool;
const memPoolInstance = new MemPool();

// ── Live connection ───────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
let livePool: Pool | null = null;
let useFallback = false;

if (connectionString || process.env.DB_HOST) {
  livePool = new Pool({
    connectionString,
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "5432"),
    user:     process.env.DB_USER     || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME     || "rive",
  });
}

// ── Unified pool interface ────────────────────────────────
export const pool = {
  async query(text: string, params?: any[]) {
    if (useFallback || !livePool) {
      return memPoolInstance.query(text, params);
    }
    try {
      return await livePool.query(text, params);
    } catch (error) {
      console.warn("database: live query failed — falling back to in-memory db.");
      useFallback = true;
      return memPoolInstance.query(text, params);
    }
  },
};

// ── Schema init ───────────────────────────────────────────
export async function initDb() {
  if (!livePool) {
    console.log("database: no credentials — using in-memory postgresql db.");
    useFallback = true;
    return;
  }

  try {
    const client = await livePool.connect();
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id         SERIAL PRIMARY KEY,
        email      VARCHAR(255) UNIQUE NOT NULL,
        type       VARCHAR(50)  NOT NULL,
        status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Migrate: add status column if it doesn't exist yet on older DBs
    await client.query(`
      ALTER TABLE waitlist
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id         SERIAL PRIMARY KEY,
        path       VARCHAR(255) NOT NULL,
        referrer   VARCHAR(500),
        user_agent VARCHAR(500),
        visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
    console.log("database: connected to live postgresql database.");
  } catch (error) {
    console.warn("database: live connection failed — running in-memory fallback.");
    useFallback = true;
  }
}
