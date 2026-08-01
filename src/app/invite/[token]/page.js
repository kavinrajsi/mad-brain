import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/dal";
import { acceptInviteByToken } from "@/lib/db/queries";

export const metadata = {
  title: "Accept invite · Madbrain",
};

const MESSAGES = {
  not_found: "This invite link is not valid.",
  already_used: "This invite link has already been used.",
  expired: "This invite link has expired. Ask an admin to send a new one.",
};

export default async function AcceptInvitePage({ params }) {
  const { token } = await params;
  const session = await getSession();

  // Sign in first, then come straight back and redeem.
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const result = await acceptInviteByToken({ token, userId: session.userId });

  if (result.ok) {
    redirect(`/b/${result.brandSlug}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Invite not accepted
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {MESSAGES[result.reason] ?? "This invite link could not be used."}
      </p>
      <Link
        href="/"
        className="mt-6 self-start rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Go to your brands
      </Link>
    </main>
  );
}
