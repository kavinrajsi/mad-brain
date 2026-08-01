import Link from "next/link";

import CreateBrandForm from "./create-brand-form";
import SignOutButton from "@/components/sign-out-button";
import { listMyBrands, requireUser } from "@/lib/auth/dal";
import { consumeInvitesForEmail } from "@/lib/db/queries";

export const metadata = {
  title: "Brands · Madbrain",
};

export default async function HomePage() {
  const session = await requireUser();

  // Fallback for anyone invited *after* they had already signed in: their
  // session cookie lasts 14 days, so no new sign-in happens to pick the invite
  // up. Sweeping here means a refresh is enough.
  if (session.email) {
    await consumeInvitesForEmail({
      email: session.email,
      userId: session.userId,
    });
  }

  const brands = await listMyBrands();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">
            Madbrain
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Your brands
          </h1>
        </div>
        <SignOutButton />
      </header>

      {brands.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-sm leading-6 text-zinc-500 dark:border-zinc-700">
          You are not a member of any brand yet. Create one below, or ask an
          admin to send you an invite link.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-zinc-200 dark:divide-zinc-800">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link
                href={`/b/${brand.slug}`}
                className="flex items-center justify-between gap-4 py-4 transition hover:opacity-70"
              >
                <span>
                  <span className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    {brand.name}
                  </span>
                  <span className="block font-mono text-xs text-zinc-400">
                    /{brand.slug}
                  </span>
                </span>
                <span className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700">
                  {brand.role}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
          Add a brand
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          You become its owner and can invite the rest of the team.
        </p>
        <CreateBrandForm />
      </section>
    </main>
  );
}
