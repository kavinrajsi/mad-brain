"use client";

import { useMemo, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant output as markdown.
 *
 * Models answer in markdown whether or not you ask them to, so rendering their
 * text raw put literal `**bold**` and `- ` bullets on screen. Styling is set
 * per element rather than through a typography plugin, so the chat matches the
 * rest of the app instead of importing a second set of type opinions.
 */

function codeText(children) {
  return Array.isArray(children) ? children.join("") : String(children ?? "");
}

// Kept dark regardless of site theme — code blocks reading as a distinct
// surface (not a light-mode box) is a small, cheap signal that this is code.
function CodeBlock({ language, children }) {
  const [copied, setCopied] = useState(false);
  const text = codeText(children).replace(/\n$/, "");

  return (
    <div className="my-3 overflow-hidden rounded-2xl bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-400">
        <span className="font-mono">{language ?? ""}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 pb-3 text-xs text-zinc-100">
        <code>{text}</code>
      </pre>
    </div>
  );
}

// Citation chip target, e.g. `[•](citation:1,2)` — indices comma-joined when
// several adjacent markers were grouped. Never a real URL, so it's
// intercepted in the `a` component below instead of reaching the browser.
const CITATION_HREF = /^citation:([\d,]+)$/;

// react-markdown sanitizes every href/src through an allowlist of real URL
// protocols (http, mailto, ...) and silently rewrites anything else to "" —
// citation: is a made-up scheme, so without this override every chip's href
// gets nulled out before CitationChip ever sees it.
function urlTransform(value) {
  return CITATION_HREF.test(value) ? value : defaultUrlTransform(value);
}

// Anchored popover, same open/backdrop/panel pattern as ModelPicker in
// ask-chat.js. Every element inside has to be phrasing content (span/button,
// not div/p) — this chip renders inline inside a markdown <p>, and a <div>
// there would make the browser's HTML parser force-close the paragraph early.
function CitationChip({ href, citationsByIndex, brandSlug, children, ...props }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  const match = CITATION_HREF.exec(href ?? "");
  const group = match
    ? match[1]
        .split(",")
        .map((n) => citationsByIndex?.get(Number(n)))
        .filter(Boolean)
    : [];

  if (!group.length) {
    // Marker didn't resolve to a known source (stale index, or a plain link
    // that happens to read "citation:..."), or this is a genuine markdown
    // link the model wrote — render a normal anchor.
    return (
      <a
        className="underline underline-offset-2 hover:text-zinc-950 dark:hover:text-zinc-50"
        target="_blank"
        rel="noreferrer noopener"
        href={href}
        {...props}
      >
        {children}
      </a>
    );
  }

  const chip = group[0];
  const current = group[Math.min(page, group.length - 1)];
  const chipInitial = chip.title?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <span className="relative mx-0.5 inline-block align-middle">
      <button
        type="button"
        onClick={() =>
          setOpen((wasOpen) => {
            if (!wasOpen) setPage(0);
            return !wasOpen;
          })
        }
        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-1.5 align-middle text-[11px] leading-none text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-950 font-mono text-[9px] text-white dark:bg-zinc-50 dark:text-zinc-950">
          {chipInitial}
        </span>
        <span className="max-w-[8rem] truncate">{chip.title}</span>
        {group.length > 1 ? (
          <span className="text-zinc-400">+{group.length - 1}</span>
        ) : null}
      </button>

      {open ? (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute left-0 top-full z-20 mt-2 block w-72 rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {group.length > 1 ? (
              <span className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous source"
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900"
                >
                  ◀
                </button>
                <span className="font-mono text-[10px] text-zinc-400">
                  {page + 1}/{group.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(group.length - 1, p + 1))}
                  disabled={page === group.length - 1}
                  aria-label="Next source"
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-900"
                >
                  ▶
                </button>
              </span>
            ) : null}
            <span className="block text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {current.title}
            </span>
            <span className="mt-1 block border-l-2 border-zinc-300 pl-2 text-xs leading-5 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {current.snippet}
            </span>
            <a
              href={`/brand/${brandSlug}/knowledge/${current.documentId}`}
              className="mt-2 inline-block text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Open document ↗
            </a>
          </span>
        </>
      ) : null}
    </span>
  );
}

