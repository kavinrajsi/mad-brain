import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { db } from "./client";
import {
  brandMembers,
  brandProfiles,
  brands,
  chatMessages,
  chats,
  documentChunks,
  documentReads,
  documents,
  ideaChecks,
  invites,
  users,
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
      // 23505 = unique_violation. The driver wraps the Postgres error, so the
      // code and constraint live on `cause` — the top-level message is only a
      // generic "Failed query" and matching against it silently never fires.
      const cause = error?.cause;
      const isSlugTaken =
        cause?.code === "23505" && cause?.constraint === "brands_slug_unique";
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
        // inArray, not `= any(...)`: Drizzle expands a JS array into a tuple
        // `($1, $2)`, which is invalid as the argument to any().
        inArray(documentChunks.pineconeId, pineconeIds),
      ),
    );
}

/**
 * Persists one chat turn: the chat row plus every message the client re-sent.
 *
 * The chat id comes from the client, so ownership is verified before any
 * message is written — a forged id belonging to another brand's chat is
 * abandoned, never appended to. The neon-http driver has no interactive
 * transactions; every statement here is idempotent, so a retry after a partial
 * failure converges rather than duplicating.
 */
export async function saveChat({
  chatId,
  brandId,
  userId,
  modelId,
  title,
  messages,
}) {
  await db
    .insert(chats)
    .values({ id: chatId, brandId, userId, modelId, title })
    .onConflictDoNothing();

  const [chat] = await db
    .select({ brandId: chats.brandId })
    .from(chats)
    .where(eq(chats.id, chatId));
  if (!chat || chat.brandId !== brandId) return;

  await db
    .update(chats)
    .set({ modelId, updatedAt: new Date() })
    .where(eq(chats.id, chatId));

  if (!messages.length) return;
  await db
    .insert(chatMessages)
    .values(
      messages.map((message, index) => ({
        id: message.id,
        chatId,
        role: message.role,
        parts: message.parts ?? [],
        metadata: message.metadata ?? null,
        ordinal: index,
      })),
    )
    .onConflictDoNothing();
}

export async function listBrandChats(brandId, limit = 50) {
  return db
    .select({
      id: chats.id,
      title: chats.title,
      modelId: chats.modelId,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
      // Left join: a chat must still show if its user was later removed.
      memberName: sql`coalesce(${users.displayName}, ${users.email})`,
    })
    .from(chats)
    .leftJoin(users, eq(users.id, chats.userId))
    .where(eq(chats.brandId, brandId))
    .orderBy(desc(chats.updatedAt))
    .limit(limit);
}

/** Brand-scoped on both queries so a guessed chat id never crosses brands. */
export async function getChatWithMessages({ chatId, brandId }) {
  const [chat] = await db
    .select({
      id: chats.id,
      brandId: chats.brandId,
      userId: chats.userId,
      title: chats.title,
      modelId: chats.modelId,
      createdAt: chats.createdAt,
      updatedAt: chats.updatedAt,
      memberName: sql`coalesce(${users.displayName}, ${users.email})`,
    })
    .from(chats)
    .leftJoin(users, eq(users.id, chats.userId))
    .where(and(eq(chats.id, chatId), eq(chats.brandId, brandId)));
  if (!chat) return null;

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.ordinal));

  return { ...chat, messages };
}

export async function listIdeaChecks(brandId, limit = 50) {
  return db
    .select({
      id: ideaChecks.id,
      brandId: ideaChecks.brandId,
      userId: ideaChecks.userId,
      ideaText: ideaChecks.ideaText,
      modelId: ideaChecks.modelId,
      overallScore: ideaChecks.overallScore,
      verdict: ideaChecks.verdict,
      citations: ideaChecks.citations,
      usage: ideaChecks.usage,
      createdAt: ideaChecks.createdAt,
      memberName: sql`coalesce(${users.displayName}, ${users.email})`,
    })
    .from(ideaChecks)
    .leftJoin(users, eq(users.id, ideaChecks.userId))
    .where(eq(ideaChecks.brandId, brandId))
    .orderBy(desc(ideaChecks.createdAt))
    .limit(limit);
}

/**
 * Per-chat token/cost totals for the History list. Rows with no `usage` key
 * on any message (pre-migration history, or every turn Anthropic-direct for
 * cost) sum to null — expected, not a bug.
 */
export async function sumChatUsage(brandId) {
  const result = await db.execute(sql`
    select cm.chat_id as "chatId",
           sum((cm.metadata->'usage'->>'totalTokens')::bigint) as "totalTokens",
           sum((cm.metadata->'usage'->>'costUsd')::numeric) as "costUsd"
    from chat_messages cm
    join chats c on c.id = cm.chat_id
    where c.brand_id = ${brandId}
    group by cm.chat_id
  `);
  return result.rows;
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
