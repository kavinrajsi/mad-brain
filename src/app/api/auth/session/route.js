import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth/constants";
import { adminAuth } from "@/lib/auth/firebase-admin";
import { consumeInvitesForEmail } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

/**
 * Exchanges a short-lived Firebase ID token for a long-lived httpOnly session
 * cookie. The ID token never touches storage on the client, and the session
 * cookie is unreadable from JavaScript.
 */
export async function POST(request) {
  let idToken;
  try {
    ({ idToken } = await request.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!idToken) {
    return Response.json({ error: "missing_id_token" }, { status: 400 });
  }

  const auth = adminAuth();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(idToken, true);
  } catch {
    return Response.json({ error: "invalid_id_token" }, { status: 401 });
  }

  // Reject stale tokens: require the sign-in to have happened just now, so a
  // leaked older ID token cannot be traded for a 14-day session.
  const authTimeMs = decoded.auth_time * 1000;
  if (Date.now() - authTimeMs > 5 * 60 * 1000) {
    return Response.json({ error: "reauth_required" }, { status: 401 });
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  const email = decoded.email ?? null;

  await db
    .insert(users)
    .values({
      id: decoded.uid,
      email: email ?? `${decoded.uid}@unknown.local`,
      displayName: decoded.name ?? null,
      photoUrl: decoded.picture ?? null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: email ?? `${decoded.uid}@unknown.local`,
        displayName: decoded.name ?? null,
        photoUrl: decoded.picture ?? null,
      },
    });

  // Turn any pending invites for this address into real memberships. This is
  // the step that makes a new hire able to read a brand at all.
  const claimed = email
    ? await consumeInvitesForEmail({ email, userId: decoded.uid })
    : [];

  (await cookies()).set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return Response.json({ ok: true, claimedBrands: claimed });
}

/**
 * Signing out clears this device's cookie only.
 *
 * `?everywhere=1` additionally revokes refresh tokens, which invalidates the
 * user's sessions on every device. That is the right hammer for a lost laptop,
 * but it is deliberately not the default — otherwise signing out on a desktop
 * would silently sign the same person out on their phone.
 */
export async function DELETE(request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const everywhere =
    request.nextUrl?.searchParams.get("everywhere") === "1" ||
    new URL(request.url).searchParams.get("everywhere") === "1";

  if (everywhere && token) {
    try {
      const claims = await adminAuth().verifySessionCookie(token, false);
      await adminAuth().revokeRefreshTokens(claims.sub);
    } catch {
      // Already invalid — nothing to revoke.
    }
  }

  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
