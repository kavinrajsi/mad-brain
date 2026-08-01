import "server-only";

import { RETRIEVAL } from "./config";
import { embedQuery } from "./embed";
import { queryBrandVectors } from "./pinecone";
import { getChunksByPineconeIds } from "@/lib/db/queries";

/**
 * Retrieves the brand's most relevant passages for a query.
 *
 * Two independent guards keep brands apart: the Pinecone query is scoped to the
 * brand's namespace, and the Postgres hydration filters by brand_id again. Either
 * alone would do; both means a bug in one does not leak another brand's content.
 */
export async function retrieveBrandContext({ brandId, query, topK }) {
  const vector = await embedQuery(query);

  const matches = await queryBrandVectors({
    brandId,
    vector,
    topK: topK ?? RETRIEVAL.topK,
  });

  if (!matches.length) return [];

  const scoreById = new Map(matches.map((m) => [m.id, m.score]));
  const chunks = await getChunksByPineconeIds({
    brandId,
    pineconeIds: matches.map((m) => m.id),
  });

  return chunks
    .map((chunk) => ({ ...chunk, score: scoreById.get(chunk.pineconeId) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

/** Formats retrieved chunks for a prompt, tagged so the model can cite them. */
export function formatContext(chunks) {
  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] (id: ${chunk.pineconeId}) from "${chunk.documentTitle}"\n${chunk.content}`,
    )
    .join("\n\n---\n\n");
}
