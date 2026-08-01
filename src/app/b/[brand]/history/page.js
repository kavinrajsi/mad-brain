import { requireBrandRole } from "@/lib/auth/dal";
import { listIdeaChecks } from "@/lib/db/queries";

export const metadata = {
  title: "History · Madbrain",
};

const VERDICT_TONE = {
  "strong-fit": "text-emerald-600 dark:text-emerald-400",
  "partial-fit": "text-amber-600 dark:text-amber-400",
  "off-brand": "text-red-600 dark:text-red-400",
};

export default async function HistoryPage({ params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug);
  const checks = await listIdeaChecks(access.brandId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Past checks
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        What has been run against {access.name} before. Reading a handful of
        these is the fastest way to learn where the brand&apos;s edges are.
      </p>

      {checks.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700">
          No checks yet.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
          {checks.map((check) => (
            <li key={check.id} className="py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className={`text-xs font-medium ${VERDICT_TONE[check.verdict?.verdict] ?? "text-zinc-500"}`}
                >
                  {check.verdict?.verdict ?? "unknown"}
                </span>
                <span className="font-mono text-xs tabular-nums text-zinc-400">
                  {check.overallScore ?? "—"}/100
                </span>
              </div>
              <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-zinc-950 dark:text-zinc-50">
                {check.ideaText}
              </p>
              {check.verdict?.summary ? (
                <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {check.verdict.summary}
                </p>
              ) : null}
              <p className="mt-2 font-mono text-xs text-zinc-400">
                {new Date(check.createdAt).toLocaleString()} · {check.modelId}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
