"use client";

import { useActionState } from "react";

import {
  changeRoleAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/lib/actions/brands";

export default function MemberRow({
  brandSlug,
  member,
  invite,
  isSelf,
  canManageOwners,
}) {
  if (invite) return <InviteRow brandSlug={brandSlug} invite={invite} />;
  return (
    <ExistingMemberRow
      brandSlug={brandSlug}
      member={member}
      isSelf={isSelf}
      canManageOwners={canManageOwners}
    />
  );
}

function InviteRow({ brandSlug, invite }) {
  const [state, formAction, pending] = useActionState(revokeInviteAction, {});

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="flex-1 text-sm text-zinc-950 dark:text-zinc-50">
        {invite.email}
        <span className="ml-2 text-xs text-zinc-400">
          expires {new Date(invite.expiresAt).toLocaleDateString()}
        </span>
      </span>
      <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700">
        {invite.role}
      </span>
      <form action={formAction}>
        <input type="hidden" name="brandSlug" value={brandSlug} />
        <input type="hidden" name="inviteId" value={invite.id} />
        <button
          type="submit"
          disabled={pending}
          className="text-xs text-red-600 transition hover:underline disabled:opacity-50 dark:text-red-400"
        >
          {pending ? "Revoking…" : "Revoke"}
        </button>
      </form>
      {state?.error ? (
        <p className="w-full text-xs text-red-600">{state.error}</p>
      ) : null}
    </li>
  );
}

function ExistingMemberRow({ brandSlug, member, isSelf, canManageOwners }) {
  const [roleState, roleAction, rolePending] = useActionState(
    changeRoleAction,
    {},
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    {},
  );

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="flex-1 text-sm text-zinc-950 dark:text-zinc-50">
        {member.displayName ?? member.email}
        {member.displayName ? (
          <span className="ml-2 text-xs text-zinc-400">{member.email}</span>
        ) : null}
        {isSelf ? <span className="ml-2 text-xs text-zinc-400">you</span> : null}
      </span>

      {isSelf ? (
        <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700">
          {member.role}
        </span>
      ) : (
        <>
          <form action={roleAction} className="flex items-center gap-2">
            <input type="hidden" name="brandSlug" value={brandSlug} />
            <input type="hidden" name="userId" value={member.userId} />
            <select
              name="role"
              defaultValue={member.role}
              className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-zinc-700"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              {canManageOwners ? <option value="owner">Owner</option> : null}
            </select>
            <button
              type="submit"
              disabled={rolePending}
              className="text-xs text-zinc-600 transition hover:underline disabled:opacity-50 dark:text-zinc-400"
            >
              {rolePending ? "Saving…" : "Save"}
            </button>
          </form>

          <form action={removeAction}>
            <input type="hidden" name="brandSlug" value={brandSlug} />
            <input type="hidden" name="userId" value={member.userId} />
            <button
              type="submit"
              disabled={removePending}
              className="text-xs text-red-600 transition hover:underline disabled:opacity-50 dark:text-red-400"
            >
              {removePending ? "Removing…" : "Remove"}
            </button>
          </form>
        </>
      )}

      {roleState?.error || removeState?.error ? (
        <p className="w-full text-xs text-red-600">
          {roleState?.error ?? removeState?.error}
        </p>
      ) : null}
    </li>
  );
}
