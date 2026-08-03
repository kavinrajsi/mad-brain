import { PILLARS } from "@/lib/brand-profile";

const VERDICT_STYLES = {
  "strong-fit": {
    label: "Strong fit",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
    bar: "bg-emerald-500",
  },
  "partial-fit": {
    label: "Partial fit",
    className:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200",
    bar: "bg-amber-500",
  },
  "off-brand": {
    label: "Off brand",
    className:
      "border-red-300 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
    bar: "bg-red-500",
  },
};

const PILLAR_LABELS = Object.fromEntries(PILLARS.map((p) => [p.key, p.label]));

export default function VerdictCard({ result, modelId }) {
  const style = VERDICT_STYLES[result.verdict] ?? VERDICT_STYLES["partial-fit"];

  return (
    <section className="mt-8 space-y-8">
      <div className={`rounded-lg border px-5 py-4 ${style.className}`}>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium">{style.label}</span>
          <span className="text-3xl font-semibold tabular-nums">
            {Math.round(result.overallScore)}
            <span className="text-base font-normal opacity-60">/100</span>
          </span>
        </div>
        <p className="mt-2 text-sm leading-6">{result.summary}</p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
          By pillar
        </h2>
        <ul className="mt-3 space-y-3">
          {result.pillars.map((pillar) => (
            <li key={pillar.pillar}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-zinc-950 dark:text-zinc-50">
                  {PILLAR_LABELS[pillar.pillar] ?? pillar.pillar}
                </span>
                <span className="font-mono text-xs tabular-nums text-zinc-500">
                  {Math.round(pillar.score)}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full ${style.bar}`}
                  style={{ width: `${Math.max(0, Math.min(100, pillar.score))}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                {pillar.reasoning}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {result.risks?.length ? (
        <Bullets title="Risks" items={result.risks} />
      ) : null}
      {result.suggestions?.length ? (
        <Bullets title="How to bring it on-brand" items={result.suggestions} />
      ) : null}

      <div>
        <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
          Cited from the brand&apos;s documents
        </h2>
        {result.citations.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Nothing in the indexed documents was close enough to cite
            {result.retrieved === 0
              ? " — this brand has no indexed content yet, so the score rests on the profile alone."
              : ". The score rests on the brand profile."}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {result.citations.map((citation, index) => (
              <li
                // chunkId alone isn't unique — the model can cite the same
                // chunk twice with different quotes.
                key={`${citation.chunkId}-${index}`}
                className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
              >
                <p className="text-xs text-zinc-500">
                  {citation.documentTitle}
                </p>
                <blockquote className="mt-1.5 border-l-2 border-zinc-300 pl-3 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  {citation.quote}
                </blockquote>
              </li>
            ))}
          </ul>
        )}
        {result.droppedCitations > 0 ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            {result.droppedCitations} citation
            {result.droppedCitations === 1 ? "" : "s"} pointed at a passage that
            does not exist and {result.droppedCitations === 1 ? "was" : "were"}{" "}
            discarded.
          </p>
        ) : null}
      </div>

      {modelId ? (
        <p className="font-mono text-xs text-zinc-400">judged by {modelId}</p>
      ) : null}
    </section>
  );
}

function Bullets({ title, items }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="flex gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400"
          >
            <span className="text-zinc-300 dark:text-zinc-700">—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
