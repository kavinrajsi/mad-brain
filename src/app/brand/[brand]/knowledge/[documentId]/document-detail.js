"use client";

import { useActionState, useState } from "react";

import MarkReadButton from "./mark-read-button";
import { updateDocumentAction } from "@/lib/actions/documents";
import RichTextField, { RICH_TEXT_VIEW_CLASSES } from "@/components/rich-text-field";

export default function DocumentDetail({
  brandSlug,
  doc,
  chunksCount,
  alreadyRead,
  isAdmin,
  bodyFallback,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateDocumentAction, {});

  const canEditBody = doc.sourceType === "note";
  const showEdit = isAdmin && doc.sourceType !== "profile";

  if (isEditing) {
    return (
      <div className="mt-4">
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="brandSlug" value={brandSlug} />
          <input type="hidden" name="documentId" value={doc.id} />

          <input
            name="title"
            defaultValue={doc.title}
            required
            maxLength={200}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-lg font-semibold outline-none focus:border-zinc-500 dark:border-zinc-700"
          />

          {canEditBody ? (
            <RichTextField
              name="body"
              htmlName="bodyHtml"
              preset="notes"
              defaultValue={doc.body ?? ""}
              defaultHtml={doc.bodyHtml ?? null}
              minHeightClass="min-h-96"
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Body is generated from the source {doc.sourceType === "upload" ? "file" : "link"} —
              edit that and use Retry on the Knowledge page instead of editing here.
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-sm text-zinc-500 hover:underline"
            >
              Cancel
            </button>
          </div>

          {state?.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          ) : null}
          {state?.warning ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">{state.warning}</p>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {doc.title}
          </h1>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            {doc.sourceType} · {doc.status} · {chunksCount} chunks
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showEdit ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Edit
            </button>
          ) : null}
          <MarkReadButton
            brandSlug={brandSlug}
            documentId={doc.id}
            alreadyRead={alreadyRead}
          />
        </div>
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
        <article className="mt-8">
          {/*
            Render the extracted source text, not the chunks. Chunks overlap by
            design so no passage falls into a retrieval gap — printing them in
            sequence would repeat a paragraph at every boundary.
          */}
          {doc.bodyHtml ? (
            <div
              className={RICH_TEXT_VIEW_CLASSES}
              dangerouslySetInnerHTML={{ __html: doc.bodyHtml }}
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700 dark:text-zinc-300">
              {doc.body ?? bodyFallback}
            </p>
          )}
        </article>
      )}
    </>
  );
}
