/**
 * Proves the Pinecone namespace boundary holds against a live index.
 *
 * Namespace-per-brand is the hard tenant boundary in this system: everything
 * else — the DAL, the brand-scoped SQL — protects Postgres, and nothing but
 * this protects retrieval. A leak here would surface one brand's confidential
 * strategy inside another brand's fit check, with a citation attached.
 *
 * It calls the functions the app actually ships rather than reimplementing the
 * SDK calls, so a wrong call shape fails here instead of in production. Fixed
 * vectors are used deliberately: the claim under test is a property of the
 * namespace, not of what the vectors mean, so no embedding key is needed.
 *
 * It writes to the index in PINECONE_INDEX under namespaces derived from ids
 * prefixed `zz-verify`, and deletes them afterwards.
 *
 *   npm run verify:pinecone
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { EMBEDDING, PINECONE_INDEX, brandNamespace } = await import(
  "../src/lib/ai/config.js"
);
const {
  brandIndex,
  deleteBrandVectors,
  ensureIndex,
  queryBrandVectors,
  upsertBrandVectors,
} = await import("../src/lib/ai/pinecone.js");

const BRAND_A = "zz-verify-brand-a";
const BRAND_B = "zz-verify-brand-b";

const vec = (seed) =>
  Array.from({ length: EMBEDDING.dimension }, (_, i) => Math.sin(seed + i * 0.01));

const records = (brand) => [
  { id: `${brand}:0`, values: vec(1), metadata: { brand } },
  { id: `${brand}:1`, values: vec(2), metadata: { brand } },
];

const results = [];
const check = async (name, fn) => {
  try {
    results.push(`PASS  ${name} — ${await fn()}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${error.message}`);
  }
};

/** Upserts are not read-your-writes immediate on serverless indexes. */
async function waitForCount(namespace, want) {
  for (let i = 0; i < 30; i += 1) {
    const stats = await brandIndex().describeIndexStats();
    const have = stats.namespaces?.[namespace]?.recordCount ?? 0;
    if (have >= want) return have;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`namespace ${namespace} never reached ${want} records`);
}

await check("the live index matches the pinned model's dimension", async () => {
  const { created } = await ensureIndex();
  if (created) throw new Error("the index did not exist — it was just created");
  return `${EMBEDDING.dimension}d, ${EMBEDDING.metric}, ${PINECONE_INDEX}`;
});

await check("upsertBrandVectors writes to two brand namespaces", async () => {
  await upsertBrandVectors({ brandId: BRAND_A, records: records("a") });
  await upsertBrandVectors({ brandId: BRAND_B, records: records("b") });

  const [a, b] = await Promise.all([
    waitForCount(brandNamespace(BRAND_A), 2),
    waitForCount(brandNamespace(BRAND_B), 2),
  ]);
  return `A=${a}, B=${b}`;
});

await check("a query in brand A never returns brand B", async () => {
  const matches = await queryBrandVectors({
    brandId: BRAND_A,
    vector: vec(1),
    topK: 10,
  });
  // Without this the check passes vacuously when retrieval returns nothing.
  if (matches.length < 2) throw new Error(`only ${matches.length} matches`);
  const foreign = matches.filter((m) => m.metadata?.brand !== "a");
  if (foreign.length) throw new Error(`LEAK: ${foreign.map((m) => m.id).join(", ")}`);
  return `${matches.length} matches, all brand A`;
});

await check("a query in brand B never returns brand A", async () => {
  const matches = await queryBrandVectors({
    brandId: BRAND_B,
    vector: vec(1),
    topK: 10,
  });
  if (matches.length < 2) throw new Error(`only ${matches.length} matches`);
  const foreign = matches.filter((m) => m.metadata?.brand !== "b");
  if (foreign.length) throw new Error(`LEAK: ${foreign.map((m) => m.id).join(", ")}`);
  return `${matches.length} matches, all brand B`;
});

await check("an unknown brand retrieves nothing at all", async () => {
  const matches = await queryBrandVectors({
    brandId: "zz-verify-brand-never-created",
    vector: vec(1),
    topK: 10,
  });
  if (matches.length) throw new Error(`LEAK: ${matches.length} matches`);
  return "0 matches";
});

await check("deleting brand A's vectors leaves brand B intact", async () => {
  await deleteBrandVectors({ brandId: BRAND_A, ids: ["a:0", "a:1"] });

  const stillThere = await queryBrandVectors({
    brandId: BRAND_B,
    vector: vec(1),
    topK: 10,
  });
  if (stillThere.length < 2) {
    throw new Error(`brand B lost vectors: ${stillThere.length}`);
  }
  return `brand B still has ${stillThere.length}`;
});

for (const brand of [BRAND_A, BRAND_B]) {
  await brandIndex()
    .namespace(brandNamespace(brand))
    .deleteAll()
    .catch(() => {});
}

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
