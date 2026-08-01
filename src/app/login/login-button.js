"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signInWithGoogle } from "@/lib/auth/firebase-client";

export default function LoginButton({ next }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function handleSignIn() {
    setPending(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err.message ?? "Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSignIn}
        disabled={pending}
        className="w-full rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {pending ? "Signing in…" : "Continue with Google"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