const COMPONENTS = {
  p: (props) => <p className="my-3 first:mt-0 last:mb-0 leading-6" {...props} />,
  strong: (props) => (
    <strong className="font-semibold text-zinc-950 dark:text-zinc-50" {...props} />
  ),
  em: (props) => <em className="italic" {...props} />,
  ul: (props) => (
    <ul className="my-3 list-disc space-y-1 pl-5 marker:text-zinc-400" {...props} />
  ),
  ol: (props) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 marker:text-zinc-400" {...props} />
  ),
  li: (props) => <li className="leading-6" {...props} />,
  h1: (props) => (
    <h1 className="mt-5 mb-2 text-base font-semibold text-zinc-950 first:mt-0 dark:text-zinc-50" {...props} />
  ),
  h2: (props) => (
    <h2 className="mt-5 mb-2 text-sm font-semibold text-zinc-950 first:mt-0 dark:text-zinc-50" {...props} />
  ),
  h3: (props) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold text-zinc-950 first:mt-0 dark:text-zinc-50" {...props} />
  ),
  // `a` is bound per-render (needs citationsByIndex/brandSlug) — see Markdown below.
  // Fenced code carries a "language-xxx" className from remark; inline code
  // does not — that distinction is what routes block code to CodeBlock and
  // leaves inline code as a plain pill.
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    if (match) {
      return <CodeBlock language={match[1]}>{children}</CodeBlock>;
    }
    return (
      <code
        className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        {...props}
      >
        {children}
      </code>
    );
  },
  // CodeBlock owns its own container, so pre just passes its child through —
  // otherwise fenced code ends up double-wrapped in two <pre>-like boxes.
  pre: ({ children }) => children,
  blockquote: (props) => (
    <blockquote
      className="my-3 border-l-2 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      {...props}
    />
  ),
  hr: () => <hr className="my-5 border-zinc-200 dark:border-zinc-800" />,
  table: (props) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-zinc-300 pb-1.5 pr-4 font-medium text-zinc-950 dark:border-zinc-700 dark:text-zinc-50"
      {...props}
    />
  ),
  td: (props) => (
    <td className="border-b border-zinc-100 py-1.5 pr-4 align-top dark:border-zinc-900" {...props} />
  ),
};

// Matches a run of adjacent bracket-number markers, e.g. "[1][2]" — the
// system prompt asks the model to place co-referenced numbers together like
// this so they group into one chip. A stray "[1] [2]" (with a space) is left
// as two separate single-citation chips instead of one grouped chip.
const MARKER_GROUP = /(?:\[(\d+)\])+/g;
const MARKER = /\[(\d+)\]/g;

export default function Markdown({ children, citations, brandSlug }) {
  const citationsByIndex = useMemo(() => {
    if (!citations?.length) return null;
    return new Map(citations.map((citation) => [citation.index, citation]));
  }, [citations]);

  // Rewrite each run of recognized `[n]` markers into a single markdown link
  // pointing at the citation: pseudo-scheme (indices comma-joined) so
  // CitationChip can intercept it; a run split across a streaming chunk
  // boundary just doesn't match yet and renders as plain text until the
  // closing `]` arrives.
  const text = citationsByIndex
    ? String(children ?? "").replace(MARKER_GROUP, (raw) => {
        const indices = [...raw.matchAll(MARKER)]
          .map((m) => Number(m[1]))
          .filter((index) => citationsByIndex.has(index));
        return indices.length ? `[•](citation:${indices.join(",")})` : raw;
      })
    : children;

  const components = useMemo(
    () => ({
      ...COMPONENTS,
      a: (props) => (
        <CitationChip {...props} citationsByIndex={citationsByIndex} brandSlug={brandSlug} />
      ),
    }),
    [citationsByIndex, brandSlug],
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>
      {text}
    </ReactMarkdown>
  );
}
