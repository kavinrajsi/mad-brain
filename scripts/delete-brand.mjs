/**
 * Deletes a brand: its Pinecone namespace, then every row it owns.
 *
 * There is deliberately no UI for this. Deleting a brand destroys its
 * documents, chunks, members, invites and check history at once, and the
 * vectors cannot be rebuilt without re-ingesting every source — so it is a
 * command someone runs on purpose, not a button anyone can reach.
 *
 * Postgres cascades from the brand row. Pinecone does not, so the namespace is
 * cleared first: doing it afterwards would mean losing the brand id needed to
 * name the namespace, leaving orphaned vectors that nothing can find or remove.
 *
 *   npm run delete:brand -- <slug>          # dry run, shows what would go
 *   npm run delete:brand -- <slug> --yes    # actually deletes
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { eq } = await import("drizzle-orm");
const { db } = await import("../src/lib/db/client.js");
const { brandMembers, brandProfiles, documentChunks, documents, brands, ideaChecks, invites } =
  await import("../src/lib/db/schema.js");
const { brandIndex } = await import("../src/lib/ai/pinecone.js");
const { brandNamespace } = await import("../src/lib/ai/config.js");

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const confirmed = args.includes("--yes");

if (!slug) {
  const all = await db.select({ slug: brands.slug, name: brands.name }).from(brands);
  console.error("Usage: npm run delete:brand -- <slug> [--yes]\n");
  console.error(
    all.length
      ? `Brands:\n${all.map((b) => `  ${b.slug}  (${b.name})`).join("\n")}`
      : "No brands exist.",
  );
  process.exit(1);
}

const [brand] = await db.select().from(brands).where(eq(brands.slug, slug));
if (!brand) {
  console.error(`No brand with slug "${slug}".`);
  process.exit(1);
}

const counts = {};
for (const [label, table, column] of [
  ["documents", documents, documents.brandId],
  ["chunks", documentChunks, documentChunks.brandId],
  ["members", brandMembers, brandMembers.brandId],
  ["invites", invites, invites.brandId],
  ["idea checks", ideaChecks, ideaChecks.brandId],
  ["profile", brandProfiles, brandProfiles.brandId],
]) {
  const rows = await db.select().from(table).where(eq(column, brand.id));
  counts[label] = rows.length;
}

const stats = await brandIndex().describeIndexStats();
const vectors = stats.namespaces?.[brandNamespace(brand.id)]?.recordCount ?? 0;

console.log(`Brand: ${brand.name} (${brand.slug})`);
console.log(`  id: ${brand.id}`);
for (const [label, count] of Object.entries(counts)) {
  console.log(`  ${label}: ${count}`);
}
console.log(`  pinecone vectors: ${vectors}`);

if (!confirmed) {
  console.log(`\nDry run. Nothing deleted. Re-run with --yes to delete this brand.`);
  process.exit(0);
}

// Pinecone first — see the note at the top.
await brandIndex().namespace(brandNamespace(brand.id)).deleteAll();
console.log("\nPinecone namespace cleared.");

await db.delete(brands).where(eq(brands.id, brand.id));
console.log("Brand and all its rows deleted.");
process.exit(0);
