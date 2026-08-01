/**
 * Exercises embedding batching and retrieval ranking with a mock embedding
 * model — no API key, no network.
 *
 * The property under test is order. embedChunks batches its input, and the
 * caller zips the returned vectors against chunk rows by index. If a batch ever
 * came back out of order, every vector would be attached to the wrong passage:
 * retrieval would keep "working" while returning nonsense, and nothing would
 * fail loudly. That is the failure this guards against.
 *
 *   npm run verify:embed
 */
import { MockEmbeddingModelV4 } from "ai/test";

import { BATCH_SIZE, embedChunks, embedQuery } from "../src/lib/ai/embed.js";
import { rankChunksByMatch } from "../src/lib/ai/rank.js";
import { EMBEDDING } from "../src/lib/ai/config.js";

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${error.message}`);
  }
};

/**
 * Encodes each input's own index into its vector, so a returned vector can be
 * traced back to the exact text it came from.
 */
function tracingModel() {
  return new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: null,
    doEmbed: async ({ values }) => ({
      embeddings: values.map((value) => {
        const vector = new Array(EMBEDDING.dimension).fill(0);
        vector[0] = Number(value.split("-")[1]);
        return vector;
      }),
    }),
  });
}

await check("embedQuery returns a single vector of the pinned dimension", async () => {
  const model = tracingModel();
  const vector = await embedQuery("text-42", { model });
  if (!Array.isArray(vector)) throw new Error("did not return an array");
  if (vector.length !== EMBEDDING.dimension) {
    throw new Error(`dimension ${vector.length}, expected ${EMBEDDING.dimension}`);
  }
  return `${vector.length}d`;
});

await check("embedChunks preserves order across batch boundaries", async () => {
  const model = tracingModel();
  const count = BATCH_SIZE * 2 + 7; // spans three batches, last one partial
  const texts = Array.from({ length: count }, (_, i) => `text-${i}`);

  const vectors = await embedChunks(texts, { model });

  if (vectors.length !== count) {
    throw new Error(`got ${vectors.length} vectors for ${count} texts`);
  }

  const misplaced = [];
  vectors.forEach((vector, index) => {
    if (vector[0] !== index) misplaced.push(index);
  });

  if (misplaced.length) {
    throw new Error(
      `${misplaced.length} vectors attached to the wrong text (first at index ${misplaced[0]})`,
    );
  }

  return `${count} texts across ${model.doEmbedCalls.length} batches, all aligned`;
});

await check("embedChunks batches at the configured size", async () => {
  const model = tracingModel();
  const texts = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => `text-${i}`);
  await embedChunks(texts, { model });

  const sizes = model.doEmbedCalls.map((call) => call.values.length);
  if (sizes.length !== 2) throw new Error(`made ${sizes.length} calls, expected 2`);
  if (sizes[0] !== BATCH_SIZE || sizes[1] !== 1) {
    throw new Error(`batch sizes were ${sizes.join(", ")}`);
  }
  return `${sizes.join(" + ")}`;
});

await check("embedChunks handles an empty list without calling the model", async () => {
  const model = tracingModel();
  const vectors = await embedChunks([], { model });
  if (vectors.length !== 0) throw new Error("returned vectors for no input");
  if (model.doEmbedCalls.length !== 0) throw new Error("called the model anyway");
  return "no calls";
});

await check("embedChunks rejects a short response rather than misaligning", async () => {
  const model = new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: null,
    // Drops one embedding — the caller would otherwise zip vectors against
    // chunks off by one from that point on.
    doEmbed: async ({ values }) =>
      ({ embeddings: values.slice(1).map(() => new Array(EMBEDDING.dimension).fill(0)) }),
  });

  try {
    await embedChunks(["text-0", "text-1"], { model });
    throw new Error("expected a count mismatch to be rejected");
  } catch (error) {
    if (!error.message.includes("mismatch")) throw error;
    return "rejected";
  }
});

await check("ranking sorts by score and attaches the right text", () => {
  const matches = [
    { id: "d:1", score: 0.42 },
    { id: "d:0", score: 0.91 },
    { id: "d:2", score: 0.77 },
  ];
  // Deliberately in a different order from the matches — Postgres does not
  // preserve the vector store's ranking.
  const chunks = [
    { pineconeId: "d:0", content: "best" },
    { pineconeId: "d:1", content: "worst" },
    { pineconeId: "d:2", content: "middle" },
  ];

  const ranked = rankChunksByMatch(matches, chunks);
  const order = ranked.map((c) => c.content).join(",");
  if (order !== "best,middle,worst") throw new Error(`order was ${order}`);
  if (ranked[0].score !== 0.91) throw new Error("score not attached");
  return order;
});

await check("a chunk with no matching score sorts last, not first", () => {
  const ranked = rankChunksByMatch(
    [{ id: "d:0", score: 0.5 }],
    [
      { pineconeId: "orphan", content: "no score" },
      { pineconeId: "d:0", content: "scored" },
    ],
  );
  if (ranked[0].content !== "scored") throw new Error("orphan chunk outranked a real match");
  if (ranked[1].score !== 0) throw new Error("orphan did not default to 0");
  return "orphan last";
});

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
