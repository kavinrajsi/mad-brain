import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
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
  // usage.include surfaces providerMetadata.openrouter.usage.cost (USD),
  // computed by OpenRouter itself — the only real $ source in this app.
  return openrouter.chat(modelId, { usage: { include: true } });
}

const ANTHROPIC_PREFIX = "anthropic/";

/**
 * Resolves a catalogue id to a provider.
 *
 * Anthropic models go direct when ANTHROPIC_API_KEY is set: it bills the
 * Anthropic account rather than the OpenRouter balance, and removes a hop. The
 * catalogue keeps OpenRouter's `anthropic/claude-opus-5` naming either way, so
 * a missing key silently falls back rather than breaking the model picker.
 *
 * Every other family stays on OpenRouter, which is the point of routing through
 * it — one key for nine providers.
 */
export function chatModel(modelId) {
  if (modelId.startsWith(ANTHROPIC_PREFIX) && process.env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    return anthropic(modelId.slice(ANTHROPIC_PREFIX.length));
  }
  return openrouterModel(modelId);
}

/** Embeddings only — OpenRouter has no embeddings endpoint. */
export function embeddingModel() {
  const openai = createOpenAI({ apiKey: required("OPENAI_API_KEY") });
  return openai.textEmbeddingModel(EMBEDDING.model);
}
