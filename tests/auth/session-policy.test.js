// tests/auth/session-policy.test.js
// @ts-check
// Locks the client-side 30-day session cap contract. The app keeps a user
// signed in via Firebase's browserLocalPersistence (indefinite by default);
// isSessionExpired is the gate that bounces them back to sign-in once their
// last *interactive* sign-in is older than SESSION_MAX_AGE_MS. Anchored on
// fbUser.metadata.lastSignInTime (a UTC string), which only updates on a real
// sign-in — never on a silent token refresh — so "up to 30 days" means 30 days
// from the last time the user actually authenticated.

import { describe, it, expect } from "vitest";
import { SESSION_MAX_AGE_MS, isSessionExpired } from "../../src/auth/session-policy.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("SESSION_MAX_AGE_MS", () => {
  it("is exactly 30 days in milliseconds", () => {
    expect(SESSION_MAX_AGE_MS).toBe(30 * DAY_MS);
  });
});

describe("isSessionExpired", () => {
  const now = Date.parse("2026-07-01T12:00:00Z");

  it("returns false just under 30 days since last sign-in", () => {
    const lastSignIn = new Date(now - (SESSION_MAX_AGE_MS - 60_000)).toUTCString();
    expect(isSessionExpired(lastSignIn, now)).toBe(false);
  });

  it("returns false exactly at 30 days (boundary is inclusive)", () => {
    const lastSignIn = new Date(now - SESSION_MAX_AGE_MS).toUTCString();
    expect(isSessionExpired(lastSignIn, now)).toBe(false);
  });

  it("returns true just over 30 days since last sign-in", () => {
    const lastSignIn = new Date(now - (SESSION_MAX_AGE_MS + 60_000)).toUTCString();
    expect(isSessionExpired(lastSignIn, now)).toBe(true);
  });

  it("returns true for a sign-in far in the past", () => {
    const lastSignIn = new Date(now - 365 * DAY_MS).toUTCString();
    expect(isSessionExpired(lastSignIn, now)).toBe(true);
  });

  it("fails open (not expired) for a missing timestamp so a metadata quirk never locks out a valid user", () => {
    expect(isSessionExpired(undefined, now)).toBe(false);
    expect(isSessionExpired(null, now)).toBe(false);
    expect(isSessionExpired("", now)).toBe(false);
  });

  it("fails open (not expired) for an unparseable timestamp", () => {
    expect(isSessionExpired("not-a-date", now)).toBe(false);
  });

  it("does not expire a session dated slightly in the future (clock skew)", () => {
    const lastSignIn = new Date(now + 5 * 60_000).toUTCString();
    expect(isSessionExpired(lastSignIn, now)).toBe(false);
  });
});
