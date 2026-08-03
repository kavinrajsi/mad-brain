"use client";

import { useActionState, useState } from "react";

import { deleteBrandAction } from "@/lib/actions/brands";

/**
 * Deleting is irreversible and the vectors cannot be rebuilt without
 * re-ingesting every source, so the control is deliberately awkward: it starts
 * collapsed, and the button stays disabled until the slug is typed exactly.
 * The server checks the same thing — this is only there to stop an accident.
 */
export default function DeleteBrand({ brandSlug, brandName, counts }) {
  const [state, formAction, pending] = useActionState(deleteBrandAction, {});
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const armed = typed.trim() === brandSlug;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        Delete this brand
      </button>
    );
  }

  return (
    <form action={formAction} className="max-w-lg">
      <input type="hidden" name="brandSlug" value={brandSlug} />

      <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        Deleting <span className="font-medium">{brandName}</span> removes{" "}
        {counts.documents} document{counts.documents === 1 ? "" : "s"},{" "}
        {counts.chunks} indexed passage{counts.chunks === 1 ? "" : "s"},{" "}
        {counts.members} member{counts.members === 1 ? "" : "s"} and{" "}
        {counts.checks} past idea check{counts.checks === 1 ? "" : "s"}.
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        This cannot be undone. Rebuilding it means uploading every document
        again.
      </p>

      <label
        htmlFor="confirm-slug"
        className="mt-4 block text-xs text-zinc-500 dark:text-zinc-400"
      >
        Type <code className="font-mono text-zinc-950 dark:text-zinc-50">{brandSlug}</code> to confirm
      </label>
      <input
        id="confirm-slug"
        name="confirm"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-red-500 dark:border-zinc-700"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={!armed || pending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>

      {state?.error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
