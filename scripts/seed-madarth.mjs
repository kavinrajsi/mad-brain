/**
 * Seeds the Madarth brand: structured profile, knowledge documents, and an
 * owner invite.
 *
 * Source is the "Madarth Brand Brain — Editable Content" brief. The JSON
 * response-format instructions in that brief are deliberately left out: they
 * describe a different tool's output contract, and as retrievable text they
 * would surface as citations in fit checks about brand voice.
 *
 * Idempotent — re-running replaces the profile and re-ingests every document.
 *
 *   npm run seed:madarth
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { randomBytes } = await import("node:crypto");
const { and, eq } = await import("drizzle-orm");
const { db } = await import("../src/lib/db/client.js");
const { brandProfiles, brands, documents, invites } = await import(
  "../src/lib/db/schema.js"
);
const { ingestDocument } = await import("../src/lib/ingest/pipeline.js");

const OWNER_EMAIL = process.argv[2] ?? "sikavinraj@gmail.com";
const SLUG = "madarth";

const PROFILE = {
  mission:
    "Help Indian businesses become world-class brands. Scale without losing soul — Peruga. Aanaal Pirinthu Pogaathe. An idea wears a veshti and sneakers: rooted in Indian culture, sharp in its output.",
  audience:
    "Ambitious Indian businesses that want to be great, not just big. Founders and marketing leads who want a partner that co-builds and challenges, not a vendor that serves. Family businesses modernising a legacy sit under Roots Madarth.",
  values: [
    "Long-Term Thinking — decisions honour decades, not deadlines",
    "Truthfulness — no gimmicks, human relevance in every pixel",
    "Uncompromised Quality — in every frame, touchpoint, craft detail",
    "Psychological Safety — no fear, no ego, free to fail, learn, speak",
    "Curiosity — seek first, understand before acting",
    "Discipline — we deliver, always",
    "Adapt & Unlearn — egos down, minds open",
    "Responsibility — to community, employees, environment",
    "Client Partnership — co-build and challenge, not just serve",
    "Soul First — values as lived systems, not wall-paint slogans",
  ],
  tone: [
    "PG Wodehouse wit and precision, Crazy Mohan warmth, over filter coffee",
    "Earnest but not solemn",
    "Direct but not blunt",
    "Tamil at heart, speaks to the world",
    "We take our fun very seriously — both things at once",
    "Dichotomies are strength: rebellious and reverent at once",
    "Confident and earned, never arrogant",
  ],
  dos: [
    "Root the idea in a specific cultural truth — Tamil, Indian, regional",
    "Carry warmth and precision in the same breath",
    "Pass the Origin Test: a real human truth, not a brand claim",
    "Pass the Rigour Test: honestly pressure-tested, not just plausible",
    "Pass the Outcome Test: serves a clear business objective",
    "Carry all four qualities at once: strategic, creative, executional, humble",
    "Use bilingual copy only when it earns its place",
    "Leave generous white space — it is a design choice, not waste",
    "One big idea per slide, frame or post",
    "Use base-8 spacing: 8, 16, 24, 32, 48, 64, 96px",
  ],
  donts: [
    "No agency-speak masquerading as brand writing",
    "No generic pan-Indian work — be culturally specific",
    "No tokenistic Tamil",
    "No 'storytelling', 'journey' or 'ecosystem' in copy",
    "No motivational poster language",
    "No pure black #000000 or pure white #FFFFFF — use Charcoal #1C1C1A and Cream #FFF8E7",
    "No purple gradients, neon accents or contemporary digital clichés",
    "No generic premium aesthetics — serif on dark with no concept",
    "No crowded layouts",
    "Never use Inter, Roboto, Arial or a generic sans as a headline face",
    "Never swap the type rule: Caveat is green, Anek is charcoal",
  ],
  visual: [
    "Mango Gold #F5B800 — brand hero, master signal",
    "Leaf Green #2E7D32 — Search Madarth",
    "Mango Skin #E8621A — Agile Madarth",
    "Trunk Brown #6D4C41 — Roots Madarth",
    "Charcoal #1C1C1A — primary dark, never pure black",
    "Cream #FFF8E7 — primary light, never pure white",
    "Primary type: Anek Tamil, weights 100–800, headlines to captions",
    "Accent type: Caveat — handwritten, always green, at most one use per layout",
    "Presentation covers: Mango Gold background, M-tessellation band in the top 30%, MADARTH® serif wordmark bottom-left",
  ],
};

const DOCUMENTS = [
  {
    title: "Madarth Brand Knowledge",
    pinnedOrder: 1,
    body: `THE CORE

Madarth® was founded in 2005. Based in Mylapore, Chennai, in a 110-year-old building with a mango tree older than the building itself. 20 years in branding, advertising, and digital transformation. The mango tree is not decoration — it is the brand metaphor. Deep roots. Sharp edge.

THE COMMUNE

Madarth is not an agency. It is a commune of people who serve each other and a cause bigger than themselves. Vision: "Scale without losing soul." In Tamil: "Peruga. Aanaal Pirinthu Pogaathe." — Grow. But don't lose yourself.

THE LINE

"An idea wears a veshti and sneakers." This captures everything: rooted in Indian culture, sharp in its output. Rebellious and reverent at once.

THE 4 UNMISSABLE QUALITIES

Every piece of Madarth work must carry ALL four:

1. STRATEGIC: Connects to a long-term brand arc. No short-term noise for its own sake.
2. CREATIVE: Beautiful AND effective. Not just aesthetically pleasing — advertising that works.
3. EXECUTIONAL: Craft at Madarth's standard. Execution is not support — it is craft.
4. HUMBLE: Approached with a learning mindset. Curious, never arrogant.

THE MADARTH WAY

The creative process: Truth → Idea → Expression → Scale.

THREE QUALITY GATES

1. Origin Test: "Is this rooted in a real human truth?" Not a brand claim — a human truth. Something a person would say about their own life without the product in the room.
2. Rigour Test: "Has this been honestly pressure-tested?" What would the client object to? Could any other agency have made this?
3. Outcome Test: "Does this serve a clear business objective?" Beautiful work that doesn't move the needle is decoration.

INSIGHTING PHILOSOPHY

"Brand astrology — you don't count stars, you read them."

Observation is NOT insight. "People are buying more herbal shampoo" is an observation. "People have stopped trusting modern medicine and are returning to grandmother's kitchen for that trust" is an insight.

The 5-Why method moves through: Surface → Behavioural → Situational → Emotional → Human Truth.

BRAND VOICE

PG Wodehouse (wit, precision) plus Crazy Mohan (warmth, playfulness), over filter coffee (grounded, unhurried).

What it sounds like:
- Earnest but not solemn
- Direct but not blunt
- Tamil at heart, speaks to the world
- "We take our fun very seriously" — both things at once
- Dichotomies are strength: "Rebellious and reverent at once"
- Culturally specific (Mylapore, filter coffee, Tamil) — not generic pan-Indian
- Bilingual when it earns its place — not tokenistic

Tone, yes to: confident and earned, warm and direct, sharp and purposeful, culturally specific, human and honest.
Tone, no to: arrogant, cold or formal, verbose, generic pan-Indian, agency-speak, tokenistic Tamil.

BRAND PRISM

- Physique: Helps Indian businesses become world-class brands
- Personality: Confident, Happy, Sensible
- Culture: Old & New India | Deliberate & Nimble | Raw & Ripe | Fair & Progressive
- Relationship: Co-build, Challenge, Long-term — NOT service or servitude
- Reflection: Ambitious Indian businesses that want to be great, not just big
- Self-Image: Freedom & Responsibility

TEN VALUES

1. Long-Term Thinking — decisions honour decades, not deadlines
2. Truthfulness — no gimmicks, human relevance in every pixel
3. Uncompromised Quality — in every frame, touchpoint, craft detail
4. Psychological Safety — no fear, no ego, free to fail, learn, speak
5. Curiosity — seek first, understand before acting
6. Discipline — we deliver, always
7. Adapt & Unlearn — egos down, minds open
8. Responsibility — to community, employees, environment
9. Client Partnership — co-build and challenge, not just serve
10. Soul First — values as lived systems, not wall-paint slogans

WHAT MAKES WORK DISTINCTLY MADARTH

- It's rooted in a specific cultural truth (Tamil, Indian, regional)
- It has both warmth and precision in the same breath
- It doesn't look like it came from a generic AI prompt
- It carries a recognisable POV — confident without being loud
- It earns its wit — not trying to be clever for its own sake
- There's usually a tension in the idea: old and new, raw and ripe, serious and playful

WHAT IS NEVER MADARTH

- Purple gradients on white
- Generic "premium" aesthetics (serif on dark, no concept)
- Motivational poster language
- "Storytelling" or "journey" or "ecosystem" in copy
- Overcrowded layouts
- Pure black or pure white
- Agency-speak masquerading as brand writing`,
  },
  {
    title: "Visual System",
    pinnedOrder: 2,
    body: `COLOURS

- Mango Gold #F5B800 — brand hero, master signal
- Leaf Green #2E7D32 — Search Madarth
- Mango Skin #E8621A — Agile Madarth
- Trunk Brown #6D4C41 — Roots Madarth
- Charcoal #1C1C1A — primary dark. NOT pure black #000000.
- Cream #FFF8E7 — primary light. NOT pure white #FFFFFF.

TYPOGRAPHY

- Primary: Anek Tamil, all weights 100–800, from headlines to captions.
- Accent: Caveat — handwritten, ALWAYS green, ALWAYS at most one use per layout.
- Rule: Caveat is green. Anek is charcoal. These do not swap.
- Never use Inter, Roboto, Arial or a generic sans as a headline face.

LAYOUT

- Base-8 spacing: 8, 16, 24, 32, 48, 64, 96px.
- Generous white space — it is a design choice, not waste.
- One big idea per slide, frame or post.
- Never crowd.
- No purple gradients, neon accents, or contemporary digital clichés.

PRESENTATION COVERS

- Always a Mango Gold background.
- M-tessellation pattern band across the top 30%. The M is from the MADARTH® serif wordmark, set in two rows, with the second row flipped 180°.
- MADARTH® serif wordmark bottom-left.
- Title treatment: Caveat in green, with Anek ExtraBold in charcoal.

VISUAL NEVER-DOS

- No pure black or white
- No purple gradients
- No neon accents
- No agency-speak in copy
- No crowded layouts
- No tokenistic Tamil`,
  },
  {
    title: "Division — Madarth Core",
    pinnedOrder: 3,
    body: `MADARTH CORE

Colour: Mango Gold #F5B800. Background Charcoal #1C1C1A.

Scope: Branding, advertising, brand strategy, campaigns. Full-spectrum creative.

Core is the master signal of the group — when work carries Mango Gold it is speaking as Madarth itself, not as a division. Campaign thinking here starts from brand arc rather than channel: the question is what the brand will mean in five years, and what this piece contributes to that.

Tone runs the full Madarth register — wit and warmth, confident and earned. Core work is where "an idea wears a veshti and sneakers" is most literally true.`,
  },
  {
    title: "Division — Search Madarth",
    pinnedOrder: 4,
    body: `SEARCH MADARTH

Colour: Leaf Green #2E7D32. Background #1A261B.

Scope: Digital performance, SEO, social media, web. Data meets gut.

Search Madarth is where measurement lives, but the division is explicitly not a numbers shop. "Data meets gut" is the operating line: the data narrows the field, judgement picks the answer. Performance work still has to pass the Origin Test — a campaign that converts on a hollow premise is not Madarth work.

Copy here is closer to the ground and more immediate than Core, but the prohibitions do not relax: no agency-speak, no "data is the new oil" clichés, no engagement-bait phrasing.`,
  },
  {
    title: "Division — Agile Madarth",
    pinnedOrder: 5,
    body: `AGILE MADARTH

Colour: Mango Skin #E8621A. Background #261A15.

Scope: Digital transformation, product, technology, platforms.

Agile Madarth handles the work where the deliverable is a system rather than a campaign — products, platforms, internal tooling, transformation programmes. The audience skews B2B and technical, so precision carries more of the weight than wit.

Restraint is the register: shorter sentences, concrete claims, no ornament for its own sake. The warmth is still there, but it shows up as clarity rather than playfulness.`,
  },
  {
    title: "Division — Roots Madarth",
    pinnedOrder: 6,
    body: `ROOTS MADARTH

Colour: Trunk Brown #6D4C41, with Green #33691E. Background #1E1715.

Scope: Family business transformation, heritage brands, legacy modernisation.

Roots is the division closest to the mango tree metaphor: businesses with decades of history that need to move without severing what made them. The client is often a second or third generation taking over, and the emotional stakes are inheritance rather than growth.

Tone is the warmest and least hurried of the four. Reverence is genuine here, not a device — but it must not tip into nostalgia. The work has to make the case for change while honouring what came before. Long-term thinking is not a value statement in this division; it is the brief.`,
  },
  {
    title: "The Three Tests — Quick Reference",
    pinnedOrder: 7,
    body: `THE THREE TESTS

Origin — Is this rooted in a real human truth? Not a brand claim. Something a person would say about their own life without the product in the room.

Rigour — Has this been honestly pressure-tested? What would the client object to? Could any other agency have made this?

Outcome — Does this serve a clear business objective? Beautiful work that doesn't move the needle is decoration.

THE FOUR UNMISSABLE QUALITIES

Strategic — long-term brand arc, not noise.
Creative — beautiful AND effective.
Executional — craft at Madarth's standard.
Humble — curious, never arrogant.

BRAND VOICE IN ONE LINE

PG Wodehouse wit and Crazy Mohan warmth, over filter coffee.

Never: agency-speak, generic pan-Indian, tokenistic Tamil.`,
  },
];

async function main() {
  let [brand] = await db.select().from(brands).where(eq(brands.slug, SLUG));

  if (!brand) {
    [brand] = await db
      .insert(brands)
      .values({ slug: SLUG, name: "Madarth" })
      .returning();
    console.log(`Created brand ${SLUG}.`);
  } else {
    console.log(`Brand ${SLUG} already exists — refreshing.`);
  }

  await db
    .insert(brandProfiles)
    .values({ brandId: brand.id, ...PROFILE })
    .onConflictDoUpdate({
      target: brandProfiles.brandId,
      set: { ...PROFILE, updatedAt: new Date() },
    });
  console.log("Profile written.");

  for (const spec of DOCUMENTS) {
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.brandId, brand.id), eq(documents.title, spec.title)))
      .limit(1);

    let id = existing?.id;
    if (id) {
      await db
        .update(documents)
        .set({ body: spec.body, pinnedOrder: spec.pinnedOrder, status: "pending" })
        .where(eq(documents.id, id));
    } else {
      const [row] = await db
        .insert(documents)
        .values({
          brandId: brand.id,
          title: spec.title,
          sourceType: "note",
          body: spec.body,
          pinnedOrder: spec.pinnedOrder,
          status: "pending",
        })
        .returning({ id: documents.id });
      id = row.id;
    }

    const { chunks } = await ingestDocument(id);
    console.log(`  ${spec.title} — ${chunks} chunks`);
  }

  // An invite rather than a membership row: the owner has no Firebase account
  // yet, and invites are consumed by email on first sign-in.
  const [already] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(
      and(
        eq(invites.brandId, brand.id),
        eq(invites.email, OWNER_EMAIL.toLowerCase()),
      ),
    )
    .limit(1);

  if (already) {
    console.log(`Owner invite for ${OWNER_EMAIL} already exists.`);
  } else {
    await db.insert(invites).values({
      brandId: brand.id,
      email: OWNER_EMAIL.toLowerCase(),
      role: "owner",
      token: randomBytes(32).toString("base64url"),
      expiresAt: new Date(Date.now() + 365 * 86400_000),
    });
    console.log(`Owner invite created for ${OWNER_EMAIL}.`);
  }

  console.log(`\nDone. Sign in as ${OWNER_EMAIL}, then open /b/${SLUG}`);
}

await main();
process.exit(0);
