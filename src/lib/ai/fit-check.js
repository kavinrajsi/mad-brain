import "server-only";

import { Output, generateText } from "ai";

import {
  FIT_CHECK_SYSTEM,
  buildFitCheckPrompt,
  reconcileCitations,
  verdictForScore,
  verdictSchema,
} from "./prompt.js";
import { retrieveBrandContext } from "./retrieve.js";
import { openrouterModel } from "./providers.js";

export async function runFitCheck({
  brandId,
  brandName,
  profile,
  idea,
  modelId,
  // Injectable so the pipeline can be exercised with a mock model. Production
  // callers never pass these.
  model,
  chunks: providedChunks,
}) {
  const chunks =
    providedChunks ?? (await retrieveBrandContext({ brandId, query: idea }));

  const prompt = buildFitCheckPrompt({ profile, brandName, chunks, idea });

  const call = () =>
    generateText({
      model: model ?? openrouterModel(modelId),
      system: FIT_CHECK_SYSTEM,
      prompt,
      output: Output.object({ schema: verdictSchema }),
      // Without a cap the provider reserves the model's full output window —
      // OpenRouter quoted 65536 tokens and refused the call on a low balance,
      // for a verdict that runs to a couple of thousand. Generous enough that a
      // reasoning model still has room to think.
      maxOutputTokens: 16000,
    });

  // The SDK's own retries cover transport failures, not a response that parses
  // to nothing — which is a distinct and observed outcome: an identical prompt
  // threw "No output generated." on one run and returned a full verdict on the
  // next. Retrying once turns a visible error into a slower answer.
  let output;
  try {
    ({ output } = await call());
  } catch (error) {
    if (!/No output generated/i.test(String(error?.message ?? error))) throw error;
    ({ output } = await call());
  }

  const { citations, dropped } = reconcileCitations(output.citations, chunks);

  return {
    ...output,
    // Derived, not taken from the model — see verdictForScore.
    verdict: verdictForScore(output.overallScore),
    citations,
    droppedCitations: dropped,
    retrieved: chunks.length,
  };
}
