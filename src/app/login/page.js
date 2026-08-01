import { redirect } from "next/navigation";

import LoginButton from "./login-button";
import { getSession } from "@/lib/auth/dal";

export const metadata = {
  title: "Sign in · Madbrain",
};

export default async function LoginPage({ searchParams }) {
  const session = await getSession();
  const { next } = await searchParams;

  if (session) redirect(next ?? "/");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">
          Madbrain
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Brand memory, in one place.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Sign in to read a brand in, and to check whether an idea fits it.
        </p>

        <div className="mt-8">
          <LoginButton next={next ?? "/"} />
        </div>

        <p className="mt-6 text-xs leading-5 text-zinc-500">
          You will land on the brands you have been invited to. If you see
          nothing after signing in, ask an admin to send you an invite.
        </p>
      </div>
    </main>
  );
}
