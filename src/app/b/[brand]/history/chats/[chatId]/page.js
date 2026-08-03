import Link from "next/link";
import { notFound } from "next/navigation";

import Markdown from "@/components/markdown";
import { formatUsage } from "@/lib/ai/format-usage";
import { requireBrandRole } from "@/lib/auth/dal";
import { getChatWithMessages } from "@/lib/db/queries";

export const metadata = {
  title: "Conversation · Madbrain",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function partsText(parts) {
  return (parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default async function ChatHistoryPage({ params }) {
  const { brand: slug, chatId } = await params;
  const access = await requireBrandRole(slug);

  // Postgres rejects a malformed uuid with an error, not an empty result.
  if (!UUID_RE.test(chatId)) notFound();

  const chat = await getChatWithMessages({ chatId, brandId: access.brandId });
  if (!chat) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <Link
        href={`/b/${slug}/history`}
        className="font-mono text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
      >
        ← History
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {chat.title}
      </h1>
      <p className="mt-2 font-mono text-xs text-zinc-400">
        {new Date(chat.createdAt).toLocaleString()} · {chat.modelId}
        {chat.memberName ? ` · ${chat.memberName}` : ""}
      </p>

      <div className="mt-8 space-y-6">
        {chat.messages.map((message) => (
          <div key={message.id}>
            <p className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              {message.role === "user" ? "You" : "Brand"}
            </p>
            <div className="mt-1 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap">
                  {partsText(message.parts)}
                </p>
              ) : (
                <Markdown>{partsText(message.parts)}</Markdown>
              )}
            </div>

            {message.role === "assistant" &&
            message.metadata?.sources?.length ? (
              <details className="mt-2">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-zinc-400">
                  Sources ({message.metadata.sources.length})
                </summary>
                <ul className="mt-1 space-y-1">
                  {message.metadata.sources.map((source) => (
                    <li key={source.documentId}>
                      <Link
                        href={`/b/${slug}/knowledge/${source.documentId}`}
                        className="text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        {source.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {message.role === "assistant" && formatUsage(message.metadata?.usage) ? (
              <p className="mt-1 font-mono text-xs text-zinc-400">
                {formatUsage(message.metadata.usage)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
