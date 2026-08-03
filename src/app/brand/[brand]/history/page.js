import Link from "next/link";

import { formatUsage } from "@/lib/ai/format-usage";
import { requireBrandRole } from "@/lib/auth/dal";
import { listBrandChats, listIdeaChecks, sumChatUsage } from "@/lib/db/queries";

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
  const [checks, chats, chatUsageRows] = await Promise.all([
    listIdeaChecks(access.brandId),
    listBrandChats(access.brandId),
    sumChatUsage(access.brandId),
  ]);
  const chatUsageById = new Map(
    chatUsageRows.map((row) => [
      row.chatId,
      { totalTokens: row.totalTokens, costUsd: row.costUsd },
    ]),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        History
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        What has been asked and run against {access.name}
        {/* This Next fork's SSR eats the leading space of static text that
            follows an interpolation, so the space is an expression. */}
        {" before. Reading a handful of these is the fastest way to learn where the brand's edges are."}
      </p>

      <h2 className="mt-10 font-mono text-xs uppercase tracking-wider text-zinc-400">
        Conversations
      </h2>
      {chats.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700">
          No conversations yet.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
          {chats.map((chat) => (
            <li key={chat.id}>
              <Link
                href={`/brand/${slug}/history/chats/${chat.id}`}
                className="block py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <p className="line-clamp-2 text-sm leading-6 text-zinc-950 dark:text-zinc-50">
                  {chat.title}
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-400">
                  {new Date(chat.updatedAt).toLocaleString()} · {chat.modelId}
                  {chat.memberName ? ` · ${chat.memberName}` : ""}
                  {(() => {
                    const usage = formatUsage(chatUsageById.get(chat.id));
                    return usage ? ` · ${usage}` : "";
                  })()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-mono text-xs uppercase tracking-wider text-zinc-400">
        Fit checks
      </h2>
      {checks.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 px-5 py-8 text-sm text-zinc-500 dark:border-zinc-700">
          No checks yet.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
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
                {check.memberName ? ` · ${check.memberName}` : ""}
                {(() => {
                  const usage = formatUsage(check.usage);
                  return usage ? ` · ${usage}` : "";
                })()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
