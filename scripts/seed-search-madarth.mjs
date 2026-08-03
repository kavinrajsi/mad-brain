/**
 * Seeds the Search Madarth brand: structured profile, knowledge documents,
 * and an owner invite.
 *
 * Sibling of Madarth Core / Agile Madarth / Roots Madarth — see
 * scripts/seed-madarth.mjs for the split rationale and the shared content
 * these all pull from.
 *
 * Idempotent — re-running replaces the profile and re-ingests every document.
 *
 *   npm run seed:search-madarth
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
const SLUG = "search-madarth";

const PROFILE = {
  ...SHARED_PROFILE,
  mission:
    "Help Indian businesses become world-class brands. Scale without losing soul — Peruga. Aanaal Pirinthu Pogaathe. An idea wears a veshti and sneakers: rooted in Indian culture, sharp in its output.",
  audience:
    "Clients who need digital performance, SEO, social media and web work — data meets gut, not a numbers shop.",
  tone: [
    "PG Wodehouse wit and precision, Crazy Mohan warmth, over filter coffee",
    "Earnest but not solemn",
    "Direct but not blunt",
    "Tamil at heart, speaks to the world",
    "Confident and earned, never arrogant",
    "Closer to the ground and more immediate than Core, but no agency-speak, no 'data is the new oil' clichés, no engagement-bait phrasing",
  ],
  visual: [
    "Leaf Green #2E7D32 — Search Madarth",
    "Charcoal #1C1C1A — primary dark, never pure black",
    "Cream #FFF8E7 — primary light, never pure white",
    "Primary type: Anek Tamil, weights 100–800, headlines to captions",
    "Accent type: Caveat — handwritten, always green, at most one use per layout",
  ],
};

const DOCUMENTS = [
  SHARED_KNOWLEDGE_DOC,
  VISUAL_SYSTEM_DOC,
  THREE_TESTS_DOC,
  {
    title: "Search Madarth — Brand Knowledge",
    body: `SEARCH MADARTH

Colour: Leaf Green #2E7D32. Background #1A261B.

Scope: Digital performance, SEO, social media, web. Data meets gut.

Search Madarth is where measurement lives, but the division is explicitly not a numbers shop. "Data meets gut" is the operating line: the data narrows the field, judgement picks the answer. Performance work still has to pass the Origin Test — a campaign that converts on a hollow premise is not Madarth work.

Copy here is closer to the ground and more immediate than Core, but the prohibitions do not relax: no agency-speak, no "data is the new oil" clichés, no engagement-bait phrasing.`,
  },
];

await seedBrand({
  slug: SLUG,
  name: "Search Madarth",
  profile: PROFILE,
  documents: DOCUMENTS,
  ownerEmail: OWNER_EMAIL,
});

process.exit(0);
