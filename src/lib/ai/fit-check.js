import "server-only";

import { Output, generateText } from "ai";

import {
  FIT_CHECK_SYSTEM,
  buildFitCheckPrompt,
  reconcileCitations,
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

  const { output } = await generateText({
    model: model ?? openrouterModel(modelId),
    system: FIT_CHECK_SYSTEM,
    prompt: buildFitCheckPrompt({ profile, brandName, chunks, idea }),
    output: Output.object({ schema: verdictSchema }),
    // Without a cap the provider reserves the model's full output window —
    // OpenRouter quoted 65536 tokens and refused the call on a low balance,
    // for a verdict that runs to a couple of thousand. Generous enough that a
    // reasoning model still has room to think.
    maxOutputTokens: 16000,
  });

  const { citations, dropped } = reconcileCitations(output.citations, chunks);

  return {
    ...output,
    citations,
    droppedCitations: dropped,
    retrieved: chunks.length,
  };
}
