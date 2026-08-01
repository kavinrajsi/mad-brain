import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not set (base64-encoded service account JSON).",
    );
  }
  // Accept either raw JSON or base64 — base64 avoids newline mangling in env files.
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

function adminApp() {
  return getApps().length ? getApp() : initializeApp({ credential: cert(serviceAccount()) });
}

export function adminAuth() {
  return getAuth(adminApp());
}
