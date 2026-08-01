"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { deleteBrandVectors } from "@/lib/ai/pinecone";
import { getBrandAccess } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { markDocumentRead } from "@/lib/db/queries";
import { documentChunks, documents } from "@/lib/db/schema";
import { ingestDocument } from "@/lib/ingest/pipeline";

async function ownedDocument(slug, documentId, minRole = "admin") {
  const access = await getBrandAccess(slug, minRole);
  if (!access) return { error: "You do not have permission to do that." };

  const [doc] = await db
    .select()
    .from(documents)
    // Scoped by brandId, so a document id from another brand resolves to
    // nothing rather than being acted on.
    .where(
      and(eq(documents.id, documentId), eq(documents.brandId, access.brandId)),
    )
    .limit(1);

  if (!doc) return { error: "Document not found." };
  return { access, doc };
}

export async function deleteDocumentAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const { error, access, doc } = await ownedDocument(
    slug,
    String(formData.get("documentId") ?? ""),
  );
  if (error) return { error };

  const chunks = await db
    .select({ pineconeId: documentChunks.pineconeId })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, doc.id));

  if (chunks.length) {
    await deleteBrandVectors({
      brandId: access.brandId,
      ids: chunks.map((c) => c.pineconeId),
    });
  }

  // Chunks cascade with the document row.
  await db.delete(documents).where(eq(documents.id, doc.id));

  revalidatePath(`/b/${slug}/knowledge`);
  return { ok: true };
}

export async function retryIngestAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const { error, doc } = await ownedDocument(
    slug,
    String(formData.get("documentId") ?? ""),
  );
  if (error) return { error };

  try {
    await ingestDocument(doc.id);
  } catch (err) {
    return { error: String(err?.message ?? err) };
  }

  revalidatePath(`/b/${slug}/knowledge`);
  return { ok: true };
}

const pinSchema = z.coerce.number().int().min(1).max(999).nullable();

export async function setPinnedOrderAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const { error, doc } = await ownedDocument(
    slug,
    String(formData.get("documentId") ?? ""),
  );
  if (error) return { error };

  const raw = String(formData.get("pinnedOrder") ?? "").trim();
  const parsed = pinSchema.safeParse(raw === "" ? null : raw);
  if (!parsed.success) {
    return { error: "Order must be a number between 1 and 999, or blank." };
  }

  await db
    .update(documents)
    .set({ pinnedOrder: parsed.data, updatedAt: new Date() })
    .where(eq(documents.id, doc.id));

  revalidatePath(`/b/${slug}`);
  revalidatePath(`/b/${slug}/knowledge`);
  return { ok: true };
}

export async function markReadAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const { error, access, doc } = await ownedDocument(
    slug,
    String(formData.get("documentId") ?? ""),
    "member",
  );
  if (error) return { error };

  await markDocumentRead({ userId: access.userId, documentId: doc.id });

  revalidatePath(`/b/${slug}`);
  return { ok: true };
}
