"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function clientApp() {
  return getApps().length ? getApp() : initializeApp(config);
}

export function clientAuth() {
  return getAuth(clientApp());
}

/**
 * Signs in, then immediately trades the ID token for an httpOnly session cookie
 * and drops the client-side Firebase session. The browser keeps no long-lived
 * credential of its own — the cookie is the only thing that grants access, and
 * JavaScript cannot read it.
 */
export async function signInWithGoogle() {
  const auth = clientAuth();
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  const idToken = await credential.user.getIdToken(true);

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  await firebaseSignOut(auth);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not start a session.");
  }

  return response.json();
}

export async function signOut() {
  await fetch("/api/auth/session", { method: "DELETE" });
}
