import "server-only";

import { Output, generateText } from "ai";

import {
  FIT_CHECK_SYSTEM,
  buildFitCheckPrompt,
  reconcileCitations,
  verdictSchema,
} from "./prompt";
import { retrieveBrandContext } from "./retrieve";
import { openrouterModel } from "./providers";

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
  });

  const { citations, dropped } = reconcileCitations(output.citations, chunks);

  return {
    ...output,
    citations,
    droppedCitations: dropped,
    retrieved: chunks.length,
  };
}
