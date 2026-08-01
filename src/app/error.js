"use client";

export default function GlobalError({ error, reset }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Something broke
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {/*
          error.message is a generic digest in production — Next redacts server
          error details on purpose, so there is nothing brand-specific to leak
          here.
        */}
        This page failed to load. Trying again often works; if it does not, the
        digest below identifies the failure in the server logs.
      </p>
      {error?.digest ? (
        <p className="mt-2 font-mono text-xs text-zinc-400">{error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 self-start rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950"
      >
        Try again
      </button>
    </main>
  );
}
