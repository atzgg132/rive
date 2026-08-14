/**
 * In-memory Prisma mock for the no-DB domain tests that must drive server-bound
 * commit logic (`commitMigration`).
 *
 * This module is substituted for `@/utils/db` by the resolution hook. It
 * exports the same two names the server module uses (`prisma`, `Prisma`) but
 * backed by plain arrays, so the test can seed rows, force a mid-batch crash,
 * and assert on the resulting state without a real database.
 *
 * The mock has no delete capability whatsoever — by construction, matching the
 * production no-delete policy. A test that wants to "clean up" simply discards
 * its own mock instance.
 */

/**
 * Prisma error-code surface the commit path inspects (P2002 = unique hit).
 */
export class PrismaClientKnownRequestError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = "PrismaClientKnownRequestError";
    this.code = code || "P2000";
  }
}

/** Decimal placeholder. Commit only calls .toFixed(2) and .abs() on it. */
class MockDecimal {
  constructor(value) {
    this.value = typeof value === "number" ? value : Number.parseFloat(String(value));
  }
  toFixed(digits) {
    return this.value.toFixed(digits);
  }
  abs() {
    return new MockDecimal(Math.abs(this.value));
  }
  toString() {
    return this.value.toString();
  }
}

export const Prisma = {
  Decimal: MockDecimal,
  PrismaClientKnownRequestError,
  InputJsonObject: Object,
  InputJsonValue: Object,
  JsonValue: Object,
};

