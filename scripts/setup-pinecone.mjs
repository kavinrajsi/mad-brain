#!/usr/bin/env node
/**
 * Creates the Pinecone index at the dimension the pinned embedding model
 * produces. Safe to re-run: it exits early if the index already exists, and
 * refuses to continue if an existing index has the wrong dimension.
 */
import { config } from "dotenv";
import { Pinecone } from "@pinecone-database/pinecone";

config({ path: ".env.local" });

// Kept in sync with src/lib/ai/config.js — text-embedding-3-small.
const NAME = process.env.PINECONE_INDEX ?? "madbrain-brands";
const DIMENSION = 1536;
const METRIC = "cosine";

if (!process.env.PINECONE_API_KEY) {
  console.error("PINECONE_API_KEY is not set. Add it to .env.local first.");
  process.exit(1);
}

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const { indexes = [] } = await pc.listIndexes();
const existing = indexes.find((index) => index.name === NAME);

if (existing) {
  if (existing.dimension !== DIMENSION) {
    console.error(
      `Index "${NAME}" has dimension ${existing.dimension}, but the embedding ` +
        `model produces ${DIMENSION}. Use a different PINECONE_INDEX name — an ` +
        `index dimension cannot be changed after creation.`,
    );
    process.exit(1);
  }
  console.log(`Index "${NAME}" already exists (${DIMENSION}d, ${METRIC}).`);
  process.exit(0);
}

console.log(`Creating index "${NAME}" (${DIMENSION}d, ${METRIC})…`);

await pc.createIndex({
  name: NAME,
  dimension: DIMENSION,
  metric: METRIC,
  spec: { serverless: { cloud: "aws", region: "us-east-1" } },
  waitUntilReady: true,
});

console.log("Ready.");
