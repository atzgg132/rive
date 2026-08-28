import assert from "node:assert/strict";
import test from "node:test";

import { GOOGLE_CALENDAR_OAUTH_SCOPES, GOOGLE_LOGIN_SCOPES } from "../../src/utils/googleScopes.ts";

test("Google login requests only openid, email, and profile", () => {
  assert.deepEqual([...GOOGLE_LOGIN_SCOPES], ["openid", "email", "profile"]);
  assert.equal(GOOGLE_LOGIN_SCOPES.some((scope) => scope.includes("calendar")), false);
});

test("Google Calendar requests the least-privilege Calendar scopes plus identity", () => {
  assert.deepEqual([...GOOGLE_CALENDAR_OAUTH_SCOPES], [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  assert.equal(GOOGLE_CALENDAR_OAUTH_SCOPES.includes("profile"), false);
  assert.equal(GOOGLE_CALENDAR_OAUTH_SCOPES.includes("https://www.googleapis.com/auth/calendar"), false);
  assert.equal(GOOGLE_CALENDAR_OAUTH_SCOPES.includes("https://www.googleapis.com/auth/calendar.readonly"), false);
});
