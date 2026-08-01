import Link from "next/link";

import BrandNav from "./brand-nav";
import SignOutButton from "@/components/sign-out-button";
import { requireBrandRole } from "@/lib/auth/dal";

/**
 * The layout renders the shell and nothing sensitive.
 *
 * The authorisation call here is for navigation data only — layouts do not
 * re-render on navigation, so this is NOT the access check. Every page below
 * calls requireBrandRole itself.
 */
export default async function BrandLayout({ children, params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400 transition hover:text-zinc-600"
            >
              Madbrain
            </Link>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {access.name}
            </span>
          </div>
          <SignOutButton />
        </div>
        <BrandNav slug={slug} role={access.role} />
      </header>
      {children}
    </div>
  );
}
