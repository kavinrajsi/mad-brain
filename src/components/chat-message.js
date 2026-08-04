"use client";

import Link from "next/link";
import { useState } from "react";

import AnswerTrace from "@/components/answer-trace";
import Markdown from "@/components/markdown";
import { formatUsage } from "@/lib/ai/format-usage";

function partsText(parts) {
  return (parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function imageParts(parts) {
  return (parts ?? []).filter(
    (part) => part.type === "file" && part.mediaType?.startsWith("image/"),
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-lg px-2 py-1 text-xs text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Sources({ brandSlug, sources }) {
  return (
    <details className="group/sources mt-2 w-fit rounded-xl border border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-zinc-400 [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3 w-3 shrink-0 text-zinc-400 transition-transform group-open/sources:rotate-90"
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Sources ({sources.length})
      </summary>
      <ul className="space-y-1 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        {sources.map((source) => (
          <li key={source.documentId}>
            <Link
              href={`/brand/${brandSlug}/knowledge/${source.documentId}`}
              className="text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {source.title}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function ChatMessage({ role, parts, metadata, brandSlug, query, fallbackModelId }) {
  const text = partsText(parts);
  const images = imageParts(parts);

  if (role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {images.length ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {images.map((image, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- proxied private Blob URL, not a local/optimizable asset
              <img
                key={image.url ?? index}
                src={`/api/brands/${brandSlug}/chat/image?url=${encodeURIComponent(image.url)}`}
                alt={image.filename ?? "Attached image"}
                className="h-40 w-auto rounded-xl object-cover"
              />
            ))}
          </div>
        ) : null}
        {text ? (
          <p className="max-w-[75%] whitespace-pre-wrap rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm leading-6 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {text}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="group flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-medium text-white dark:bg-zinc-50 dark:text-zinc-950">
        B
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">
          <Markdown citations={metadata?.citations} brandSlug={brandSlug}>
            {text}
          </Markdown>
        </div>

        {metadata?.sources?.length ? (
          <Sources brandSlug={brandSlug} sources={metadata.sources} />
        ) : null}

        <AnswerTrace
          query={query}
          text={text}
          citations={metadata?.citations}
          sources={metadata?.sources}
          modelId={metadata?.modelId ?? fallbackModelId}
          usage={metadata?.usage}
          brandSlug={brandSlug}
        />

        <div className="flex items-center gap-2">
          {text ? <CopyButton text={text} /> : null}
          {formatUsage(metadata?.usage) ? (
            <span className="font-mono text-[10px] text-zinc-400">
              {formatUsage(metadata.usage)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
