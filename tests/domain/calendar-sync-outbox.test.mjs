import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  CALENDAR_SYNC_LEASE_MS,
  CALENDAR_SYNC_MAX_ATTEMPTS,
  collectIdPages,
  enqueueCalendarSync,
  processCalendarSyncOutbox,
} from "../../src/utils/calendarOutbox.ts";

/**
 * In-memory client for the calendar sync outbox tables. The processor takes
 * its db client by injection, so this only needs to cover the query shapes the
 * worker actually issues — no Postgres required.
 */
function createFakeClient() {
  const outbox = [];
  const events = new Map();
  const connections = [];

  function matchField(actual, condition) {
    if (condition && typeof condition === "object" && !(condition instanceof Date) && !Array.isArray(condition)) {
      // Operator filter. SQL NULL semantics: a null value never satisfies a
      // range/membership comparison.
      if (actual === null || actual === undefined) return false;
      if ("lt" in condition && !(actual < condition.lt)) return false;
      if ("lte" in condition && !(actual <= condition.lte)) return false;
      if ("gt" in condition && !(actual > condition.gt)) return false;
      if ("gte" in condition && !(actual >= condition.gte)) return false;
      if ("in" in condition && !condition.in.includes(actual)) return false;
      if ("equals" in condition && actual !== condition.equals) return false;
      return true;
    }
    return actual === condition;
  }

  function match(row, where = {}) {
    for (const [key, condition] of Object.entries(where)) {
      if (key === "OR") {
        if (!condition.some((branch) => match(row, branch))) return false;
        continue;
      }
      if (!matchField(row[key], condition)) return false;
    }
    return true;
  }

  function applyUpdate(row, data) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && !(value instanceof Date) && "increment" in value) {
        row[key] = (Number(row[key]) || 0) + value.increment;
      } else if (value && typeof value === "object" && !(value instanceof Date) && "decrement" in value) {
        row[key] = (Number(row[key]) || 0) - value.decrement;
      } else {
        row[key] = value;
      }
    }
  }

  const client = {
    __outbox: outbox,
    __events: events,
    __connections: connections,
    calendarSyncOutbox: {
      async create({ data }) {
        const record = {
          id: `job-${outbox.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
          status: "pending",
          attempts: 0,
          availableAt: new Date(),
          claimedAt: null,
          leaseId: null,
          leaseExpiresAt: null,
          processedAt: null,
          lastError: null,
          lastResult: null,
          payload: null,
          createdAt: new Date(),
          ...data,
        };
        outbox.push(record);
        return { ...record };
      },
      async findMany({ where = {}, orderBy, take } = {}) {
        let list = outbox.filter((record) => match(record, where));
        if (orderBy?.createdAt === "asc") {
          list = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        if (typeof take === "number") list = list.slice(0, take);
        return list.map((record) => ({ ...record }));
      },
      async update({ where, data }) {
        const record = outbox.find((candidate) => candidate.id === where.id);
        if (!record) throw new Error(`calendarSyncOutbox ${where.id} not found`);
        applyUpdate(record, data);
        return { ...record };
      },
      async updateMany({ where = {}, data }) {
        const list = outbox.filter((record) => match(record, where));
        for (const record of list) applyUpdate(record, data);
        return { count: list.length };
      },
    },
    calendarEvent: {
      async findUnique({ where }) {
        const event = events.get(where.id);
        return event ? { ...event } : null;
      },
    },
    calendarConnection: {
      async findFirst({ where = {} } = {}) {
        return connections.find((connection) => match(connection, where)) || null;
      },
    },
  };
  return client;
}

function seedEvent(client, id, userId = "user-1") {
  client.__events.set(id, { id, userId });
}

function seedJob(client, data) {
  const record = {
    id: `job-${client.__outbox.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
    userId: "user-1",
    eventId: "event-1",
    operation: "create",
    provider: "google",
    payload: null,
    status: "pending",
    attempts: 0,
    availableAt: new Date(),
    claimedAt: null,
    leaseId: null,
    leaseExpiresAt: null,
    processedAt: null,
    lastError: null,
    lastResult: null,
    createdAt: new Date(),
    ...data,
  };
  client.__outbox.push(record);
  return record;
}

let client;

beforeEach(() => {
  client = createFakeClient();
  delete process.env.GOOGLE_CALENDAR_ENABLED;
  delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
  delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  delete process.env.CALENDAR_ENCRYPTION_KEY;
});

test("a pending job is claimed atomically with a lease and settled completed", async () => {
  const job = seedJob(client);
  const result = await processCalendarSyncOutbox({
    client,
    push: async () => true,
  });

  assert.equal(result.claimed, 1);
  assert.equal(result.completed, 1);
  assert.equal(job.status, "completed");
  assert.equal(job.attempts, 1);
  assert.equal(job.lastResult, "completed");
  assert.ok(job.processedAt instanceof Date);
  assert.equal(job.claimedAt, null, "terminal settlement clears the lease");
  assert.equal(job.leaseId, null);
  assert.equal(job.leaseExpiresAt, null);
});

test("each claim stamps a unique leaseId and a ~75s lease expiry", async () => {
  const first = seedJob(client, { eventId: "event-1" });
  const second = seedJob(client, { eventId: "event-2" });
  seedEvent(client, "event-1");
  seedEvent(client, "event-2");
  const seenLeases = [];

  await processCalendarSyncOutbox({
    client,
    push: async () => {
      // Peek at the claim mid-flight: lease fields must be set while processing.
      for (const record of client.__outbox) {
        if (record.status === "processing" && record.leaseId) {
          seenLeases.push({
            leaseId: record.leaseId,
            windowMs: record.leaseExpiresAt.getTime() - record.claimedAt.getTime(),
          });
        }
      }
      return true;
    },
  });

  assert.equal(seenLeases.length, 2);
  assert.notEqual(seenLeases[0].leaseId, seenLeases[1].leaseId);
  for (const seen of seenLeases) {
    assert.equal(seen.windowMs, CALENDAR_SYNC_LEASE_MS);
  }
  for (const job of [first, second]) {
    assert.equal(job.status, "completed");
  }
});

test("a claim is not handed out twice for the same row", async () => {
  seedJob(client);
  let pushes = 0;
  const first = await processCalendarSyncOutbox({ client, push: async () => { pushes += 1; return true; } });
  const second = await processCalendarSyncOutbox({ client, push: async () => { pushes += 1; return true; } });

  assert.equal(first.claimed, 1);
  assert.equal(second.claimed, 0, "a completed row is never re-claimed");
  assert.equal(pushes, 1);
});

test("a stale processing row under the cap is reclaimed to pending and reworked", async () => {
  const job = seedJob(client, {
    status: "processing",
    attempts: 3,
    claimedAt: new Date(Date.now() - 10 * 60_000),
    leaseId: "dead-lease",
    leaseExpiresAt: new Date(Date.now() - 60_000),
  });
  seedEvent(client, "event-1");

  const result = await processCalendarSyncOutbox({ client, push: async () => true });

  assert.equal(result.reclaimed, 1);
  assert.equal(result.claimed, 1, "the reclaimed row is claimable in the same run");
  assert.equal(result.completed, 1);
  assert.equal(job.status, "completed");
  assert.equal(job.attempts, 4, "the stale claim's increment is kept — the attempt happened");
  assert.equal(job.leaseId, null);
});

test("a stale processing row at the attempt cap fails terminally", async () => {
  const job = seedJob(client, {
    status: "processing",
    attempts: CALENDAR_SYNC_MAX_ATTEMPTS,
    claimedAt: new Date(Date.now() - 10 * 60_000),
    leaseId: "dead-lease",
    leaseExpiresAt: new Date(Date.now() - 60_000),
  });

  const result = await processCalendarSyncOutbox({ client, push: async () => true });

  assert.equal(result.failed, 1);
  assert.equal(result.claimed, 0);
  assert.equal(job.status, "failed");
  assert.ok(job.processedAt instanceof Date);
  assert.equal(job.lastResult, "attempt_cap");
  assert.equal(job.leaseId, null);
});

test("a processing row inside its lease is left alone", async () => {
  const job = seedJob(client, {
    status: "processing",
    attempts: 1,
    claimedAt: new Date(),
    leaseId: "live-lease",
    leaseExpiresAt: new Date(Date.now() + CALENDAR_SYNC_LEASE_MS),
  });

  const result = await processCalendarSyncOutbox({ client, push: async () => true });

  assert.equal(result.reclaimed, 0);
  assert.equal(result.claimed, 0);
  assert.equal(job.status, "processing");
  assert.equal(job.leaseId, "live-lease");
});

test("a false create with no connected account stays pending as provider_not_ready", async () => {
  const job = seedJob(client);
  seedEvent(client, "event-1");

  const result = await processCalendarSyncOutbox({ client, push: async () => false });

  assert.equal(result.completed, 0);
  assert.equal(result.retried, 1);
  assert.equal(job.status, "pending");
  assert.equal(job.lastResult, "provider_not_ready");
  assert.equal(job.processedAt, null);
  assert.equal(job.claimedAt, null, "a queued update still clears the lease");
  assert.ok(job.availableAt > new Date(), "retry is scheduled with backoff");
});

test("a false create with a connected account retries as no_destination", async () => {
  process.env.GOOGLE_CALENDAR_ENABLED = "true";
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
  process.env.CALENDAR_ENCRYPTION_KEY = "test-key";
  const job = seedJob(client);
  seedEvent(client, "event-1");
  client.__connections.push({ id: "conn-1", userId: "user-1", provider: "google", status: "connected" });

  const result = await processCalendarSyncOutbox({ client, push: async () => false });

  assert.equal(result.retried, 1);
  assert.equal(job.status, "pending");
  assert.equal(job.lastResult, "no_destination");
});

test("a false create at the attempt cap fails instead of retrying forever", async () => {
  const job = seedJob(client, { attempts: CALENDAR_SYNC_MAX_ATTEMPTS - 1 });
  seedEvent(client, "event-1");

  const result = await processCalendarSyncOutbox({ client, push: async () => false });

  assert.equal(result.failed, 1);
  assert.equal(job.status, "failed");
  assert.ok(job.processedAt instanceof Date);
});

test("a false update or delete is skipped, not completed", async () => {
  const updated = seedJob(client, { operation: "update", eventId: "event-1" });
  const deleted = seedJob(client, { operation: "delete", eventId: "event-2" });
  seedEvent(client, "event-1");
  seedEvent(client, "event-2");

  const result = await processCalendarSyncOutbox({ client, push: async () => false });

  assert.equal(result.completed, 0);
  assert.equal(result.skipped, 2);
  for (const job of [updated, deleted]) {
    assert.equal(job.status, "skipped");
    assert.ok(job.processedAt instanceof Date);
    assert.equal(job.lastResult, "no_destination");
    assert.equal(job.leaseId, null);
  }
});

test("a job whose event is gone is skipped as missing_event", async () => {
  const job = seedJob(client, { eventId: "deleted-event" });

  const result = await processCalendarSyncOutbox({ client, push: async () => false });

  assert.equal(result.skipped, 1);
  assert.equal(job.status, "skipped");
  assert.equal(job.lastResult, "missing_event");
});

test("a malformed job (no eventId) settles skipped instead of looping pending", async () => {
  const job = seedJob(client, { eventId: null });

  const result = await processCalendarSyncOutbox({ client, push: async () => true });

  assert.equal(result.skipped, 1);
  assert.equal(job.status, "skipped");
  assert.equal(job.lastResult, "unsupported");
});

test("a thrown provider error requeues while attempts remain", async () => {
  const job = seedJob(client);

  const result = await processCalendarSyncOutbox({
    client,
    push: async () => {
      throw new Error("Google Calendar request failed (503)");
    },
  });

  assert.equal(result.retried, 1);
  assert.equal(result.failed, 0);
  assert.equal(job.status, "pending");
  assert.equal(job.lastResult, "error");
  assert.match(job.lastError, /503/);
  assert.equal(job.processedAt, null);
  assert.ok(job.availableAt > new Date());
});

test("a thrown provider error on the final attempt is terminal", async () => {
  const job = seedJob(client, { attempts: CALENDAR_SYNC_MAX_ATTEMPTS - 1 });

  const result = await processCalendarSyncOutbox({
    client,
    push: async () => {
      throw new Error("Google Calendar request failed (503)");
    },
  });

  assert.equal(result.failed, 1);
  assert.equal(result.retried, 0);
  assert.equal(job.status, "failed");
  assert.equal(job.lastResult, "error");
  assert.ok(job.processedAt instanceof Date);
  assert.equal(job.leaseId, null);
});

test("the deadline stops claiming so later rows stay pending", async () => {
  seedJob(client, { eventId: "event-1" });
  seedJob(client, { eventId: "event-2" });
  seedJob(client, { eventId: "event-3" });

  const result = await processCalendarSyncOutbox({
    client,
    deadlineMs: 0,
    push: async () => true,
  });

  assert.equal(result.claimed, 1);
  assert.equal(client.__outbox.filter((job) => job.status === "pending").length, 2);
});

test("jobId mode processes only that job — the events route's immediate sync", async () => {
  const target = seedJob(client, { eventId: "event-1" });
  const other = seedJob(client, { eventId: "event-2" });
  const jobId = await enqueueCalendarSync("user-1", "event-3", "create", client);

  const result = await processCalendarSyncOutbox({ client, jobId, push: async () => true });

  assert.equal(result.claimed, 1);
  assert.equal(result.completed, 1);
  assert.equal(target.status, "pending");
  assert.equal(other.status, "pending");
  const processed = client.__outbox.find((job) => job.id === jobId);
  assert.equal(processed.status, "completed");
});

test("a false immediate-sync push leaves the row pending and reports no completion", async () => {
  seedEvent(client, "event-1");
  const jobId = await enqueueCalendarSync("user-1", "event-1", "update", client);

  const result = await processCalendarSyncOutbox({ client, jobId, push: async () => false });

  // This is the contract syncCalendarMutation relies on: completed counts only
  // real pushes, so `synced` can never be true for a false return.
  assert.equal(result.completed, 0);
  assert.equal(result.skipped, 1);
});

test("collectIdPages walks every page until a short page ends the sweep", async () => {
  const rows = Array.from({ length: 250 }, (_, index) => ({ id: `cal-${String(index).padStart(4, "0")}` }));
  const fetchPage = async ({ take, afterId }) => {
    const start = afterId ? rows.findIndex((row) => row.id === afterId) + 1 : 0;
    return rows.slice(start, start + take);
  };

  const collected = await collectIdPages(100, fetchPage);

  assert.equal(collected.length, 250);
  assert.deepEqual(collected.map((row) => row.id), rows.map((row) => row.id));
});

test("collectIdPages handles fewer rows than a page and an empty table", async () => {
  const few = [{ id: "a" }, { id: "b" }];
  assert.equal((await collectIdPages(100, async () => few)).length, 2);
  assert.equal((await collectIdPages(100, async () => [])).length, 0);
});
