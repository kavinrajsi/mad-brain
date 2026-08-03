import { z } from "zod";

// Relative imports only, and no server-only side effects: this module is pure
// so it can be exercised outside the Next bundler, with a mock model.
import { PILLARS, PRISM_FACETS } from "../brand-profile.js";

const PILLAR_KEYS = PILLARS.map((p) => p.key);

export const verdictSchema = z.object({
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

export const FIT_CHECK_SYSTEM = `You judge whether a proposed idea fits a specific brand.

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
  reasoning when it is.
- The overall score bands are: 70-100 strong fit, 40-69 partial fit, 0-39
  off-brand. Make the score and the reasoning agree.`;

/**
 * The verdict label is derived from the score rather than taken from the model.
 *
 * Asked for both, models will contradict themselves: a live run returned
 * overallScore 0 alongside verdict "strong-fit", which renders as a green
 * badge beside a zero. The label is a pure function of the score, so it is
 * computed as one.
 */
export function verdictForScore(score) {
  if (score >= 70) return "strong-fit";
  if (score >= 40) return "partial-fit";
  return "off-brand";
}

export const CHAT_SYSTEM = `You answer questions about one brand, for someone who is new to it.

Ground every answer in the CONTEXT passages provided. If the context does not
cover the question, say so plainly and suggest what document would need to be
added — do not fill the gap from general knowledge about the category.

Refer to the brand's documents by title when you use them. Keep answers short
and concrete.

When a sentence draws on a CONTEXT passage, cite it inline immediately after
that sentence using the passage's bracket number from CONTEXT, e.g. "...as
stated in the brand guide [1]." Only use numbers that appear in CONTEXT. Do
not invent numbers, and do not bundle citations at the end of the answer —
place each one next to the specific claim it supports.`;

/** Formats retrieved chunks for a prompt, tagged so the model can cite them. */
export function formatContext(chunks) {
  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] (id: ${chunk.pineconeId}) from "${chunk.documentTitle}"\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}

export function renderRubric(profile, brandName) {
  if (!profile) return `Brand: ${brandName}\n\n(No brand profile has been filled in.)`;

  const list = (label, value) =>
    Array.isArray(value) && value.length
      ? `${label}:\n${value.map((v) => `  - ${v}`).join("\n")}`
      : null;

  const prismLines = PRISM_FACETS.map((facet) => {
    const text = profile.prism?.[facet.key]?.trim();
    return text ? `  - ${facet.label}: ${text}` : null;
  }).filter(Boolean);

  return [
    `Brand: ${brandName}`,
    profile.mission ? `Mission: ${profile.mission}` : null,
    list("Values", profile.values),
    list("Tone of voice", profile.tone),
    profile.audience ? `Audience: ${profile.audience}` : null,
    list("Always do", profile.dos),
    list("Never do", profile.donts),
    list("Visual rules", profile.visual),
    prismLines.length ? `Brand prism:\n${prismLines.join("\n")}` : null,
    list("Rule book", profile.rules),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildFitCheckPrompt({ profile, brandName, chunks, idea }) {
  return [
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
}

/**
 * Keeps only citations that point at a passage actually in the context.
 *
 * A model can cite an id it invented. Rendering that would show the user a
 * quote attributed to a document that never said it — worse than showing no
 * citation at all, because the whole point of citing is that it can be trusted.
 */
export function reconcileCitations(rawCitations, chunks) {
  const byId = new Map(chunks.map((chunk) => [chunk.pineconeId, chunk]));

  const citations = (rawCitations ?? [])
    .filter((citation) => byId.has(citation.chunkId))
    .map((citation) => {
      const chunk = byId.get(citation.chunkId);
      return {
        chunkId: citation.chunkId,
        quote: citation.quote,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        content: chunk.content,
      };
    });

  return {
    citations,
    dropped: (rawCitations ?? []).length - citations.length,
  };
}
