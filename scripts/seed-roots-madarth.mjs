/**
 * Seeds the Roots Madarth brand: structured profile, knowledge documents,
 * and an owner invite.
 *
 * Sibling of Madarth Core / Search Madarth / Agile Madarth — see
 * scripts/seed-madarth.mjs for the split rationale and the shared content
 * these all pull from.
 *
 * Idempotent — re-running replaces the profile and re-ingests every document.
 *
 *   npm run seed:roots-madarth
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
const SLUG = "roots-madarth";

const PROFILE = {
  ...SHARED_PROFILE,
  mission:
    "Help Indian businesses become world-class brands. Scale without losing soul — Peruga. Aanaal Pirinthu Pogaathe. An idea wears a veshti and sneakers: rooted in Indian culture, sharp in its output.",
  audience:
    "Family businesses modernising a legacy — second or third generation founders taking over, where the emotional stakes are inheritance rather than growth.",
  tone: [
    "PG Wodehouse wit and precision, Crazy Mohan warmth, over filter coffee",
    "Earnest but not solemn",
    "Direct but not blunt",
    "Confident and earned, never arrogant",
    "The warmest and least hurried register of the four — reverence is genuine, but it must not tip into nostalgia",
  ],
  visual: [
    "Trunk Brown #6D4C41, with Green #33691E — Roots Madarth",
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
    title: "Roots Madarth — Brand Knowledge",
    body: `ROOTS MADARTH

Colour: Trunk Brown #6D4C41, with Green #33691E. Background #1E1715.

Scope: Family business transformation, heritage brands, legacy modernisation.

Roots is the division closest to the mango tree metaphor: businesses with decades of history that need to move without severing what made them. The client is often a second or third generation taking over, and the emotional stakes are inheritance rather than growth.

Tone is the warmest and least hurried of the four. Reverence is genuine here, not a device — but it must not tip into nostalgia. The work has to make the case for change while honouring what came before. Long-term thinking is not a value statement in this division; it is the brief.`,
  },
];

await seedBrand({
  slug: SLUG,
  name: "Roots Madarth",
  profile: PROFILE,
  documents: DOCUMENTS,
  ownerEmail: OWNER_EMAIL,
});

process.exit(0);
