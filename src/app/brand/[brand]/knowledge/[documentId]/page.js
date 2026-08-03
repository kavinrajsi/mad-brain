import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import DocumentDetail from "./document-detail";
import { requireBrandRole } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { documentChunks, documentReads, documents } from "@/lib/db/schema";

export const metadata = {
  title: "Document · Madbrain",
};

export default async function DocumentPage({ params }) {
  const { brand: slug, documentId } = await params;
  const access = await requireBrandRole(slug);

  // Scoped by brandId: a document id belonging to another brand resolves to
  // nothing rather than rendering.
  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.brandId, access.brandId)),
    )
    .limit(1);

  if (!doc) notFound();

  const isAdmin = access.role === "admin" || access.role === "owner";

  const [chunks, [read]] = await Promise.all([
    db
      .select({ content: documentChunks.content, ordinal: documentChunks.ordinal })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, doc.id))
      .orderBy(asc(documentChunks.ordinal)),
    db
      .select({ readAt: documentReads.readAt })
      .from(documentReads)
      .where(
        and(
          eq(documentReads.documentId, doc.id),
          eq(documentReads.userId, access.userId),
        ),
      )
      .limit(1),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <Link
        href={`/brand/${slug}/knowledge`}
        className="font-mono text-xs text-zinc-400 transition hover:text-zinc-600"
      >
        ← Knowledge
      </Link>

      <DocumentDetail
        // Remounts on save: revalidatePath brings a fresh updatedAt, which
        // resets local edit state back to the read view without an effect.
        key={String(doc.updatedAt)}
        brandSlug={slug}
        doc={doc}
        chunksCount={chunks.length}
        alreadyRead={Boolean(read)}
        isAdmin={isAdmin}
        bodyFallback={chunks.map((chunk) => chunk.content).join("\n\n")}
      />
    </main>
  );
}
