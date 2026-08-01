import "server-only";

import { RETRIEVAL } from "./config";
import { embedQuery } from "./embed";
import { queryBrandVectors } from "./pinecone";
import { rankChunksByMatch } from "./rank";
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

  const chunks = await getChunksByPineconeIds({
    brandId,
    pineconeIds: matches.map((m) => m.id),
  });

  return rankChunksByMatch(matches, chunks);
}
