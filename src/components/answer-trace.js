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
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0 text-zinc-300 dark:text-zinc-700">
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One thin bar per retrieved passage, height mapped from its match score
 * (0-1 cosine similarity). A glanceable stand-in for a real chart — not
 * meant to be read precisely, just to show which passages mattered more. */
function ScoreBars({ citations }) {
  return (
    <span className="inline-flex h-3 items-end gap-px" aria-hidden="true">
      {citations.map((citation, index) => {
        const score = typeof citation.score === "number" ? citation.score : 0.5;
        return (
          <span
            key={`${citation.documentId}-${index}`}
            className="w-0.5 rounded-full bg-zinc-400 dark:bg-zinc-600"
            style={{ height: `${Math.max(25, Math.round(score * 100))}%` }}
          />
        );
      })}
    </span>
  );
}

function truncate(text, max) {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

/**
 * Always-visible, compact trace of how one answer was produced: the
 * question that was asked, what retrieval found, which model answered.
 * Separate from the Sources dropdown (chat-message.js) — that one is a
 * clickable list of cited docs; this is a glanceable process summary.
 */
export default function AnswerTrace({ query, citations, sources, modelId }) {
  if (!citations?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-zinc-400">
      {query ? (
        <>
          <span className="inline-flex items-center gap-1">
            <StepIcon path={ICON_QUESTION} />
            {truncate(query, 40)}
          </span>
          <Arrow />
        </>
      ) : null}

      <span className="inline-flex items-center gap-1">
        <StepIcon path={ICON_SEARCH} />
        {citations.length} passage{citations.length === 1 ? "" : "s"}
        {" · "}
        {sources?.length ?? 0} doc{(sources?.length ?? 0) === 1 ? "" : "s"}
        <ScoreBars citations={citations} />
      </span>

      {modelId ? (
        <>
          <Arrow />
          <span className="inline-flex items-center gap-1">
            <StepIcon path={ICON_MODEL} />
            {modelId}
          </span>
        </>
      ) : null}

      <Arrow />
      <span className="inline-flex items-center gap-1">
        <StepIcon path={ICON_DONE} />
        answered
      </span>
    </div>
  );
}
