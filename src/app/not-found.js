import Link from "next/link";

export const metadata = {
  title: "Not found · Madbrain",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Not found
      </h1>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        This page does not exist, or it belongs to a brand you are not a member
        of.
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
