/**
 * Seeds the Madarth Core brand: structured profile, knowledge documents, and
 * an owner invite.
 *
 * Source is the "Madarth Brand Brain — Editable Content" brief. The JSON
 * response-format instructions in that brief are deliberately left out: they
 * describe a different tool's output contract, and as retrievable text they
 * would surface as citations in fit checks about brand voice.
 *
 * Madarth Core is one of four sibling brands (Core, Search, Agile, Roots) —
 * see scripts/seed-search-madarth.mjs etc. Slug stays "madarth" so this
 * brand's existing history/chats/members carry forward from when it held
 * all four divisions' content.
 *
 * Idempotent — re-running replaces the profile and re-ingests every document.
 *
 *   npm run seed:madarth
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { seedBrand } = await import("./lib/seed-brand.mjs");
const {
  SHARED_KNOWLEDGE_DOC,
  VISUAL_SYSTEM_DOC,
  THREE_TESTS_DOC,
  SHARED_PROFILE,
} = await import("./lib/madarth-shared-content.mjs");

const OWNER_EMAIL = process.argv[2] ?? "sikavinraj@gmail.com";
const SLUG = "madarth";

const PROFILE = {
  ...SHARED_PROFILE,
  mission:
    "Help Indian businesses become world-class brands. Scale without losing soul — Peruga. Aanaal Pirinthu Pogaathe. An idea wears a veshti and sneakers: rooted in Indian culture, sharp in its output.",
  audience:
    "Ambitious Indian businesses that want to be great, not just big. Founders and marketing leads who want a partner that co-builds and challenges, not a vendor that serves.",
  tone: [
    "PG Wodehouse wit and precision, Crazy Mohan warmth, over filter coffee",
    "Earnest but not solemn",
    "Direct but not blunt",
    "Tamil at heart, speaks to the world",
    "We take our fun very seriously — both things at once",
    "Dichotomies are strength: rebellious and reverent at once",
    "Confident and earned, never arrogant",
    "Full-spectrum Madarth register — wit and warmth, the whole voice",
  ],
  visual: [
    "Mango Gold #F5B800 — brand hero, master signal",
    "Charcoal #1C1C1A — primary dark, never pure black",
    "Cream #FFF8E7 — primary light, never pure white",
    "Primary type: Anek Tamil, weights 100–800, headlines to captions",
    "Accent type: Caveat — handwritten, always green, at most one use per layout",
    "Presentation covers: Mango Gold background, M-tessellation band in the top 30%, MADARTH® serif wordmark bottom-left",
  ],
};

const DOCUMENTS = [
  SHARED_KNOWLEDGE_DOC,
  VISUAL_SYSTEM_DOC,
  THREE_TESTS_DOC,
  {
    title: "Madarth Core — Brand Knowledge",
    body: `MADARTH CORE

Colour: Mango Gold #F5B800. Background Charcoal #1C1C1A.

Scope: Branding, advertising, brand strategy, campaigns. Full-spectrum creative.

Core is the master signal of the group — when work carries Mango Gold it is speaking as Madarth itself, not as a division. Campaign thinking here starts from brand arc rather than channel: the question is what the brand will mean in five years, and what this piece contributes to that.

Tone runs the full Madarth register — wit and warmth, confident and earned. Core work is where "an idea wears a veshti and sneakers" is most literally true.`,
  },
];

const brand = await seedBrand({
  slug: SLUG,
  name: "Madarth Core",
  profile: PROFILE,
  documents: DOCUMENTS,
  ownerEmail: OWNER_EMAIL,
});

// This brand held all four divisions' content before the Core/Search/Agile/
// Roots split. Those three documents moved to their own sibling brands
// (see seed-search-madarth.mjs etc) — seedBrand() only upserts documents it's
// given, so the old ones would otherwise sit here orphaned and stale.
{
  const { and, eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../src/lib/db/client.js");
  const { documentChunks, documents } = await import("../src/lib/db/schema.js");
  const { deleteBrandVectors } = await import("../src/lib/ai/pinecone.js");

  const STALE_TITLES = [
    "Division — Search Madarth",
    "Division — Agile Madarth",
    "Division — Roots Madarth",
  ];

  const stale = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(and(eq(documents.brandId, brand.id), inArray(documents.title, STALE_TITLES)));

  if (stale.length) {
    const chunks = await db
      .select({ pineconeId: documentChunks.pineconeId })
      .from(documentChunks)
      .where(inArray(documentChunks.documentId, stale.map((d) => d.id)));

    if (chunks.length) {
      await deleteBrandVectors({ brandId: brand.id, ids: chunks.map((c) => c.pineconeId) });
    }

    // Chunks cascade with the document row.
    await db.delete(documents).where(inArray(documents.id, stale.map((d) => d.id)));
    console.log(`Removed ${stale.length} stale division document(s): ${stale.map((d) => d.title).join(", ")}`);
  }
}

process.exit(0);
