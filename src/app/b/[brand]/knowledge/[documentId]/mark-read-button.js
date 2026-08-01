"use client";

import { useActionState } from "react";

import { markReadAction } from "@/lib/actions/documents";

export default function MarkReadButton({ brandSlug, documentId, alreadyRead }) {
  const [state, formAction, pending] = useActionState(markReadAction, {});

  if (alreadyRead || state?.ok) {
    return (
      <span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-400">
        Read
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="brandSlug" value={brandSlug} />
      <input type="hidden" name="documentId" value={documentId} />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        {pending ? "Saving…" : "Mark as read"}
      </button>
    </form>
  );
}
