import "server-only";

import { Output, generateText } from "ai";
import { z } from "zod";

import { PILLARS } from "@/lib/brand-profile";
import { formatContext, retrieveBrandContext } from "./retrieve";
import { openrouterModel } from "./providers";

const PILLAR_KEYS = PILLARS.map((p) => p.key);

const verdictSchema = z.object({
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0 = actively off-brand, 100 = could have come from the brand"),
  verdict: z.enum(["strong-fit", "partial-fit", "off-brand"]),
  summary: z.string().describe("Two sentences, plain language, no hedging."),
  pillars: z.array(
    z.object({
      pillar: z.enum(PILLAR_KEYS),
      score: z.number().min(0).max(100),
      reasoning: z
        .string()
        .describe("One or two sentences citing the rubric, not generic praise."),
    }),
  ),
  risks: z
    .array(z.string())
    .describe("Concrete ways this would land badly for THIS brand. May be empty."),
  suggestions: z
    .array(z.string())
    .describe("Specific edits that would move it on-brand. May be empty."),
  citations: z.array(
    z.object({
      chunkId: z.string().describe("The exact id shown in the context block"),
      quote: z.string().describe("A short verbatim quote from that passage"),
    }),
  ),
});

function renderRubric(profile, brandName) {
  if (!profile) return "(No brand profile has been filled in.)";

  const list = (label, value) =>
    Array.isArray(value) && value.length
      ? `${label}:\n${value.map((v) => `  - ${v}`).join("\n")}`
      : null;

  return [
    `Brand: ${brandName}`,
    profile.mission ? `Mission: ${profile.mission}` : null,
    list("Values", profile.values),
    list("Tone of voice", profile.tone),
    profile.audience ? `Audience: ${profile.audience}` : null,
    list("Always do", profile.dos),
    list("Never do", profile.donts),
    list("Visual rules", profile.visual),
  ]
    .filter(Boolean)
    .join("\n\n");
}

const SYSTEM = `You judge whether a proposed idea fits a specific brand.

You are given two things: a BRAND RUBRIC (the brand's own stated pillars) and
CONTEXT passages retrieved from that brand's documents.

Rules:
- Score against the RUBRIC. The context is evidence, not the standard.
- Be specific to this brand. If your reasoning would read the same for any
  brand, it is not useful — say what about THIS brand makes the idea fit or not.
- Do not hedge. A middling score needs a reason, not a shrug.
- Cite only passages present in the context, using their exact id. If nothing in
  the context is relevant, return an empty citations array rather than inventing
  one.
- Score every pillar in the rubric, even if the evidence is thin — say so in the
  reasoning when it is.`;

export async function runFitCheck({ brandId, brandName, profile, idea, modelId }) {
  const chunks = await retrieveBrandContext({ brandId, query: idea });

  const prompt = [
    "BRAND RUBRIC",
    renderRubric(profile, brandName),
    "",
    "CONTEXT FROM THIS BRAND'S DOCUMENTS",
    chunks.length
      ? formatContext(chunks)
      : "(Nothing relevant was found in this brand's documents.)",
    "",
    "IDEA TO JUDGE",
    idea,
  ].join("\n");

  const { output } = await generateText({
    model: openrouterModel(modelId),
    system: SYSTEM,
    prompt,
    output: Output.object({ schema: verdictSchema }),
  });

  // A model may cite an id that is not in the context. Drop those rather than
  // render a citation that resolves to nothing — a fabricated source is worse
  // than a missing one.
  const byId = new Map(chunks.map((c) => [c.pineconeId, c]));
  const citations = (output.citations ?? [])
    .filter((c) => byId.has(c.chunkId))
    .map((c) => {
      const chunk = byId.get(c.chunkId);
      return {
        chunkId: c.chunkId,
        quote: c.quote,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        content: chunk.content,
      };
    });

  return {
    ...output,
    citations,
    droppedCitations: (output.citations ?? []).length - citations.length,
    retrieved: chunks.length,
  };
}
