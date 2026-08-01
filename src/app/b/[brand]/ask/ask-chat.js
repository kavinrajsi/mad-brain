"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

const STARTERS = [
  "What does this brand refuse to do?",
  "How should I write for this audience?",
  "What has been tried before that did not work?",
];

export default function AskChat({ brandSlug, families, defaultModelId }) {
  const [modelId, setModelId] = useState(defaultModelId);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/brands/${brandSlug}/chat`,
      body: () => ({ modelId }),
    }),
  });

  const busy = status !== "ready";

  function submit(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="mt-8 flex flex-1 flex-col">
      <div className="flex-1 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => submit(starter)}
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                {starter}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((message) => (
          <div key={message.id}>
            <p className="font-mono text-xs uppercase tracking-wider text-zinc-400">
              {message.role === "user" ? "You" : "Brand"}
            </p>
            <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200">
              {message.parts
                .filter((part) => part.type === "text")
                .map((part, index) => (
                  <span key={index}>{part.text}</span>
                ))}
            </div>
          </div>
        ))}

        {error ? (
          <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error.message}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        className="sticky bottom-0 mt-8 space-y-2 bg-white pb-6 pt-4 dark:bg-black"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything about this brand…"
            className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {busy ? "…" : "Ask"}
          </button>
        </div>

        <select
          value={modelId}
          onChange={(event) => setModelId(event.target.value)}
          className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-xs outline-none dark:border-zinc-700"
        >
          {families.map((group) => (
            <optgroup key={group.family} label={group.family}>
              {group.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </form>
    </div>
  );
}
