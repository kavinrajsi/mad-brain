/**
 * Embedding model and Pinecone index dimension are a single coupled choice.
 *
 * A Pinecone serverless index has its dimension fixed at creation time. If the
 * embedding model changes, every document must be re-embedded and re-upserted
 * into a NEW index. Both values live here so they cannot drift apart.
 *
 * OpenRouter is chat-completions only — it exposes no embeddings endpoint —
 * so embeddings come from OpenAI directly while chat/scoring goes through
 * OpenRouter.
 */
export const EMBEDDING = {
  model: "text-embedding-3-small",
  dimension: 1536,
  metric: "cosine",
};

/** Chunking parameters for ingestion. */
export const CHUNKING = {
  targetChars: 3200, // ~800 tokens
  overlapChars: 480, // ~15%
  minChars: 200,
};

/** How many chunks to retrieve per fit check / chat turn. */
export const RETRIEVAL = {
  topK: 12,
};

export const PINECONE_INDEX = process.env.PINECONE_INDEX ?? "madbrain-brands";

/**
 * One Pinecone namespace per brand. This is the hard tenant boundary — a query
 * scoped to a namespace physically cannot return another brand's vectors.
 */
export function brandNamespace(brandId) {
  if (!brandId) throw new Error("brandNamespace requires a brandId");
  return `brand-${brandId}`;
}
