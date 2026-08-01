import "server-only";

import { Pinecone } from "@pinecone-database/pinecone";

import { EMBEDDING, PINECONE_INDEX, brandNamespace } from "./config";

let client;

function pinecone() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set.");
  }
  client ??= new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  return client;
}

export function brandIndex() {
  return pinecone().index(PINECONE_INDEX);
}

/**
 * Creates the index if it is missing.
 *
 * Dimension comes from EMBEDDING so the index can never be created at a size
 * the embedding model does not produce — a mismatch is unrecoverable without
 * re-embedding every document into a new index.
 */
export async function ensureIndex() {
  const pc = pinecone();
  const { indexes = [] } = await pc.listIndexes();

  const existing = indexes.find((i) => i.name === PINECONE_INDEX);
  if (existing) {
    if (existing.dimension !== EMBEDDING.dimension) {
      throw new Error(
        `Pinecone index "${PINECONE_INDEX}" has dimension ${existing.dimension} but ` +
          `${EMBEDDING.model} produces ${EMBEDDING.dimension}. Create a new index instead of reusing this one.`,
      );
    }
    return { created: false };
  }

  await pc.createIndex({
    name: PINECONE_INDEX,
    dimension: EMBEDDING.dimension,
    metric: EMBEDDING.metric,
    spec: { serverless: { cloud: "aws", region: "us-east-1" } },
    waitUntilReady: true,
  });

  return { created: true };
}

export async function upsertBrandVectors({ brandId, records }) {
  if (!records.length) return;
  await brandIndex().upsert({
    records,
    namespace: brandNamespace(brandId),
  });
}

export async function queryBrandVectors({ brandId, vector, topK }) {
  const result = await brandIndex().query({
    vector,
    topK,
    namespace: brandNamespace(brandId),
    includeMetadata: true,
  });
  return result.matches ?? [];
}

/** Used when a document is deleted or re-ingested. */
export async function deleteBrandVectors({ brandId, ids }) {
  if (!ids.length) return;
  await brandIndex().namespace(brandNamespace(brandId)).deleteMany(ids);
}
