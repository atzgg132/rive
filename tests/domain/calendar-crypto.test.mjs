import assert from "node:assert/strict";
import test from "node:test";

import { decryptCalendarCredentials, encryptCalendarCredentials } from "../../src/utils/calendarCrypto.ts";

const ENV_KEYS = [
  "CALENDAR_ENCRYPTION_KEY",
  "CALENDAR_ENCRYPTION_KEY_ID",
  "CALENDAR_ENCRYPTION_KEY_PREVIOUS",
  "CALENDAR_ENCRYPTION_KEY_PREVIOUS_ID",
];

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("calendar credentials decrypt across a key rotation", () => {
  const prior = snapshotEnv();
  try {
    process.env.CALENDAR_ENCRYPTION_KEY = "old-calendar-secret";
    process.env.CALENDAR_ENCRYPTION_KEY_ID = "v1";
    delete process.env.CALENDAR_ENCRYPTION_KEY_PREVIOUS;
    delete process.env.CALENDAR_ENCRYPTION_KEY_PREVIOUS_ID;

    const source = { accessToken: "old-token", refreshToken: "refresh-token", expiresAt: 123 };
    const versioned = encryptCalendarCredentials(source);
    const legacy = versioned.split(".").slice(1).join(".");

    process.env.CALENDAR_ENCRYPTION_KEY = "new-calendar-secret";
    process.env.CALENDAR_ENCRYPTION_KEY_ID = "v2";
    process.env.CALENDAR_ENCRYPTION_KEY_PREVIOUS = "old-calendar-secret";
    process.env.CALENDAR_ENCRYPTION_KEY_PREVIOUS_ID = "v1";

    assert.deepEqual(decryptCalendarCredentials(versioned), source);
    assert.deepEqual(decryptCalendarCredentials(legacy), source);
    assert.equal(encryptCalendarCredentials(source).split(".")[0], "v2");
  } finally {
    restoreEnv(prior);
  }
});
