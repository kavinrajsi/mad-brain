"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
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

// Citation badge target, e.g. `[1](citation:1)` — never a real URL, so it's
// intercepted in the `a` component below instead of reaching the browser.
const CITATION_HREF = /^citation:(\d+)$/;

function CitationLink({ href, citationsByIndex, brandSlug, children, ...props }) {
  const match = CITATION_HREF.exec(href ?? "");
  const citation = match && citationsByIndex?.get(Number(match[1]));

  if (!citation) {
    // Marker didn't resolve to a known source (stale index, or a plain link
    // that happens to read "citation:n") — fall back to a normal anchor.
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

  return (
    <a
      href={`/brand/${brandSlug}/knowledge/${citation.documentId}`}
      title={citation.title}
      className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-100 px-1 align-super font-mono text-[10px] leading-none text-zinc-500 no-underline hover:bg-zinc-200 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
    >
      {match[1]}
    </a>
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

const MARKER = /\[(\d+)\]/g;

export default function Markdown({ children, citations, brandSlug }) {
  const citationsByIndex = useMemo(() => {
    if (!citations?.length) return null;
    return new Map(citations.map((citation) => [citation.index, citation]));
  }, [citations]);

  // Rewrite recognized `[n]` markers into markdown links pointing at the
  // citation: pseudo-scheme so CitationLink can intercept them; markers
  // split across a streaming chunk boundary just don't match yet and render
  // as plain text until the closing `]` arrives.
  const text = citationsByIndex
    ? String(children ?? "").replace(MARKER, (raw, index) =>
        citationsByIndex.has(Number(index)) ? `[${index}](citation:${index})` : raw,
      )
    : children;

  const components = useMemo(
    () => ({
      ...COMPONENTS,
      a: (props) => (
        <CitationLink {...props} citationsByIndex={citationsByIndex} brandSlug={brandSlug} />
      ),
    }),
    [citationsByIndex, brandSlug],
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
