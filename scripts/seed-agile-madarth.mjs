/**
 * Seeds the Agile Madarth brand: structured profile, knowledge documents,
 * and an owner invite.
 *
 * Sibling of Madarth Core / Search Madarth / Roots Madarth — see
 * scripts/seed-madarth.mjs for the split rationale and the shared content
 * these all pull from.
 *
 * Idempotent — re-running replaces the profile and re-ingests every document.
 *
 *   npm run seed:agile-madarth
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
const SLUG = "agile-madarth";

const PROFILE = {
  ...SHARED_PROFILE,
  mission:
    "Help Indian businesses become world-class brands. Scale without losing soul — Peruga. Aanaal Pirinthu Pogaathe. An idea wears a veshti and sneakers: rooted in Indian culture, sharp in its output.",
  audience:
    "B2B and technical clients needing digital transformation, product, technology and platform work.",
  tone: [
    "PG Wodehouse wit and precision, Crazy Mohan warmth, over filter coffee",
    "Earnest but not solemn",
    "Direct but not blunt",
    "Confident and earned, never arrogant",
    "Restraint is the register: shorter sentences, concrete claims, no ornament for its own sake — warmth shows up as clarity, not playfulness",
  ],
  visual: [
    "Mango Skin #E8621A — Agile Madarth",
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
    title: "Agile Madarth — Brand Knowledge",
    body: `AGILE MADARTH

Colour: Mango Skin #E8621A. Background #261A15.

Scope: Digital transformation, product, technology, platforms.

Agile Madarth handles the work where the deliverable is a system rather than a campaign — products, platforms, internal tooling, transformation programmes. The audience skews B2B and technical, so precision carries more of the weight than wit.

Restraint is the register: shorter sentences, concrete claims, no ornament for its own sake. The warmth is still there, but it shows up as clarity rather than playfulness.`,
  },
];

await seedBrand({
  slug: SLUG,
  name: "Agile Madarth",
  profile: PROFILE,
  documents: DOCUMENTS,
  ownerEmail: OWNER_EMAIL,
});

process.exit(0);
