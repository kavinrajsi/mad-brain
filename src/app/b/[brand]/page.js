import Link from "next/link";

import { requireBrandRole } from "@/lib/auth/dal";
import {
  getBrandProfile,
  listBrandDocuments,
  listOnboardingPath,
} from "@/lib/db/queries";

export async function generateMetadata({ params }) {
  const { brand } = await params;
  return { title: `${brand} · Madbrain` };
}

export default async function BrandHomePage({ params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug);

  const [path, documents, profile] = await Promise.all([
    listOnboardingPath({ brandId: access.brandId, userId: access.userId }),
    listBrandDocuments(access.brandId),
    getBrandProfile(access.brandId),
  ]);

  const readCount = path.filter((item) => item.readAt).length;
  const ready = documents.filter((doc) => doc.status === "ready").length;
  const profileFilled = Boolean(profile?.mission);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Start here
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        The curated path into {access.name}. Read these in order, then try an
        idea against the brand on the Fit check tab.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
        <Stat label="Documents indexed" value={ready} />
        <Stat
          label="Reading path"
          value={path.length ? `${readCount}/${path.length}` : "—"}
        />
        <Stat
          label="Brand profile"
          value={profileFilled ? "Filled in" : "Empty"}
        />
      </dl>

      {!profileFilled ? (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          The brand profile is empty, so fit checks have no rubric to score
          against and will fall back to the documents alone.{" "}
          <Link href={`/b/${slug}/profile`} className="font-medium underline">
            Fill it in
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-10">
        {path.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-sm leading-6 text-zinc-500 dark:border-zinc-700">
            No reading path yet. An admin can pin documents in order on the{" "}
            <Link href={`/b/${slug}/knowledge`} className="underline">
              Knowledge
            </Link>{" "}
            tab to build one for new joiners.
          </p>
        ) : (
          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {path.map((item, index) => (
              <li key={item.id}>
                <Link
                  href={`/b/${slug}/knowledge/${item.id}`}
                  className="flex items-center gap-4 py-4 transition hover:opacity-70"
                >
                  <span className="font-mono text-xs text-zinc-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-sm text-zinc-950 dark:text-zinc-50">
                    {item.title}
                  </span>
                  {item.readAt ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Read
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">Unread</span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white px-4 py-4 dark:bg-black">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 text-xl font-medium tabular-nums text-zinc-950 dark:text-zinc-50">
        {value}
      </dd>
    </div>
  );
}
