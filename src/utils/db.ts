import { Pool } from "pg";

let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (poolInstance) return poolInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  poolInstance = new Pool({
    connectionString,
    // Enable SSL for Neon
    ssl: {
      rejectUnauthorized: false
    }
  });

  return poolInstance;
}

// Helper to initialize tables if they don't exist yet
export async function initDbSchema(pool: Pool) {
  const waitlistTable = `
    CREATE TABLE IF NOT EXISTS waitlist (
      id         SERIAL PRIMARY KEY,
      email      VARCHAR(255) UNIQUE NOT NULL,
      type       VARCHAR(50)  NOT NULL,
      status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const pageViewsTable = `
    CREATE TABLE IF NOT EXISTS page_views (
      id         SERIAL PRIMARY KEY,
      path       VARCHAR(255) NOT NULL,
      referrer   VARCHAR(500),
      user_agent VARCHAR(500),
      visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const client = await pool.connect();
  try {
    await client.query(waitlistTable);
    // Safe migration to add status if missing
    await client.query(`
      ALTER TABLE waitlist
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
    `);
    await client.query(pageViewsTable);
  } finally {
    client.release();
  }
}
