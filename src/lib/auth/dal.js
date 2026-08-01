import "server-only";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db/client";
import { brandMembers, brands } from "@/lib/db/schema";
import { SESSION_COOKIE } from "./constants";
import { adminAuth } from "./firebase-admin";

const ROLE_RANK = { member: 1, admin: 2, owner: 3 };

/**
 * The real authentication boundary.
 *
 * proxy.js only checks that a cookie exists — it never touches Firebase or the
 * database. Everything that reads brand data must call through here. Layouts are
 * explicitly NOT a boundary in the App Router: they do not re-render on
 * navigation, so a check there is not run on every route change.
 *
 * `checkRevoked: true` means a disabled or signed-out-everywhere user loses
 * access immediately rather than at cookie expiry.
 */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const claims = await adminAuth().verifySessionCookie(token, true);
    return {
      userId: claims.uid,
      email: claims.email ?? null,
      name: claims.name ?? null,
      picture: claims.picture ?? null,
    };
  } catch {
    // Expired, malformed, or revoked. Treat as signed out.
    return null;
  }
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Authorisation for a single brand. Call at the top of every page, Server
 * Action and Route Handler that touches brand data.
 *
 * Resolves the brand by SLUG through the membership join — a brandId supplied
 * by the client is never trusted, because a well-formed id can still point at a
 * brand the caller does not belong to.
 */
export const getBrandAccess = cache(async (slug, minRole = "member") => {
  const session = await getSession();
  if (!session) return null;

  const [row] = await db
    .select({
      brandId: brands.id,
      slug: brands.slug,
      name: brands.name,
      role: brandMembers.role,
    })
    .from(brands)
    .innerJoin(
      brandMembers,
      and(
        eq(brandMembers.brandId, brands.id),
        eq(brandMembers.userId, session.userId),
      ),
    )
    .where(eq(brands.slug, slug))
    .limit(1);

  if (!row) return null;
  if (ROLE_RANK[row.role] < ROLE_RANK[minRole]) return null;

  return { ...row, userId: session.userId, email: session.email };
});

/** Page/Server Action variant — redirects rather than returning null. */
export async function requireBrandRole(slug, minRole = "member") {
  const session = await getSession();
  if (!session) redirect("/login");

  const access = await getBrandAccess(slug, minRole);
  // Same response whether the brand does not exist or the caller is not a
  // member — otherwise this leaks which brand slugs exist.
  if (!access) redirect("/");
  return access;
}

/**
 * Route Handler variant.
 *
 * Returns `{ access, response }` — exactly one is set. It does NOT throw:
 * Next only special-cases thrown `redirect()` / `notFound()` / `unauthorized()`,
 * so a thrown Response would surface as a 500 rather than the intended status.
 *
 *   const { access, response } = await authorizeBrandApi(slug, "admin");
 *   if (response) return response;
 */
export async function authorizeBrandApi(slug, minRole = "member") {
  const session = await getSession();
  if (!session) {
    return {
      access: null,
      response: Response.json({ error: "unauthenticated" }, { status: 401 }),
    };
  }

  const access = await getBrandAccess(slug, minRole);
  if (!access) {
    return {
      access: null,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  return { access, response: null };
}

export const listMyBrands = cache(async () => {
  const session = await getSession();
  if (!session) return [];
  return db
    .select({
      id: brands.id,
      slug: brands.slug,
      name: brands.name,
      role: brandMembers.role,
    })
    .from(brands)
    .innerJoin(brandMembers, eq(brandMembers.brandId, brands.id))
    .where(eq(brandMembers.userId, session.userId))
    .orderBy(brands.name);
});
