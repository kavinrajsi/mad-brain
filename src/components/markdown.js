"use client";

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
  a: (props) => (
    <a
      className="underline underline-offset-2 hover:text-zinc-950 dark:hover:text-zinc-50"
      target="_blank"
      rel="noreferrer noopener"
      {...props}
    />
  ),
  code: ({ children, ...props }) => (
    <code
      className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
      {...props}
    >
      {children}
    </code>
  ),
  pre: (props) => (
    // Code blocks scroll inside their own box so a long line cannot make the
    // whole conversation scroll sideways.
    <pre
      className="my-3 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900"
      {...props}
    />
  ),
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

export default function Markdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
}
