import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { embedChunks } from "@/lib/ai/embed";
import { deleteBrandVectors, upsertBrandVectors } from "@/lib/ai/pinecone";
import { db } from "@/lib/db/client";
import { documentChunks, documents } from "@/lib/db/schema";
import { chunkText } from "./chunk";
import { extractText, htmlToText } from "./parse";

const MAX_FETCH_BYTES = 25 * 1024 * 1024;

/**
 * Ingests one document: source text in, retrievable chunks out.
 *
 * Written as discrete, individually retryable steps so it can be lifted into a
 * durable workflow later without restructuring, should large brand books start
 * exceeding the function timeout.
 *
 * Re-ingesting an existing document deletes its old chunks and vectors first,
 * so a retry cannot leave two generations of the same content in the index.
 */
export async function ingestDocument(documentId) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) throw new Error(`Document ${documentId} not found`);

  await db
    .update(documents)
    .set({ status: "processing", error: null, updatedAt: new Date() })
    .where(eq(documents.id, documentId));

  try {
    const text = await loadText(doc);
    if (!text) throw new Error("No readable text found in this source.");

    await clearExistingChunks(doc);

    const pieces = chunkText(text);
    if (!pieces.length) throw new Error("Document produced no chunks.");

    const embeddings = await embedChunks(pieces);

    const rows = pieces.map((content, ordinal) => ({
      id: randomUUID(),
      documentId: doc.id,
      brandId: doc.brandId,
      ordinal,
      content,
      tokenCount: Math.round(content.length / 4),
      pineconeId: `${doc.id}:${ordinal}`,
    }));

    await db.insert(documentChunks).values(rows);

    await upsertBrandVectors({
      brandId: doc.brandId,
      records: rows.map((row, i) => ({
        id: row.pineconeId,
        values: embeddings[i],
        // Metadata stays minimal — the text is read back from Postgres, which
        // keeps citations honest and the index small.
        metadata: {
          documentId: doc.id,
          chunkId: row.id,
          ordinal: row.ordinal,
        },
      })),
    });

    await db
      .update(documents)
      .set({
        // Persist the extracted text so the reader can show the document as it
        // actually reads. Chunks overlap on purpose, so rendering them in
        // sequence repeats a passage at every boundary.
        body: text,
        status: "ready",
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id));

    return { chunks: rows.length };
  } catch (error) {
    await db
      .update(documents)
      .set({
        status: "failed",
        error: String(error?.message ?? error).slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));
    throw error;
  }
}

async function clearExistingChunks(doc) {
  const existing = await db
    .select({ pineconeId: documentChunks.pineconeId })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, doc.id));

  if (existing.length) {
    await deleteBrandVectors({
      brandId: doc.brandId,
      ids: existing.map((row) => row.pineconeId),
    });
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, doc.id));
  }
}

async function loadText(doc) {
  // Notes and the brand profile are already text — they skip parsing entirely.
  if (doc.sourceType === "note" || doc.sourceType === "profile") {
    return doc.body ?? "";
  }

  if (doc.sourceType === "url") {
    const response = await fetch(doc.sourceUrl, {
      headers: { "User-Agent": "MadbrainBot/1.0" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Could not fetch ${doc.sourceUrl} (${response.status})`);
    }
    const html = await response.text();
    return htmlToText(html);
  }

  if (!doc.blobUrl) throw new Error("Document has no file attached.");

  const { get, head } = await import("@vercel/blob");

  const meta = await head(doc.blobUrl);
  if (meta.size > MAX_FETCH_BYTES) {
    throw new Error(
      `File is ${(meta.size / 1024 / 1024).toFixed(1)}MB — larger than the ${MAX_FETCH_BYTES / 1024 / 1024}MB ingest limit.`,
    );
  }

  // Private blobs are not fetchable by URL alone — get() authenticates with the
  // store token.
  const result = await get(doc.blobUrl, { access: "private" });
  if (!result?.stream) {
    throw new Error("Could not download the uploaded file.");
  }

  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  const { text } = await extractText({
    buffer,
    mime: doc.mime,
    filename: doc.title,
  });
  return text;
}
