import Link from "next/link";

import { formatUsage } from "@/lib/ai/format-usage";

const ICON_QUESTION =
  "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z";
const ICON_SEARCH =
  "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
const ICON_MODEL =
  "M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z";
const ICON_DONE =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z";

function StepIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

/** One icon node + connecting line on the left, content on the right —
 * classic vertical timeline. `last` skips the connector below the node. */
function Step({ icon, title, children, last = false }) {
  return (
    <div className="relative flex gap-3">
      {!last ? (
        <span className="absolute left-[9px] top-6 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />
      ) : null}
      <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        <StepIcon path={icon} />
      </span>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-4"}`}>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
        <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{children}</div>
      </div>
    </div>
  );
}

/** Which citation indices the model actually referenced inline, parsed from
 * its own answer text — independent of markdown.js's citation-chip
 * rendering, but reading the same `[n]` marker convention. */
function citedIndices(text) {
  return new Set([...String(text ?? "").matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
}

/**
 * Full step-by-step trace of how one answer was produced: the question,
 * every retrieved passage (cited or not), the model call, and the answer.
 * Separate from the Sources dropdown (chat-message.js) — that one is a
 * quick clickable list; this is the detailed process view, always visible.
 */
export default function AnswerTrace({
  query,
  text,
  citations,
  sources,
  modelId,
  usage,
  brandSlug,
}) {
  if (!citations?.length) return null;

  const used = citedIndices(text);
  const citedCount = citations.filter((c) => used.has(c.index)).length;
  const usageText = formatUsage(usage);

  return (
    <div className="mt-2 max-w-md rounded-xl border border-zinc-200 px-3 py-3 dark:border-zinc-800">
      {query ? (
        <Step icon={ICON_QUESTION} title="Question">
          {query}
        </Step>
      ) : null}

      <Step icon={ICON_SEARCH} title="Retrieval">
        {citations.length} passage{citations.length === 1 ? "" : "s"} from{" "}
        {sources?.length ?? 0} document{(sources?.length ?? 0) === 1 ? "" : "s"}
        <div className="mt-1.5 max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {citations.map((citation, index) => {
            const isUsed = used.has(citation.index);
            const score = typeof citation.score === "number" ? citation.score : null;
            return (
              <div
                key={`${citation.documentId}-${index}`}
                className={`rounded-lg border px-2 py-1.5 ${
                  isUsed
                    ? "border-zinc-200 dark:border-zinc-800"
                    : "border-dashed border-zinc-200 opacity-60 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 rounded bg-zinc-100 px-1 font-mono text-[9px] text-zinc-500 dark:bg-zinc-900">
                    {score !== null ? score.toFixed(2) : "—"}
                  </span>
                  {brandSlug ? (
                    <Link
                      href={`/brand/${brandSlug}/knowledge/${citation.documentId}`}
                      className="min-w-0 flex-1 truncate font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                    >
                      {citation.title}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate font-medium text-zinc-700 dark:text-zinc-300">
                      {citation.title}
                    </span>
                  )}
                  {isUsed ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      cited
                    </span>
                  ) : null}
                </div>
                {citation.snippet ? (
                  <p className="mt-0.5 truncate text-[10px] text-zinc-400">{citation.snippet}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Step>

      {modelId ? (
        <Step icon={ICON_MODEL} title="Model">
          {modelId}
          {usageText ? ` · ${usageText}` : ""}
        </Step>
      ) : null}

      <Step icon={ICON_DONE} title="Answered" last>
        {citedCount} of {citations.length} passage{citations.length === 1 ? "" : "s"} cited
      </Step>
    </div>
  );
}
