"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { useEffect, useRef, useState } from "react";

import ChatMessage from "@/components/chat-message";

const STARTERS = [
  "What does this brand refuse to do?",
  "How should I write for this audience?",
  "What has been tried before that did not work?",
];

const MAX_TEXTAREA_HEIGHT = 200;

function ModelPicker({ families, modelId, onChange }) {
  const [open, setOpen] = useState(false);
  const current = families
    .flatMap((group) => group.models)
    .find((model) => model.id === modelId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        {current?.label ?? modelId}
        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-20 mb-2 max-h-80 w-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {families.map((group) => (
              <div key={group.family} className="mb-1 last:mb-0">
                <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  {group.family}
                </p>
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onChange(model.id);
                      setOpen(false);
                    }}
                    className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                      model.id === modelId
                        ? "text-zinc-950 dark:text-zinc-50"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-medium text-white dark:bg-zinc-50 dark:text-zinc-950">
        B
      </div>
      <div className="flex items-center gap-1 py-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AskChat({ brandSlug, families, defaultModelId }) {
  const [modelId, setModelId] = useState(defaultModelId);
  const [input, setInput] = useState("");
  // One id per mounted conversation; the server records history under it.
  const [chatId] = useState(() => crypto.randomUUID());
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/brands/${brandSlug}/chat`,
      body: () => ({ modelId, chatId }),
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  function submit(text) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(resizeTextarea);
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
                className="rounded-2xl border border-zinc-300 px-3.5 py-2 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                {starter}
              </button>
            ))}
          </div>
        ) : null}

        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            parts={message.parts}
            metadata={message.metadata}
            brandSlug={brandSlug}
          />
        ))}

        {status === "submitted" ? <TypingIndicator /> : null}

        {error ? (
          <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {/*
              A route that throws before streaming returns a 500 with no body,
              so error.message is an empty string — which rendered as an empty
              red box that said nothing at all.
            */}
            {error.message || "The brand could not answer that. Please try again."}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        className="sticky bottom-0 mt-8 space-y-2 bg-white pb-6 pt-4 dark:bg-black"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-transparent p-2 shadow-sm focus-within:border-zinc-500 dark:border-zinc-700">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder="Ask anything about this brand…"
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-zinc-400"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950"
              aria-label="Stop"
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3">
                <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
              aria-label="Send"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                <path
                  d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1">
          <ModelPicker families={families} modelId={modelId} onChange={setModelId} />
          <p className="font-mono text-[10px] text-zinc-400">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </form>
    </div>
  );
}
