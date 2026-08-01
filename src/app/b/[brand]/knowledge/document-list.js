"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  deleteDocumentAction,
  retryIngestAction,
  setPinnedOrderAction,
} from "@/lib/actions/documents";

const STATUS_STYLES = {
  pending: "text-zinc-500",
  processing: "text-amber-600 dark:text-amber-400",
  ready: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
};

const SOURCE_LABELS = {
  upload: "File",
  url: "Link",
  note: "Note",
  profile: "Brand profile",
};

export default function DocumentList({ brandSlug, documents, isAdmin }) {
  const router = useRouter();
  const [live, setLive] = useState(documents);

  useEffect(() => setLive(documents), [documents]);

  const settling = live.some(
    (doc) => doc.status === "pending" || doc.status === "processing",
  );

  // Poll only while something is still indexing, then stop.
  useEffect(() => {
    if (!settling) return undefined;

    const timer = setInterval(async () => {
      const response = await fetch(`/api/brands/${brandSlug}/documents`);
      if (!response.ok) return;
      const { documents: rows } = await response.json();
      const byId = new Map(rows.map((row) => [row.id, row]));

      setLive((prev) => {
        const next = prev.map((doc) => ({ ...doc, ...(byId.get(doc.id) ?? {}) }));
        const stillSettling = next.some(
          (doc) => doc.status === "pending" || doc.status === "processing",
        );
        // Pull fresh server data once everything has settled, so chunk counts
        // and the reading path reflect the finished ingest.
        if (!stillSettling) router.refresh();
        return next;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [settling, brandSlug, router]);

  if (!live.length) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-sm leading-6 text-zinc-500 dark:border-zinc-700">
        Nothing here yet. {isAdmin ? "Add a brand book, a note or a link above." : "Ask an admin to add the brand's documents."}
      </p>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
      {live.map((doc) => (
        <DocumentRow
          key={doc.id}
          brandSlug={brandSlug}
          doc={doc}
          isAdmin={isAdmin}
        />
      ))}
    </ul>
  );
}

function DocumentRow({ brandSlug, doc, isAdmin }) {
  const [, deleteAction, deleting] = useActionState(deleteDocumentAction, {});
  const [retryState, retryAction, retrying] = useActionState(
    retryIngestAction,
    {},
  );
  const [pinState, pinAction, pinning] = useActionState(
    setPinnedOrderAction,
    {},
  );

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1">
          <span className="block text-sm text-zinc-950 dark:text-zinc-50">
            {doc.title}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
            <span>{SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}</span>
            <span>·</span>
            <span className={STATUS_STYLES[doc.status]}>{doc.status}</span>
            {doc.pinnedOrder ? (
              <>
                <span>·</span>
                <span>step {doc.pinnedOrder} of the reading path</span>
              </>
            ) : null}
          </span>
        </span>

        {isAdmin ? (
          <>
            <form action={pinAction} className="flex items-center gap-1.5">
              <input type="hidden" name="brandSlug" value={brandSlug} />
              <input type="hidden" name="documentId" value={doc.id} />
              <input
                name="pinnedOrder"
                defaultValue={doc.pinnedOrder ?? ""}
                placeholder="—"
                inputMode="numeric"
                title="Position in the Start here reading path. Blank to unpin."
                className="w-14 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-center text-xs outline-none dark:border-zinc-700"
              />
              <button
                type="submit"
                disabled={pinning}
                className="text-xs text-zinc-600 transition hover:underline disabled:opacity-50 dark:text-zinc-400"
              >
                {pinning ? "…" : "Pin"}
              </button>
            </form>

            {doc.status === "failed" ? (
              <form action={retryAction}>
                <input type="hidden" name="brandSlug" value={brandSlug} />
                <input type="hidden" name="documentId" value={doc.id} />
                <button
                  type="submit"
                  disabled={retrying}
                  className="text-xs text-zinc-600 transition hover:underline disabled:opacity-50 dark:text-zinc-400"
                >
                  {retrying ? "Retrying…" : "Retry"}
                </button>
              </form>
            ) : null}

            <form action={deleteAction}>
              <input type="hidden" name="brandSlug" value={brandSlug} />
              <input type="hidden" name="documentId" value={doc.id} />
              <button
                type="submit"
                disabled={deleting}
                className="text-xs text-red-600 transition hover:underline disabled:opacity-50 dark:text-red-400"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </form>
          </>
        ) : null}
      </div>

      {doc.status === "failed" && doc.error ? (
        <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {doc.error}
        </p>
      ) : null}

      {retryState?.error || pinState?.error ? (
        <p className="mt-2 text-xs text-red-600">
          {retryState?.error ?? pinState?.error}
        </p>
      ) : null}
    </li>
  );
}
