/**
 * Dependency-free on purpose.
 *
 * proxy.js runs on every matched request including prefetches, so it must not
 * pull in firebase-admin (or anything else heavy) just to read a cookie name.
 */
export const SESSION_COOKIE = "__session";

/** 14 days is the maximum Firebase allows for a session cookie. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
