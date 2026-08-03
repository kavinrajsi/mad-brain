/**
 * Curated OpenRouter model catalogue.
 *
 * Every entry here was verified against https://openrouter.ai/api/v1/models as
 * supporting `structured_outputs`. The fit checker uses `Output.object()`, which
 * requires that support — a model without it returns unparseable prose, so only
 * models listed here may be offered on the /check screen.
 *
 * Note on Groq: on OpenRouter, Groq is an inference *host*, not a model family.
 * You reach it by pinning provider preferences on an open-weights model (Llama,
 * Qwen, Kimi), not via a `groq/...` id.
 */
export const MODELS = [
  // Anthropic
  {
    id: "anthropic/claude-opus-5",
    label: "Claude Opus 5",
    family: "Anthropic",
    context: 1000000,
    note: "Strongest reasoning — best default for nuanced brand judgement.",
  },
  {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5",
    family: "Anthropic",
    context: 1000000,
    note: "Faster and cheaper than Opus, still strong on nuance.",
  },
  // Id is Anthropic's dated model name, not OpenRouter's "claude-haiku-4.5"
  // alias — chatModel() strips the "anthropic/" prefix and calls the
  // Anthropic API directly when ANTHROPIC_API_KEY is set, and only the dated
  // id is valid there (verified live: "claude-haiku-4.5" 404s on Anthropic's
  // API). If ANTHROPIC_API_KEY is ever removed this id would need to change
  // to route through OpenRouter correctly.
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    label: "Claude Haiku 4.5",
    family: "Anthropic",
    context: 200000,
    note: "Fastest and cheapest Claude — good for high-volume checks.",
  },
  {
    id: "anthropic/claude-fable-5",
    label: "Claude Fable 5",
    family: "Anthropic",
    context: 1000000,
  },
  // OpenAI
  {
    id: "openai/gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    family: "OpenAI",
    context: 1050000,
  },
  {
    id: "openai/gpt-5.5",
    label: "GPT-5.5",
    family: "OpenAI",
    context: 1050000,
  },
  // Google
  {
    id: "google/gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    family: "Google",
    context: 1048576,
    note: "Cheap and fast — good for high-volume checks.",
  },
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    family: "Google",
    context: 1048576,
  },
  // DeepSeek
  {
    id: "deepseek/deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    family: "DeepSeek",
    context: 1048576,
  },
  {
    id: "deepseek/deepseek-v3.2",
    label: "DeepSeek V3.2",
    family: "DeepSeek",
    context: 163840,
  },
  // xAI
  {
    id: "x-ai/grok-4.5",
    label: "Grok 4.5",
    family: "xAI",
    context: 500000,
  },
  // Moonshot / Kimi
  {
    id: "moonshotai/kimi-k3",
    label: "Kimi K3",
    family: "Moonshot",
    context: 1048576,
  },
  // Qwen
  {
    id: "qwen/qwen3.7-max",
    label: "Qwen 3.7 Max",
    family: "Qwen",
    context: 1000000,
  },
  {
    id: "qwen/qwen3.6-flash",
    label: "Qwen 3.6 Flash",
    family: "Qwen",
    context: 1000000,
  },
  // MiniMax
  {
    id: "minimax/minimax-m3",
    label: "MiniMax M3",
    family: "MiniMax",
    context: 1048576,
  },
  // Meta
  {
    id: "meta-llama/llama-4-maverick",
    label: "Llama 4 Maverick",
    family: "Meta",
    context: 1048576,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    family: "Meta",
    context: 131072,
  },
];

export const DEFAULT_MODEL_ID = "anthropic/claude-opus-5";

const MODEL_IDS = new Set(MODELS.map((m) => m.id));

/**
 * Never pass a client-supplied model id straight to the provider — an arbitrary
 * id could route to an expensive model, or one that cannot honour the schema.
 */
export function resolveModelId(requested) {
  return MODEL_IDS.has(requested) ? requested : DEFAULT_MODEL_ID;
}

export function modelsByFamily() {
  const grouped = new Map();
  for (const model of MODELS) {
    if (!grouped.has(model.family)) grouped.set(model.family, []);
    grouped.get(model.family).push(model);
  }
  return [...grouped.entries()].map(([family, models]) => ({
    family,
    models,
  }));
}
