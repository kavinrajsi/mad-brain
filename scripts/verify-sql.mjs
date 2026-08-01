/**
 * Exercises the hand-written SQL in src/lib/db/queries.js against a real
 * database — the parts a build and a lint cannot check.
 *
 * This is why it exists: it caught `= any(${array})` expanding to a tuple
 * (which broke every fit check and chat turn) and a unique-violation check that
 * matched on a message string the driver never produces.
 *
 * It WRITES to the database in DATABASE_URL using rows prefixed `zz-verify-tmp`
 * and deletes them afterwards. Point it at a development database.
 *
 *   npm run verify:sql
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import * as schema from "../src/lib/db/schema.js";

config({ path: new URL("../.env.local", import.meta.url).pathname });
const db = drizzle(neon(process.env.DATABASE_URL), { schema });
const {
  brands,
  users,
  brandMembers,
  invites,
  documents,
  documentChunks,
  brandProfiles,
} = schema;

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${error.message}`);
  }
};

const SUFFIX = "zz-verify-tmp";
let brandId, userId;

await check("insert brand + user + owner membership", async () => {
  const [b] = await db
    .insert(brands)
    .values({ slug: SUFFIX, name: "Verify Brand" })
    .returning();
  brandId = b.id;
  const [u] = await db
    .insert(users)
    .values({ id: `uid-${SUFFIX}`, email: `A.User+${SUFFIX}@Example.COM` })
    .returning();
  userId = u.id;
  await db
    .insert(brandMembers)
    .values({ brandId, userId, role: "owner" });
  await db.insert(brandProfiles).values({ brandId });
  return `brand=${brandId.slice(0, 8)}`;
});

await check("unique slug violation is detectable by createBrand", async () => {
  try {
    await db.insert(brands).values({ slug: SUFFIX, name: "Dupe" });
    throw new Error("expected a unique violation, got none");
  } catch (error) {
    const cause = error?.cause;
    if (!(cause?.code === "23505" && cause?.constraint === "brands_slug_unique")) {
      throw new Error(`collision detection would MISS this: code=${cause?.code}`);
    }
    return "code 23505 + constraint name";
  }
});

await check("brandMembers composite-PK onConflictDoNothing", async () => {
  await db
    .insert(brandMembers)
    .values({ brandId, userId, role: "member" })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(brandMembers)
    .where(and(eq(brandMembers.brandId, brandId), eq(brandMembers.userId, userId)));
  if (row.role !== "owner") throw new Error("conflict overwrote the role");
  return "role preserved";
});

await check("users onConflictDoUpdate", async () => {
  await db
    .insert(users)
    .values({ id: userId, email: `A.User+${SUFFIX}@Example.COM`, displayName: "Updated" })
    .onConflictDoUpdate({ target: users.id, set: { displayName: "Updated" } });
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (row.displayName !== "Updated") throw new Error("upsert did not apply");
  return "upsert applied";
});

await check("case-insensitive invite lookup via lower()", async () => {
  await db.insert(invites).values({
    brandId,
    email: `NEW.Hire+${SUFFIX}@Example.COM`.toLowerCase(),
    role: "member",
    token: `tok-${SUFFIX}`,
    invitedBy: userId,
    expiresAt: new Date(Date.now() + 86400_000),
  });

  const found = await db
    .select({ id: invites.id })
    .from(invites)
    .innerJoin(brands, eq(brands.id, invites.brandId))
    .where(
      and(
        eq(sql`lower(${invites.email})`, `new.hire+${SUFFIX}@example.com`),
        isNull(invites.consumedAt),
        gt(invites.expiresAt, new Date()),
      ),
    );

  if (found.length !== 1) throw new Error(`expected 1 invite, got ${found.length}`);
  return "1 row";
});

await check("guarded consume cannot double-succeed", async () => {
  const [inv] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(eq(invites.token, `tok-${SUFFIX}`));

  const first = await db
    .update(invites)
    .set({ consumedAt: new Date() })
    .where(and(eq(invites.id, inv.id), isNull(invites.consumedAt)))
    .returning({ id: invites.id });

  const second = await db
    .update(invites)
    .set({ consumedAt: new Date() })
    .where(and(eq(invites.id, inv.id), isNull(invites.consumedAt)))
    .returning({ id: invites.id });

  if (first.length !== 1 || second.length !== 0) {
    throw new Error(`expected 1 then 0, got ${first.length} then ${second.length}`);
  }
  return "1 then 0";
});

let docId;
await check("insert document + chunks", async () => {
  const [doc] = await db
    .insert(documents)
    .values({
      brandId,
      title: "Verify Doc",
      sourceType: "note",
      body: "hello",
      status: "ready",
      pinnedOrder: 1,
    })
    .returning();
  docId = doc.id;

  await db.insert(documentChunks).values([
    { documentId: docId, brandId, ordinal: 0, content: "chunk zero", pineconeId: `${docId}:0` },
    { documentId: docId, brandId, ordinal: 1, content: "chunk one", pineconeId: `${docId}:1` },
  ]);
  return "2 chunks";
});

await check("getChunksByPineconeIds: inArray binding", async () => {
  const ids = [`${docId}:0`, `${docId}:1`, "does-not-exist"];
  const rows = await db
    .select({ pineconeId: documentChunks.pineconeId, title: documents.title })
    .from(documentChunks)
    .innerJoin(documents, eq(documents.id, documentChunks.documentId))
    .where(
      and(
        eq(documentChunks.brandId, brandId),
        inArray(documentChunks.pineconeId, ids),
      ),
    );
  if (rows.length !== 2) throw new Error(`expected 2 rows, got ${rows.length}`);
  return "2 rows, bogus id excluded";
});

await check("brand filter blocks cross-brand chunk hydration", async () => {
  const [other] = await db
    .insert(brands)
    .values({ slug: `${SUFFIX}-2`, name: "Other Brand" })
    .returning();

  const rows = await db
    .select({ pineconeId: documentChunks.pineconeId })
    .from(documentChunks)
    .innerJoin(documents, eq(documents.id, documentChunks.documentId))
    .where(
      and(
        eq(documentChunks.brandId, other.id),
        inArray(documentChunks.pineconeId, [`${docId}:0`, `${docId}:1`]),
      ),
    );

  await db.delete(brands).where(eq(brands.id, other.id));
  if (rows.length !== 0) throw new Error(`LEAK: got ${rows.length} rows from another brand`);
  return "0 rows";
});

await check("onboarding path: is-not-null filter + asc order", async () => {
  await db.insert(documents).values({
    brandId,
    title: "Unpinned",
    sourceType: "note",
    body: "x",
    status: "ready",
  });

  const rows = await db
    .select({ title: documents.title })
    .from(documents)
    .where(
      and(eq(documents.brandId, brandId), sql`${documents.pinnedOrder} is not null`),
    )
    .orderBy(asc(documents.pinnedOrder));

  if (rows.length !== 1) throw new Error(`expected only the pinned doc, got ${rows.length}`);
  return "unpinned excluded";
});

await check("listBrandDocuments ordering with NULL pinned_order", async () => {
  const rows = await db
    .select({ title: documents.title, pinnedOrder: documents.pinnedOrder })
    .from(documents)
    .where(eq(documents.brandId, brandId))
    .orderBy(asc(documents.pinnedOrder), desc(documents.createdAt));
  return rows.map((r) => `${r.title}:${r.pinnedOrder ?? "null"}`).join(" | ");
});

await check("chunks cascade when document is deleted", async () => {
  await db.delete(documents).where(eq(documents.id, docId));
  const left = await db
    .select({ id: documentChunks.id })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, docId));
  if (left.length !== 0) throw new Error(`${left.length} orphan chunks remain`);
  return "cascaded";
});

// Cleanup
await db.delete(brands).where(eq(brands.slug, SUFFIX));
await db.delete(users).where(eq(users.id, `uid-${SUFFIX}`));

console.log(results.join("\n"));
console.log(
  results.some((r) => r.startsWith("FAIL")) ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED",
);
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
