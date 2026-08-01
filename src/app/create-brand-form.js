"use client";

import { useActionState } from "react";

import { createBrandAction } from "@/lib/actions/brands";

export default function CreateBrandForm() {
  const [state, formAction, pending] = useActionState(createBrandAction, {});

  return (
    <form action={formAction} className="mt-4 flex flex-wrap gap-2">
      <input
        name="name"
        required
        minLength={2}
        maxLength={80}
        placeholder="Brand name"
        className="min-w-56 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
      >
        {pending ? "Creating…" : "Create brand"}
      </button>
      {state?.error ? (
        <p className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