function row(model, data) {
  return {
    id: `id-${model}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  };
}

function pick(record, select) {
  if (!select) return { ...record };
  const out = {};
  for (const [key, value] of Object.entries(select)) {
    if (value === true) out[key] = record[key];
  }
  return out;
}

export function createPrismaMock() {
  const db = {
    importJob: [],
    migrationRecord: [],
    migrationOperation: [],
    importedRecord: [],
    client: [],
    project: [],
    invoice: [],
    expense: [],
    migrationEvent: [],
    user: [],
  };

  let failOnCall = -1; // -1 = never; 0 = first $transaction call; 1 = second
  let transactionCallCount = 0;

  const api = {
    __db: db,
    /** Arm the Nth $transaction call to throw (0 = first call). */
    __armFailure: (nthCall = 0) => { failOnCall = nthCall; },
    __reset: () => {
      for (const table of Object.keys(db)) db[table] = [];
    },

    importJob: {
      async findFirst({ where }) {
        const job = db.importJob.find((j) => j.id === where.id);
        return job ? { ...job } : null;
      },
      async updateMany({ where, data }) {
        const job = db.importJob[0];
        if (!job) return { count: 0 };
        if (where.id && where.id !== job.id) return { count: 0 };
        if (where.userId && where.userId !== job.userId) return { count: 0 };
        if (where.status && !where.status.in.includes(job.status)) return { count: 0 };
        Object.assign(job, data);
        return { count: 1 };
      },
      async update({ where, data }) {
        const job = db.importJob.find((j) => j.id === where.id);
        if (!job) throw new Error(`importJob ${where.id} not found`);
        Object.assign(job, data);
        return { ...job };
      },
    },

    migrationOperation: {
      async createMany({ data }) {
        const existing = new Set(db.migrationOperation.map((o) => o.operationKey));
        let count = 0;
        for (const entry of data) {
          if (existing.has(entry.operationKey)) continue;
          existing.add(entry.operationKey);
          // Schema default: status @default("pending")
          db.migrationOperation.push(row("migrationOperation", { status: "pending", ...entry }));
          count += 1;
        }
        return { count };
      },
      async findMany({ where, orderBy, select }) {
        let list = db.migrationOperation.filter((o) => o.importJobId === where.importJobId);
        if (where.status) {
          if (typeof where.status === "string") list = list.filter((o) => o.status === where.status);
          else if (where.status.in) {
            const allowed = new Set(where.status.in);
            list = list.filter((o) => allowed.has(o.status));
          }
        }
        if (where.planHash) list = list.filter((o) => o.planHash === where.planHash);
        if (where.id?.in) {
          const ids = new Set(where.id.in);
          list = list.filter((o) => ids.has(o.id));
        }
        if (orderBy?.sequence) {
          list = [...list].sort((a, b) =>
            orderBy.sequence === "desc" ? b.sequence - a.sequence : a.sequence - b.sequence,
          );
        }
        return list.map((o) => pick(o, select));
      },
      async update({ where, data }) {
        const op = db.migrationOperation.find((o) => o.id === where.id);
        if (!op) throw new Error(`migrationOperation ${where.id} not found`);
        Object.assign(op, data);
        return { ...op };
      },
      async updateMany({ where, data }) {
        let list = db.migrationOperation.filter((o) => o.importJobId === where.importJobId);
        if (where.id?.in) {
          const ids = new Set(where.id.in);
          list = list.filter((o) => ids.has(o.id));
        }
        if (where.status) list = list.filter((o) => o.status === where.status);
        let count = 0;
        for (const op of list) {
          Object.assign(op, data);
          count += 1;
        }
        return { count };
      },
      async count({ where }) {
        let list = db.migrationOperation.filter((o) => o.importJobId === where.importJobId);
        if (where.status) list = list.filter((o) => o.status === where.status);
        return list.length;
      },
    },

    migrationRecord: {
      async findMany({ where, select }) {
        let list = db.migrationRecord.filter((r) => r.importJobId === where.importJobId);
        if (where.sourceKey?.in) {
          const keys = new Set(where.sourceKey.in);
          list = list.filter((r) => keys.has(r.sourceKey));
        }
        return list.map((r) => pick(r, select));
      },
      async update({ where, data }) {
        const rec = db.migrationRecord.find((r) => r.id === where.id);
        if (!rec) throw new Error(`migrationRecord ${where.id} not found`);
        Object.assign(rec, data);
        return { ...rec };
      },
    },

    importedRecord: {
      async upsert({ where, create, update }) {
        const key = where.importJobId_sourceType_sourceKey;
        const existing = db.importedRecord.find(
          (r) =>
            r.importJobId === key.importJobId &&
            r.sourceType === key.sourceType &&
            r.sourceKey === key.sourceKey,
        );
        if (existing) {
          Object.assign(existing, update);
          return { ...existing };
        }
        const created = row("importedRecord", { ...create });
        db.importedRecord.push(created);
        return { ...created };
      },
    },

    client: {
      async create({ data, select }) {
        const created = row("client", { ...data });
        db.client.push(created);
        return pick(created, select);
      },
    },
    project: {
      async create({ data, select }) {
        const created = row("project", { ...data });
        db.project.push(created);
        return pick(created, select);
      },
    },
    invoice: {
      async create({ data, select }) {
        const created = row("invoice", { ...data });
        db.invoice.push(created);
        return pick(created, select);
      },
    },
    expense: {
      async create({ data, select }) {
        const created = row("expense", { ...data });
        db.expense.push(created);
        return pick(created, select);
      },
    },
    migrationEvent: {
      async create({ data }) {
        const created = row("migrationEvent", { ...data });
        db.migrationEvent.push(created);
        return { ...created };
      },
    },
    user: {
      async findUnique({ where }) {
        const user = db.user.find((u) => u.id === where.id);
        return user ? { ...user } : null;
      },
    },
  };

  api.$transaction = async (callback) => {
    const call = transactionCallCount;
    transactionCallCount += 1;
    if (failOnCall === call) {
      failOnCall = -1;
      throw new Error("Simulated crash: database connection lost mid-batch.");
    }
    return callback(api);
  };

  return api;
}
// Exports the same shape as @/utils/db for the resolution hook to substitute.
export const prisma = createPrismaMock();

/** For tests: verify the mock instance the server code sees is this one. */
export const mockInstanceUrl = import.meta.url;
