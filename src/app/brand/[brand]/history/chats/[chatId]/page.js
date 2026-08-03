import Link from "next/link";
import { notFound } from "next/navigation";

import ChatMessage from "@/components/chat-message";
import { requireBrandRole } from "@/lib/auth/dal";
import { getChatWithMessages } from "@/lib/db/queries";

export const metadata = {
  title: "Conversation · Madbrain",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        href={`/brand/${slug}/history`}
        className="inline-flex items-center gap-1 font-mono text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        History
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
          <ChatMessage
            key={message.id}
            role={message.role}
            parts={message.parts}
            metadata={message.metadata}
            brandSlug={slug}
          />
        ))}
      </div>
    </main>
  );
}
