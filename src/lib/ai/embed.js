import "server-only";

import { embed, embedMany } from "ai";

// Explicit extension so plain node can load this module too, not only the
// Next bundler.
import { embeddingModel } from "./providers.js";

/** OpenAI accepts large batches, but smaller ones fail more cheaply. */
export const BATCH_SIZE = 96;

export async function embedQuery(text, { model } = {}) {
  const { embedding } = await embed({
    model: model ?? embeddingModel(),
    value: text,
  });
  return embedding;
}

/**
 * Embeds many texts, batching to keep individual requests small.
 *
 * Order is load-bearing: the caller zips the returned vectors against its chunk
 * rows by index, so a reordering here would attach every vector to the wrong
 * passage — retrieval would still "work" while returning nonsense, with nothing
 * failing loudly. Batches are therefore awaited in sequence and appended in
 * order, never raced.
 */
export async function embedChunks(texts, { model } = {}) {
  const resolved = model ?? embeddingModel();
  const out = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const { embeddings } = await embedMany({
      model: resolved,
      values: texts.slice(i, i + BATCH_SIZE),
    });
    out.push(...embeddings);
  }

  if (out.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: ${texts.length} texts produced ${out.length} vectors.`,
    );
  }

  return out;
}
