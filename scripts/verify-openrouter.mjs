/**
 * Runs a real fit check against live OpenRouter models.
 *
 * Membership of the catalogue in src/lib/ai/models.js *is* the claim that a
 * model supports structured output — /check offers every entry — and that claim
 * had never been tested against OpenRouter. A model that ignores the schema
 * produces a broken verdict page rather than an error, so the failure would
 * arrive as a user complaint rather than an exception.
 *
 * Chunks are injected rather than retrieved, so this needs no embedding key and
 * no Pinecone round-trip — it isolates the model call.
 *
 * THIS SPENDS MONEY. One short call per model. Pass model ids to narrow it:
 *
 *   npm run verify:openrouter
 *   npm run verify:openrouter -- anthropic/claude-sonnet-5
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { MODELS } = await import("../src/lib/ai/models.js");
const { runFitCheck } = await import("../src/lib/ai/fit-check.js");

if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set. Add it to .env.local first.");
  process.exit(1);
}

// One model per provider by default — enough to prove the schema survives
// different backends without paying for the whole catalogue.
const DEFAULT_SAMPLE = [
  "anthropic/claude-sonnet-5",
  "openai/gpt-5.5",
  "google/gemini-3.5-flash",
  "deepseek/deepseek-v3.2",
];

const requested = process.argv.slice(2);
const selected = requested.length
  ? MODELS.filter((m) => requested.includes(m.id))
  : MODELS.filter((m) => DEFAULT_SAMPLE.includes(m.id));

if (!selected.length) {
  console.error(
    `No catalogue model matched. Available:\n${MODELS.map((m) => `  ${m.id}`).join("\n")}`,
  );
  process.exit(1);
}

const results = [];
const check = async (name, fn) => {
  try {
    results.push(`PASS  ${name} — ${await fn()}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${String(error?.message ?? error).slice(0, 300)}`);
  }
};

/**
 * Membership of MODELS *is* the claim that a model supports structured output —
 * there is no per-entry flag, and /check offers the whole catalogue. So drift
 * is silent: a delisted id, or one that loses structured-output support,
 * produces unparseable prose on a screen that expects a schema.
 */
await check("every catalogue model is live and supports structured output", async () => {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
  const { data } = await response.json();
  const live = new Map(data.map((m) => [m.id, m]));

  const gone = MODELS.filter((m) => !live.has(m.id)).map((m) => m.id);
  if (gone.length) throw new Error(`no longer on OpenRouter: ${gone.join(", ")}`);

  const unstructured = MODELS.filter(
    (m) => !(live.get(m.id).supported_parameters ?? []).includes("structured_outputs"),
  ).map((m) => m.id);
  if (unstructured.length) {
    throw new Error(`no structured_outputs support: ${unstructured.join(", ")}`);
  }

  return `${MODELS.length} models, all live and structured`;
});

const profile = {
  mission: "Make everyday cycling feel safe and ordinary, not extreme.",
  values: ["Practical over heroic", "Quietly durable", "For everyone"],
  tone: ["Plain-spoken", "Warm", "Never hype"],
  audience: "Commuters aged 25-55 in mid-sized cities who are not sports cyclists.",
  dos: ["Show real streets", "Talk about rain and potholes"],
  donts: ["No podium imagery", "No performance stats", "Never call riders athletes"],
  visual: ["Muted daylight", "Bikes at rest, not mid-race"],
};

// The off-brand idea breaks the donts explicitly, so a model that is actually
// reading the rubric has to score it lower than the on-brand one.
const ON_BRAND = "A short film following a nurse's rainy commute across town, shot on real streets at dawn, no music swell.";
const OFF_BRAND = "Sponsor a pro racing team and run podium photography with wattage stats and a hype edit set to trap music.";

const chunks = [
  {
    pineconeId: "doc-1:0",
    documentId: "doc-1",
    documentTitle: "Brand Book",
    content:
      "We never show competitive cycling. Our riders are commuters. Podium imagery and performance statistics are off-limits in every market.",
  },
  {
    pineconeId: "doc-1:1",
    documentId: "doc-1",
    documentTitle: "Brand Book",
    content:
      "Photography is muted daylight on real streets, including bad weather. Bikes appear at rest or in ordinary use.",
  },
];

for (const model of selected) {
  const label = model.id;
  try {
    const started = Date.now();
    const [on, off] = await Promise.all([
      runFitCheck({
        brandName: "Verify Cycles",
        profile,
        idea: ON_BRAND,
        modelId: model.id,
        chunks,
      }),
      runFitCheck({
        brandName: "Verify Cycles",
        profile,
        idea: OFF_BRAND,
        modelId: model.id,
        chunks,
      }),
    ]);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    const problems = [];

    for (const [name, r] of [["on-brand", on], ["off-brand", off]]) {
      if (typeof r.overallScore !== "number") {
        problems.push(`${name}: overallScore was ${typeof r.overallScore}`);
      }
      if (!["strong-fit", "partial-fit", "off-brand"].includes(r.verdict)) {
        problems.push(`${name}: verdict was "${r.verdict}"`);
      }
      if (!Array.isArray(r.pillars) || !r.pillars.length) {
        problems.push(`${name}: no pillars`);
      }
      // A citation naming a chunk we never retrieved must be dropped, not shown.
      const invented = (r.citations ?? []).filter(
        (c) => !chunks.some((chunk) => chunk.pineconeId === c.chunkId),
      );
      if (invented.length) {
        problems.push(`${name}: ${invented.length} citations survived reconciliation`);
      }
    }

    // Not a strict ordering assertion on scores alone: the point is that the
    // rubric is being read, and an idea that breaks three explicit donts must
    // not outscore one that follows them.
    if (on.overallScore <= off.overallScore) {
      problems.push(
        `scored the off-brand idea >= the on-brand one (${on.overallScore} vs ${off.overallScore})`,
      );
    }

    if (problems.length) {
      results.push(`FAIL  ${label} — ${problems.join("; ")}`);
    } else {
      results.push(
        `PASS  ${label} — on ${on.overallScore}/${on.verdict}, off ${off.overallScore}/${off.verdict}, ${on.pillars.length} pillars, ${seconds}s`,
      );
    }
  } catch (error) {
    results.push(`FAIL  ${label} — ${String(error?.message ?? error).slice(0, 300)}`);
  }
}

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
