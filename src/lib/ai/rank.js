/**
 * Pure — no server-only, no aliases — so it can be exercised directly.
 *
 * Joins Pinecone matches to the Postgres rows that hold the actual text. The
 * vector store returns ids and scores; the text always comes from the database,
 * so a citation renders what the document really says.
 */
export function rankChunksByMatch(matches, chunks) {
  const scoreById = new Map(matches.map((match) => [match.id, match.score]));

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreById.get(chunk.pineconeId) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}
