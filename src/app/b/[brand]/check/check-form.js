"use client";

import { useActionState } from "react";

import VerdictCard from "@/components/verdict-card";
import { runFitCheckAction } from "@/lib/actions/check";

export default function CheckForm({ brandSlug, families, defaultModelId }) {
  const [state, formAction, pending] = useActionState(runFitCheckAction, {});

  return (
    <div className="mt-8">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="brandSlug" value={brandSlug} />

        <textarea
          name="idea"
          required
          minLength={10}
          rows={6}
          placeholder="A pop-up in three cities where customers trade an old product for credit toward a new one, filmed documentary-style for social."
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
        />

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="modelId" className="text-xs text-zinc-500">
            Judged by
          </label>
          <select
            id="modelId"
            name="modelId"
            defaultValue={defaultModelId}
            className="rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm outline-none dark:border-zinc-700"
          >
            {families.map((group) => (
              <optgroup key={group.family} label={group.family}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            type="submit"
            disabled={pending}
            className="ml-auto rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {pending ? "Checking…" : "Check fit"}
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Only models that can return a structured verdict are listed. Every
          model here scores against the same brand profile, so results stay
          comparable.
        </p>
      </form>

      {state?.error ? (
        <p className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {state?.ok ? (
        <VerdictCard
          brandSlug={brandSlug}
          result={state.result}
          modelId={state.modelId}
        />
      ) : null}
    </div>
  );
}
