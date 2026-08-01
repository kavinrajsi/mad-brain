import "server-only";

import { embed, embedMany } from "ai";

import { embeddingModel } from "./providers";

/** OpenAI accepts large batches, but smaller ones fail more cheaply. */
const BATCH_SIZE = 96;

export async function embedQuery(text) {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: text,
  });
  return embedding;
}

export async function embedChunks(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      values: texts.slice(i, i + BATCH_SIZE),
    });
    out.push(...embeddings);
  }
  return out;
}
