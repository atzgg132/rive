import assert from "node:assert/strict";
import test from "node:test";

import { decideGoogleLogin, googleLoginErrorMessage } from "../../src/utils/googleLogin.ts";

const identity = { sub: "google-sub-1", email: "owner@rive.work", emailVerified: true };

test("Google login creates a workspace when the email is new", () => {
  assert.deepEqual(decideGoogleLogin(identity, null, null), { action: "create" });
});

test("Google login attaches to an existing rive.work email instead of duplicating", () => {
  assert.deepEqual(
    decideGoogleLogin(identity, null, { id: "user-1", email: "owner@rive.work", googleSubject: null }),
    { action: "link", userId: "user-1" },
  );
});

test("a previously linked Google subject signs in to that user", () => {
  assert.deepEqual(
    decideGoogleLogin(identity, { id: "user-1", email: "owner@rive.work", googleSubject: "google-sub-1" }, {
      id: "user-1",
      email: "owner@rive.work",
      googleSubject: "google-sub-1",
    }),
    { action: "login", userId: "user-1" },
  );
});

test("a Google subject already bound to a different email is refused", () => {
  assert.deepEqual(
    decideGoogleLogin(identity, { id: "user-1", email: "other@rive.work", googleSubject: "google-sub-1" }, {
      id: "user-2",
      email: "owner@rive.work",
      googleSubject: null,
    }),
    { action: "reject", reason: "account_conflict" },
  );
});

test("an email already linked to a different Google subject is refused", () => {
  assert.deepEqual(
    decideGoogleLogin(identity, null, { id: "user-1", email: "owner@rive.work", googleSubject: "other-sub" }),
    { action: "reject", reason: "account_conflict" },
  );
});

test("a later Google login of an already-linked subject is a normal sign-in", () => {
  assert.deepEqual(
    decideGoogleLogin(identity, { id: "user-1", email: "owner@rive.work", googleSubject: "google-sub-1" }, null),
    { action: "login", userId: "user-1" },
  );
});

test("unverified Google emails are refused", () => {
  assert.deepEqual(
    decideGoogleLogin({ ...identity, emailVerified: false }, null, null),
    { action: "reject", reason: "email_unverified" },
  );
});

test("Google login error codes map to operator-facing copy", () => {
  assert.equal(googleLoginErrorMessage("access_denied"), "Google sign-in was cancelled.");
  assert.equal(googleLoginErrorMessage("account_conflict"), "This Google account cannot be linked. Sign in with email instead.");
  assert.equal(googleLoginErrorMessage("nope"), "Google sign-in could not be completed. Try again.");
});
