"use client";

import { useActionState, useState } from "react";

import { inviteMemberAction } from "@/lib/actions/brands";

export default function InviteForm({ brandSlug, canInviteOwner }) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, {});
  const [copied, setCopied] = useState(false);

  const inviteUrl =
    state?.token && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${state.token}`
      : null;

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4">
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="brandSlug" value={brandSlug} />
        <input
          name="email"
          type="email"
          required
          placeholder="name@company.com"
          className="min-w-56 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
        />
        <select
          name="role"
          defaultValue="member"
          className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          {canInviteOwner ? <option value="owner">Owner</option> : null}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          {pending ? "Creating…" : "Create invite"}
        </button>
      </form>

      {state?.error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      {inviteUrl ? (
        <div className="mt-4 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            Send this link to them. It works once and expires in 14 days.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {inviteUrl}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
