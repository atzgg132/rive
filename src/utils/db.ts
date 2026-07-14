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
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         VARCHAR(255) UNIQUE NOT NULL,
        name          VARCHAR(255),
        avatar_url    TEXT,
        password_hash TEXT NOT NULL,
        plan          VARCHAR(20) NOT NULL DEFAULT 'free',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS clients (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name          VARCHAR(255) NOT NULL,
        email         VARCHAR(255),
        phone         VARCHAR(50),
        company       VARCHAR(255),
        website       TEXT,
        address       TEXT,
        avatar_color  VARCHAR(7),
        notes         TEXT,
        tags          TEXT[],
        status        VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS projects (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
        title         VARCHAR(255) NOT NULL,
        description   TEXT,
        status        VARCHAR(20) NOT NULL DEFAULT 'active',
        priority      VARCHAR(10) NOT NULL DEFAULT 'medium',
        start_date    DATE,
        due_date      DATE,
        budget        NUMERIC(12,2),
        currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
        tags          TEXT[],
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS milestones (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title         VARCHAR(255) NOT NULL,
        due_date      DATE,
        completed     BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
        project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
        invoice_number VARCHAR(50) NOT NULL,
        status        VARCHAR(20) NOT NULL DEFAULT 'draft',
        currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
        subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax_rate      NUMERIC(5,2) NOT NULL DEFAULT 0,
        tax_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
        total         NUMERIC(12,2) NOT NULL DEFAULT 0,
        issue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
        due_date      DATE,
        paid_date     DATE,
        notes         TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_user_invoice_number UNIQUE (user_id, invoice_number)
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description   TEXT NOT NULL,
        quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
        unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
        amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
        sort_order    INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
        category      VARCHAR(50) NOT NULL DEFAULT 'other',
        description   TEXT NOT NULL,
        amount        NUMERIC(12,2) NOT NULL,
        currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
        date          DATE NOT NULL DEFAULT CURRENT_DATE,
        receipt_url   TEXT,
        is_billable   BOOLEAN NOT NULL DEFAULT FALSE,
        is_reimbursed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      -- Safe index creations
      CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
      CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON expenses(project_id);
      CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
    `);
    isSchemaInitialized = true;
  } catch (error) {
    console.error("Failed to initialize database schema:", error);
    throw error;
  }
}
