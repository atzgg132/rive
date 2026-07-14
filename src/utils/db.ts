import { Pool } from "pg";

let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (poolInstance) return poolInstance;

  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  // Strip pg-unsupported query parameters like channel_binding to prevent connection crashes
  connectionString = connectionString.replace(/([?&])channel_binding=[^&]*/g, "$1");
  connectionString = connectionString.replace(/[?&]$/, ""); // Clean up trailing ? or &

  poolInstance = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  return poolInstance;
}

let isSchemaInitialized = false;

// Helper to initialize tables if they don't exist yet
export async function initDbSchema(pool: Pool) {
  if (isSchemaInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id         SERIAL PRIMARY KEY,
        email      VARCHAR(255) UNIQUE NOT NULL,
        type       VARCHAR(50)  NOT NULL,
        status     VARCHAR(20)  NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE waitlist
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
      CREATE TABLE IF NOT EXISTS page_views (
        id         SERIAL PRIMARY KEY,
        path       VARCHAR(255) NOT NULL,
        referrer   VARCHAR(500),
        user_agent VARCHAR(500),
        visited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    isSchemaInitialized = true;
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    // Throw to let the caller handle it
    throw error;
  }
}
