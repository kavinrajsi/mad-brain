import "server-only";

import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "./client";
import {
  brandMembers,
  brandProfiles,
  brands,
  documentChunks,
  documentReads,
  documents,
  ideaChecks,
  invites,
} from "./schema";

export function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function createBrand({ name, ownerId }) {
  const base = slugify(name) || "brand";
  let slug = base;

  // Slug collisions are rare; a few probes beats a race-prone pre-check.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      const [brand] = await db
        .insert(brands)
        .values({ name, slug })
        .returning();

      await db
        .insert(brandMembers)
        .values({ brandId: brand.id, userId: ownerId, role: "owner" });

      await db.insert(brandProfiles).values({ brandId: brand.id });

      return brand;
    } catch (error) {
      const isSlugTaken = String(error?.message ?? "").includes(
        "brands_slug_unique",
      );
      if (!isSlugTaken) throw error;
      slug = `${base}-${attempt + 2}`;
    }
  }

  throw new Error(`Could not allocate a unique slug for "${name}"`);
}

/**
 * Turns pending invites into memberships at first sign-in.
 *
 * The neon-http driver has no interactive transactions, so this runs as
 * sequential statements. Each step is idempotent — a retry after a partial
 * failure converges rather than duplicating or double-consuming.
 */
export async function consumeInvitesForEmail({ email, userId }) {
  const normalised = email.toLowerCase();

  const pending = await db
    .select({
      id: invites.id,
      brandId: invites.brandId,
      role: invites.role,
      slug: brands.slug,
      name: brands.name,
    })
    .from(invites)
    .innerJoin(brands, eq(brands.id, invites.brandId))
    .where(
      and(
        eq(sql`lower(${invites.email})`, normalised),
        isNull(invites.consumedAt),
        gt(invites.expiresAt, new Date()),
      ),
    );

  const claimed = [];

  for (const invite of pending) {
    await db
      .insert(brandMembers)
      .values({ brandId: invite.brandId, userId, role: invite.role })
      .onConflictDoNothing();

    await db
      .update(invites)
      .set({ consumedAt: new Date() })
      .where(and(eq(invites.id, invite.id), isNull(invites.consumedAt)));

    claimed.push({ slug: invite.slug, name: invite.name, role: invite.role });
  }

  return claimed;
}

export async function getInviteByToken(token) {
  const [row] = await db
    .select({
      id: invites.id,
      brandId: invites.brandId,
      email: invites.email,
      role: invites.role,
      expiresAt: invites.expiresAt,
      consumedAt: invites.consumedAt,
      brandSlug: brands.slug,
      brandName: brands.name,
    })
    .from(invites)
    .innerJoin(brands, eq(brands.id, invites.brandId))
    .where(eq(invites.token, token))
    .limit(1);
  return row ?? null;
}

/**
 * Redeems an invite link for the signed-in user.
 *
 * The link is the primary path; the email sweep in consumeInvitesForEmail is a
 * fallback for people who were invited after they had already signed in.
 *
 * The invite is deliberately NOT bound to the invited address: an admin may
 * invite a personal address that differs from the Google account used to sign
 * in. Possession of the single-use token is the credential.
 */
export async function acceptInviteByToken({ token, userId }) {
  const invite = await getInviteByToken(token);
  if (!invite) return { ok: false, reason: "not_found" };
  if (invite.consumedAt) return { ok: false, reason: "already_used" };
  if (invite.expiresAt <= new Date()) return { ok: false, reason: "expired" };

  await db
    .insert(brandMembers)
    .values({ brandId: invite.brandId, userId, role: invite.role })
    .onConflictDoNothing();

  // Guarded by consumed_at IS NULL so two concurrent redemptions cannot both
  // report success.
  const stamped = await db
    .update(invites)
    .set({ consumedAt: new Date() })
    .where(and(eq(invites.id, invite.id), isNull(invites.consumedAt)))
    .returning({ id: invites.id });

  if (!stamped.length) return { ok: false, reason: "already_used" };

  return {
    ok: true,
    brandSlug: invite.brandSlug,
    brandName: invite.brandName,
    role: invite.role,
  };
}

export async function getBrandProfile(brandId) {
  const [row] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.brandId, brandId))
    .limit(1);
  return row ?? null;
}

export async function listBrandDocuments(brandId) {
  return db
    .select()
    .from(documents)
    .where(eq(documents.brandId, brandId))
    .orderBy(asc(documents.pinnedOrder), desc(documents.createdAt));
}

/** The curated "Start here" path — only documents an admin has pinned. */
export async function listOnboardingPath({ brandId, userId }) {
  return db
    .select({
      id: documents.id,
      title: documents.title,
      sourceType: documents.sourceType,
      status: documents.status,
      pinnedOrder: documents.pinnedOrder,
      readAt: documentReads.readAt,
    })
    .from(documents)
    .leftJoin(
      documentReads,
      and(
        eq(documentReads.documentId, documents.id),
        eq(documentReads.userId, userId),
      ),
    )
    .where(
      and(
        eq(documents.brandId, brandId),
        sql`${documents.pinnedOrder} is not null`,
      ),
    )
    .orderBy(asc(documents.pinnedOrder));
}

export async function markDocumentRead({ userId, documentId }) {
  await db
    .insert(documentReads)
    .values({ userId, documentId })
    .onConflictDoNothing();
}

/**
 * Hydrates retrieved vector ids back into real text.
 *
 * The brandId filter is deliberate belt-and-braces: Pinecone namespaces already
 * isolate brands, but a citation must never render text from another brand even
 * if a stale or wrong id reaches this function.
 */
export async function getChunksByPineconeIds({ brandId, pineconeIds }) {
  if (!pineconeIds.length) return [];
  return db
    .select({
      id: documentChunks.id,
      pineconeId: documentChunks.pineconeId,
      content: documentChunks.content,
      ordinal: documentChunks.ordinal,
      documentId: documents.id,
      documentTitle: documents.title,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documents.id, documentChunks.documentId))
    .where(
      and(
        eq(documentChunks.brandId, brandId),
        sql`${documentChunks.pineconeId} = any(${pineconeIds})`,
      ),
    );
}

export async function listIdeaChecks(brandId, limit = 50) {
  return db
    .select()
    .from(ideaChecks)
    .where(eq(ideaChecks.brandId, brandId))
    .orderBy(desc(ideaChecks.createdAt))
    .limit(limit);
}

export async function listBrandMembers(brandId) {
  return db
    .select({
      userId: brandMembers.userId,
      role: brandMembers.role,
      createdAt: brandMembers.createdAt,
    })
    .from(brandMembers)
    .where(eq(brandMembers.brandId, brandId))
    .orderBy(asc(brandMembers.createdAt));
}

export async function listPendingInvites(brandId) {
  return db
    .select()
    .from(invites)
    .where(and(eq(invites.brandId, brandId), isNull(invites.consumedAt)))
    .orderBy(desc(invites.createdAt));
}
