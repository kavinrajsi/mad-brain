"use client";

import { useActionState } from "react";

import { saveBrandProfileAction } from "@/lib/actions/profile";
import { PRISM_FACETS } from "@/lib/brand-profile";

const FIELDS = [
  {
    name: "mission",
    label: "Mission",
    rows: 3,
    help: "What the brand exists to do. The thing that would still be true if the product changed.",
  },
  {
    name: "values",
    label: "Values",
    rows: 5,
    help: "One per line. Beliefs strong enough that you would turn down work over them.",
  },
  {
    name: "tone",
    label: "Tone of voice",
    rows: 5,
    help: "One per line. e.g. “Dry, never zany”, “Plain words over jargon”.",
  },
  {
    name: "audience",
    label: "Audience",
    rows: 3,
    help: "Who they are, what they care about, what they are sceptical of.",
  },
  {
    name: "dos",
    label: "Always do",
    rows: 5,
    help: "One per line.",
  },
  {
    name: "donts",
    label: "Never do",
    rows: 5,
    help: "One per line. These do the most work in a fit check — be specific.",
  },
  {
    name: "visual",
    label: "Visual rules",
    rows: 5,
    help: "One per line. Colour, type, photography, logo treatment.",
  },
];

export default function ProfileForm({ brandSlug, initial, readOnly }) {
  const [state, formAction, pending] = useActionState(
    saveBrandProfileAction,
    {},
  );

  return (
    <form action={formAction} className="mt-10 space-y-8">
      <input type="hidden" name="brandSlug" value={brandSlug} />

      {FIELDS.map((field) => (
        <div key={field.name}>
          <label
            htmlFor={field.name}
            className="block text-sm font-medium text-zinc-950 dark:text-zinc-50"
          >
            {field.label}
          </label>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{field.help}</p>
          <textarea
            id={field.name}
            name={field.name}
            rows={field.rows}
            readOnly={readOnly}
            defaultValue={initial[field.name]}
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm leading-6 outline-none read-only:opacity-70 focus:border-zinc-500 dark:border-zinc-700"
          />
        </div>
      ))}

      <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Brand prism
        </h2>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          Kapferer&apos;s six facets of brand identity. Optional, but each one
          filled in gives the AI another edge to reason against.
        </p>
        <div className="mt-4 space-y-6">
          {PRISM_FACETS.map((facet) => (
            <div key={facet.key}>
              <label
                htmlFor={`prism_${facet.key}`}
                className="block text-sm font-medium text-zinc-950 dark:text-zinc-50"
              >
                {facet.label}
              </label>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {facet.help}
              </p>
              <textarea
                id={`prism_${facet.key}`}
                name={`prism_${facet.key}`}
                rows={2}
                readOnly={readOnly}
                defaultValue={initial.prism?.[facet.key] ?? ""}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm leading-6 outline-none read-only:opacity-70 focus:border-zinc-500 dark:border-zinc-700"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <label
          htmlFor="rules"
          className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50"
        >
          Rule book
        </label>
        <p className="mt-1 text-xs leading-5 text-zinc-500">
          One rule per line. Hard rules the brand never breaks — these carry
          the same weight as the never-do list in a fit check.
        </p>
        <textarea
          id="rules"
          name="rules"
          rows={6}
          readOnly={readOnly}
          defaultValue={initial.rules}
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm leading-6 outline-none read-only:opacity-70 focus:border-zinc-500 dark:border-zinc-700"
        />
      </div>

      {readOnly ? (
        <p className="text-sm text-zinc-500">
          Only admins can edit the brand profile.
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {pending ? "Saving and indexing…" : "Save profile"}
          </button>
          {state?.ok && !state?.warning ? (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              Saved and indexed.
            </span>
          ) : null}
        </div>
      )}

      {state?.warning ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {state.warning}
        </p>
      ) : null}
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
