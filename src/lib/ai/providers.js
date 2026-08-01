import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import { EMBEDDING } from "./config.js";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env.local and to the Vercel project env.`,
    );
  }
  return value;
}

/** Chat + scoring. One key fronts every model family in the catalogue. */
export function openrouterModel(modelId) {
  const openrouter = createOpenRouter({
    apiKey: required("OPENROUTER_API_KEY"),
  });
  return openrouter.chat(modelId);
}

/** Embeddings only — OpenRouter has no embeddings endpoint. */
export function embeddingModel() {
  const openai = createOpenAI({ apiKey: required("OPENAI_API_KEY") });
  return openai.textEmbeddingModel(EMBEDDING.model);
}
