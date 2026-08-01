import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import MarkReadButton from "./mark-read-button";
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
        href={`/b/${slug}/knowledge`}
        className="font-mono text-xs text-zinc-400 transition hover:text-zinc-600"
      >
        ← Knowledge
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {doc.title}
          </h1>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            {doc.sourceType} · {doc.status} · {chunks.length} chunks
          </p>
        </div>
        <MarkReadButton
          brandSlug={slug}
          documentId={doc.id}
          alreadyRead={Boolean(read)}
        />
      </div>

      {doc.sourceUrl ? (
        <a
          href={doc.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-block break-all font-mono text-xs text-zinc-500 underline"
        >
          {doc.sourceUrl}
        </a>
      ) : null}

      {doc.status !== "ready" ? (
        <p className="mt-8 rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700">
          {doc.status === "failed"
            ? (doc.error ?? "This document could not be indexed.")
            : "Still indexing — refresh in a moment."}
        </p>
      ) : (
        <article className="mt-8 space-y-6">
          {chunks.map((chunk) => (
            <p
              key={chunk.ordinal}
              className="whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300"
            >
              {chunk.content}
            </p>
          ))}
        </article>
      )}
    </main>
  );
}
