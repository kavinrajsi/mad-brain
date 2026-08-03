/**
 * Normalizes an AI SDK LanguageModelUsage into the shape persisted on chat
 * messages and idea checks. costUsd is null for Anthropic-direct calls —
 * only OpenRouter reports a real dollar figure (providerMetadata.openrouter),
 * and no per-model price table exists to fabricate one.
 */
export function summarizeUsage(usage, providerMetadata) {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage?.totalTokens ?? inputTokens + outputTokens,
    reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? null,
    costUsd: providerMetadata?.openrouter?.usage?.cost ?? null,
  };
}
