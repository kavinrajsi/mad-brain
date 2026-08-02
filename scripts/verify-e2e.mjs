/**
 * End-to-end: two brands through the real ingest pipeline, real embeddings,
 * real Pinecone, real retrieval, real fit check.
 *
 * This is the plan's tenant-isolation step, and the only version of it that
 * means anything. verify-pinecone.mjs proves the namespace boundary with fixed
 * vectors; this proves it with content that genuinely *should* match — brand B
 * is given wording so distinctive that if isolation leaked at any layer, a
 * brand A query for it would surface it immediately.
 *
 * It writes rows prefixed `zz-e2e` to Postgres and namespaces to Pinecone, and
 * removes both afterwards. Point it at a development database.
 *
 *   npm run verify:e2e
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { and, eq } = await import("drizzle-orm");
const { db } = await import("../src/lib/db/client.js");
const { brandMembers, brandProfiles, documentChunks, documents, brands, users } =
  await import("../src/lib/db/schema.js");
const { ingestDocument } = await import("../src/lib/ingest/pipeline.js");
const { retrieveBrandContext } = await import("../src/lib/ai/retrieve.js");
const { runFitCheck } = await import("../src/lib/ai/fit-check.js");
const { verdictForScore } = await import("../src/lib/ai/prompt.js");
const { brandIndex, brandNamespace } = await import("../src/lib/ai/pinecone.js").then(
  async (m) => ({ ...m, ...(await import("../src/lib/ai/config.js")) }),
);

const MODEL = process.argv[2] ?? "deepseek/deepseek-v3.2";
const TAG = "zz-e2e";

// Brand B's wording exists nowhere in brand A. If any layer leaks — the
// namespace, the brand filter on chunk hydration, the fit-check prompt — a
// brand A query for "quillamber" finds it.
const BRAND_A_TEXT = `Northgate Cycles brand book.

We make bicycles for people who are not cyclists. Our rider is a nurse, a
teacher, a shift worker. They ride in ordinary clothes, in ordinary weather,
to ordinary places.

We never show competitive cycling. Podium imagery, performance statistics and
the word "athlete" are off-limits in every market and every channel.

Photography is muted daylight on real streets, including rain and bad road
surfaces. Bikes appear at rest or in ordinary use, never mid-race.

Our tone is plain-spoken and warm. We do not use hype, superlatives, or
exclamation marks. If a sentence sounds like an advert, rewrite it.`;

const BRAND_B_TEXT = `Quillamber Aerospace internal positioning.

Quillamber builds the Vantrell-class orbital propulsion stack. Our customers
are launch integrators, not consumers, and our language is technical.

The Vantrell thrust module operates at cryogenic temperatures and is certified
to the Bramwell-9 standard. Never soften this language for a general audience.

Our brand voice is precise, unhurried and engineering-led. We publish figures,
tolerances and failure modes openly, because our buyers are engineers who will
check them.`;

const results = [];
const check = async (name, fn) => {
  try {
    results.push(`PASS  ${name} — ${await fn()}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${String(error?.message ?? error).slice(0, 400)}`);
  }
};

let brandA, brandB, userId;

async function makeBrand(slug, name, text, profile) {
  const [brand] = await db.insert(brands).values({ slug, name }).returning();
  await db.insert(brandMembers).values({ brandId: brand.id, userId, role: "owner" });
  await db.insert(brandProfiles).values({ brandId: brand.id, ...profile });

  const [doc] = await db
    .insert(documents)
    .values({
      brandId: brand.id,
      title: `${name} Brand Book`,
      sourceType: "note",
      body: text,
      status: "pending",
      createdBy: userId,
    })
    .returning();

  return { brand, doc };
}

await check("seed two brands and ingest a document into each", async () => {
  const [user] = await db
    .insert(users)
    .values({ id: `uid-${TAG}`, email: `${TAG}@example.com`, displayName: "E2E" })
    .returning();
  userId = user.id;

  const a = await makeBrand(`${TAG}-northgate`, "Northgate Cycles", BRAND_A_TEXT, {
    mission: "Make everyday cycling feel ordinary, not extreme.",
    values: ["Practical over heroic", "For everyone"],
    tone: ["Plain-spoken", "Warm", "Never hype"],
    audience: "Commuters who do not think of themselves as cyclists.",
    dos: ["Show real streets", "Show bad weather"],
    donts: ["No podium imagery", "No performance stats", "Never say athlete"],
    visual: ["Muted daylight", "Bikes at rest"],
  });
  const b = await makeBrand(`${TAG}-quillamber`, "Quillamber Aerospace", BRAND_B_TEXT, {
    mission: "Build the most inspectable propulsion stack in orbit.",
    values: ["Precision", "Openness about failure modes"],
    tone: ["Technical", "Unhurried"],
    audience: "Launch integrators and propulsion engineers.",
    dos: ["Publish tolerances"],
    donts: ["Never soften technical language"],
    visual: ["Engineering documentation"],
  });

  brandA = a.brand;
  brandB = b.brand;

  const [ra, rb] = await Promise.all([
    ingestDocument(a.doc.id),
    ingestDocument(b.doc.id),
  ]);

  // Pinecone is not read-your-writes immediate.
  for (let i = 0; i < 40; i += 1) {
    const stats = await brandIndex().describeIndexStats();
    const na = stats.namespaces?.[brandNamespace(brandA.id)]?.recordCount ?? 0;
    const nb = stats.namespaces?.[brandNamespace(brandB.id)]?.recordCount ?? 0;
    if (na >= ra.chunks && nb >= rb.chunks) {
      return `A=${ra.chunks} chunks, B=${rb.chunks} chunks, both indexed`;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("vectors never became visible in Pinecone");
});

await check("documents reach status ready with body persisted", async () => {
  const rows = await db
    .select({ status: documents.status, body: documents.body, error: documents.error })
    .from(documents)
    .where(eq(documents.brandId, brandA.id));
  const bad = rows.filter((r) => r.status !== "ready");
  if (bad.length) throw new Error(`status ${bad[0].status}: ${bad[0].error}`);
  if (!rows[0].body) throw new Error("body was not persisted — the reader would repeat chunks");
  return `ready, ${rows[0].body.length} chars of source text`;
});

await check("brand A retrieval returns brand A content", async () => {
  const chunks = await retrieveBrandContext({
    brandId: brandA.id,
    query: "what photography style should we use in the rain",
  });
  if (!chunks.length) throw new Error("retrieved nothing");
  if (!chunks.some((c) => /muted daylight|real streets/i.test(c.content))) {
    throw new Error("retrieved chunks did not include the photography guidance");
  }
  return `${chunks.length} chunks, top score ${chunks[0].score?.toFixed(3)}`;
});

await check("brand A cannot retrieve brand B, even when asked for it", async () => {
  // Queried with brand B's most distinctive terms. A semantic match is the
  // whole point: if the boundary were leaky, this is what would find it.
  for (const query of [
    "Quillamber Vantrell cryogenic thrust module",
    "Bramwell-9 certification tolerances and failure modes",
  ]) {
    const chunks = await retrieveBrandContext({ brandId: brandA.id, query });
    const leaked = chunks.filter((c) =>
      /quillamber|vantrell|bramwell/i.test(c.content),
    );
    if (leaked.length) throw new Error(`LEAK on "${query}": ${leaked.length} chunks`);
  }
  return "0 brand B chunks across 2 targeted queries";
});

await check("brand B cannot retrieve brand A", async () => {
  const chunks = await retrieveBrandContext({
    brandId: brandB.id,
    query: "podium imagery and commuter cycling photography in the rain",
  });
  const leaked = chunks.filter((c) => /northgate|podium|commuter/i.test(c.content));
  if (leaked.length) throw new Error(`LEAK: ${leaked.length} chunks`);
  return "0 brand A chunks";
});

await check("a deleted brand's namespace retrieves nothing", async () => {
  const chunks = await retrieveBrandContext({
    brandId: "00000000-0000-0000-0000-000000000000",
    query: "brand guidelines",
  });
  if (chunks.length) throw new Error(`LEAK: ${chunks.length} chunks`);
  return "0 chunks";
});

await check("fit check grounds an off-brand idea in brand A's own documents", async () => {
  const [profile] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.brandId, brandA.id));

  const verdict = await runFitCheck({
    brandId: brandA.id,
    brandName: "Northgate Cycles",
    profile,
    modelId: MODEL,
    idea: "Sponsor a pro racing team, shoot podium celebrations, and headline the wattage numbers our athletes hit.",
  });

  if (verdict.overallScore > 40) {
    throw new Error(`scored ${verdict.overallScore} for an idea breaking three donts`);
  }
  // A live run returned score 0 with verdict "strong-fit", which the earlier
  // score-only assertion happily accepted.
  if (verdict.verdict !== verdictForScore(verdict.overallScore)) {
    throw new Error(
      `label "${verdict.verdict}" contradicts score ${verdict.overallScore}`,
    );
  }
  if (!verdict.retrieved) throw new Error("no context was retrieved");
  if (!verdict.citations.length) {
    throw new Error("no citations survived — the verdict is ungrounded");
  }
  // Every surviving citation must resolve to a real chunk of THIS brand.
  for (const citation of verdict.citations) {
    const [row] = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.pineconeId, citation.chunkId),
          eq(documentChunks.brandId, brandA.id),
        ),
      )
      .limit(1);
    if (!row) throw new Error(`citation ${citation.chunkId} is not a brand A chunk`);
  }
  return `${verdict.overallScore}/${verdict.verdict}, ${verdict.citations.length} citations verified, ${verdict.droppedCitations} dropped`;
});

// Cleanup: Pinecone first, since it is keyed off rows we are about to delete.
for (const brand of [brandA, brandB]) {
  if (!brand) continue;
  await brandIndex()
    .namespace(brandNamespace(brand.id))
    .deleteAll()
    .catch(() => {});
  await db.delete(brands).where(eq(brands.id, brand.id));
}
if (userId) await db.delete(users).where(eq(users.id, userId));

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
