/**
 * Exercises the fit-check pipeline with a mock model — no API key, no network.
 *
 * What this actually proves: that the Output.object() call shape is right for
 * this version of the SDK, that the schema accepts a well-formed verdict and
 * rejects a malformed one, and that a citation pointing at a passage which was
 * never retrieved is dropped rather than rendered.
 *
 * That last one matters most. A fabricated citation is worse than no citation,
 * because the entire value of citing is that a reader can trust it.
 *
 *   npm run verify:fitcheck
 */
import { Output, generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import {
  buildFitCheckPrompt,
  formatContext,
  reconcileCitations,
  renderRubric,
  verdictForScore,
  verdictSchema,
} from "../src/lib/ai/prompt.js";

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${error.message}`);
  }
};

const CHUNKS = [
  {
    pineconeId: "doc-a:0",
    documentId: "doc-a",
    documentTitle: "Brand Book",
    content: "Never place the logo on a photograph.",
  },
  {
    pineconeId: "doc-a:1",
    documentId: "doc-a",
    documentTitle: "Brand Book",
    content: "We speak plainly. No exclamation marks.",
  },
];

const PROFILE = {
  mission: "Make repair normal.",
  values: ["Durability over novelty"],
  tone: ["Dry, never zany"],
  audience: "People who keep things a long time.",
  dos: ["Show real wear"],
  donts: ["Never imply disposability"],
  visual: ["Logo never on photography"],
};

const VERDICT = {
  overallScore: 72,
  verdict: "partial-fit",
  summary: "Fits the repair mission. The launch stunt cuts against the tone.",
  pillars: [
    { pillar: "mission", score: 90, reasoning: "Directly extends repair." },
    { pillar: "tone", score: 40, reasoning: "The stunt is louder than the brand." },
  ],
  risks: ["Reads as disposable"],
  suggestions: ["Drop the confetti moment"],
  citations: [{ chunkId: "doc-a:1", quote: "We speak plainly." }],
};

function mockModel(payload) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      // V4 returns a finish reason object, not a bare string.
      finishReason: { unified: "stop" },
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: "text", text: JSON.stringify(payload) }],
      warnings: [],
    }),
  });
}

await check("renderRubric includes every filled pillar", () => {
  const text = renderRubric(PROFILE, "Fixit");
  for (const needle of [
    "Make repair normal",
    "Durability over novelty",
    "Dry, never zany",
    "Never imply disposability",
    "Logo never on photography",
  ]) {
    if (!text.includes(needle)) throw new Error(`missing "${needle}"`);
  }
  return `${text.split("\n\n").length} sections`;
});

await check("renderRubric says so when there is no profile", () => {
  const text = renderRubric(null, "Fixit");
  if (!text.includes("No brand profile")) throw new Error("no empty-profile notice");
  return "flagged";
});

await check("formatContext tags each chunk with a citable id", () => {
  const text = formatContext(CHUNKS);
  if (!text.includes("(id: doc-a:0)") || !text.includes("(id: doc-a:1)")) {
    throw new Error("chunk ids not exposed to the model");
  }
  if (!text.includes("Brand Book")) throw new Error("document title missing");
  return "ids + titles present";
});

await check("prompt states when nothing was retrieved", () => {
  const text = buildFitCheckPrompt({
    profile: PROFILE,
    brandName: "Fixit",
    chunks: [],
    idea: "A pop-up repair cafe",
  });
  if (!text.includes("Nothing relevant was found")) {
    throw new Error("empty retrieval is not signalled to the model");
  }
  if (!text.includes("A pop-up repair cafe")) throw new Error("idea missing");
  return "signalled";
});

await check("Output.object returns a validated verdict", async () => {
  const { output } = await generateText({
    model: mockModel(VERDICT),
    prompt: "x",
    output: Output.object({ schema: verdictSchema }),
  });
  if (output.overallScore !== 72) throw new Error(`score was ${output.overallScore}`);
  if (output.verdict !== "partial-fit") throw new Error("verdict lost");
  if (output.pillars.length !== 2) throw new Error("pillars lost");
  return "shape correct";
});

await check("schema rejects an out-of-range score", async () => {
  try {
    await generateText({
      model: mockModel({ ...VERDICT, overallScore: 5000 }),
      prompt: "x",
      output: Output.object({ schema: verdictSchema }),
    });
    throw new Error("expected validation to reject 5000");
  } catch (error) {
    if (error.message.includes("expected validation")) throw error;
    return "rejected";
  }
});

await check("schema rejects an unknown pillar key", async () => {
  try {
    await generateText({
      model: mockModel({
        ...VERDICT,
        pillars: [{ pillar: "vibes", score: 50, reasoning: "n/a" }],
      }),
      prompt: "x",
      output: Output.object({ schema: verdictSchema }),
    });
    throw new Error("expected validation to reject an unknown pillar");
  } catch (error) {
    if (error.message.includes("expected validation")) throw error;
    return "rejected";
  }
});

await check("a fabricated citation is dropped, not rendered", () => {
  const { citations, dropped } = reconcileCitations(
    [
      { chunkId: "doc-a:1", quote: "We speak plainly." },
      { chunkId: "doc-z:99", quote: "Something we never said." },
    ],
    CHUNKS,
  );
  if (citations.length !== 1) throw new Error(`kept ${citations.length} citations`);
  if (dropped !== 1) throw new Error(`reported ${dropped} dropped`);
  if (citations[0].documentTitle !== "Brand Book") throw new Error("title not hydrated");
  if (citations.some((c) => c.chunkId === "doc-z:99")) {
    throw new Error("FABRICATED CITATION SURVIVED");
  }
  return "1 kept, 1 dropped";
});

await check("citations hydrate real passage text, not the model's quote alone", () => {
  const { citations } = reconcileCitations(
    [{ chunkId: "doc-a:0", quote: "misquoted by the model" }],
    CHUNKS,
  );
  if (citations[0].content !== "Never place the logo on a photograph.") {
    throw new Error("source passage not attached");
  }
  return "source text attached";
});

await check("no citations at all is handled", () => {
  const { citations, dropped } = reconcileCitations(undefined, CHUNKS);
  if (citations.length !== 0 || dropped !== 0) throw new Error("undefined not handled");
  return "0 and 0";
});

await check("the verdict label is a function of the score", () => {
  const bands = [
    [100, "strong-fit"], [70, "strong-fit"],
    [69, "partial-fit"], [40, "partial-fit"],
    [39, "off-brand"], [0, "off-brand"],
  ];
  const wrong = bands.filter(([score, want]) => verdictForScore(score) !== want);
  if (wrong.length) {
    throw new Error(wrong.map(([s, w]) => `${s} should be ${w}`).join(", "));
  }
  // The bug this guards: a live model returned score 0 with "strong-fit",
  // which renders as a green badge beside a zero.
  if (verdictForScore(0) === "strong-fit") throw new Error("0 is not a strong fit");
  return "6 boundaries";
});

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
