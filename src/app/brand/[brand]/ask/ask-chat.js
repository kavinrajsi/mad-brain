"use client";

import { useChat } from "@ai-sdk/react";
import { upload } from "@vercel/blob/client";
import { DefaultChatTransport } from "ai";

import { useEffect, useRef, useState } from "react";

import ChatMessage from "@/components/chat-message";

const STARTERS = [
  "What does this brand refuse to do?",
  "How should I write for this audience?",
  "What has been tried before that did not work?",
];

const MAX_TEXTAREA_HEIGHT = 200;
const MAX_IMAGES = 4;

/** The question a given assistant turn was answering — the nearest
 * preceding user message in the same conversation, for the trace diagram
 * (src/components/answer-trace.js). */
function precedingUserText(messages, index) {
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    return (messages[i].parts ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
  }
  return undefined;
}

function ModelPicker({ families, modelId, onChange, requireVision }) {
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
                {group.models.map((model) => {
                  const disabled = requireVision && !model.vision;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      disabled={disabled}
                      title={disabled ? "Does not support image input" : undefined}
                      onClick={() => {
                        onChange(model.id);
                        setOpen(false);
                      }}
                      className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        disabled
                          ? "cursor-not-allowed text-zinc-300 dark:text-zinc-700"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      } ${
                        model.id === modelId && !disabled
                          ? "text-zinc-950 dark:text-zinc-50"
                          : disabled
                            ? ""
                            : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {model.label}
                    </button>
                  );
                })}
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

function AttachmentStrip({ attachments, onRemove }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-1">
      {attachments.map((a) => (
        <div key={a.id} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not an optimizable asset */}
          <img
            src={a.previewUrl}
            alt={a.file.name}
            className={`h-16 w-16 rounded-xl object-cover ${a.status === "uploading" ? "opacity-50" : ""}`}
          />
          {a.status === "uploading" ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            aria-label="Remove image"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950 text-white shadow dark:bg-zinc-50 dark:text-zinc-950"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default function AskChat({ brandSlug, families, defaultModelId }) {
  const [modelId, setModelId] = useState(defaultModelId);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  // One id per mounted conversation; the server records history under it.
  const [chatId] = useState(() => crypto.randomUUID());
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/brands/${brandSlug}/chat`,
      body: () => ({ modelId, chatId }),
    }),
  });

  const busy = status === "submitted" || status === "streaming";
  const currentModel = families
    .flatMap((group) => group.models)
    .find((model) => model.id === modelId);
  const hasImages = attachments.length > 0;
  const needsVisionSwitch = hasImages && !currentModel?.vision;
  const uploading = attachments.some((a) => a.status === "uploading");
  const readyImages = attachments.filter((a) => a.status === "done");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  async function handleFilesSelected(fileList) {
    const files = Array.from(fileList ?? []).slice(
      0,
      Math.max(0, MAX_IMAGES - attachments.length),
    );
    if (!files.length) return;

    const pending = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
    }));
    setAttachments((prev) => [...prev, ...pending]);

    for (const item of pending) {
      try {
        // Private, like every other brand upload — the model reads it via a
        // server-side base64 inline (see the chat route), and the browser
        // reads it back through /api/brands/[slug]/chat/image, which is the
        // only thing that can present a store-token-authenticated fetch.
        const blob = await upload(
          `${brandSlug}/chat/${crypto.randomUUID()}-${item.file.name}`,
          item.file,
          {
            access: "private",
            handleUploadUrl: "/api/blob/upload",
            clientPayload: JSON.stringify({ brandSlug, kind: "chat-image" }),
          },
        );
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === item.id
              ? { ...a, status: "done", url: blob.url, mediaType: item.file.type }
              : a,
          ),
        );
      } catch (err) {
        setAttachments((prev) => prev.filter((a) => a.id !== item.id));
        console.error("image upload failed", err);
      }
    }
  }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  function submit(text) {
    const trimmed = text.trim();
    if (busy || uploading || needsVisionSwitch) return;
    if (!trimmed && readyImages.length === 0) return;

    sendMessage({
      text: trimmed,
      files: readyImages.map((a) => ({
        type: "file",
        mediaType: a.mediaType,
        url: a.url,
        filename: a.file.name,
      })),
    });
    setInput("");
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
    requestAnimationFrame(resizeTextarea);
  }

  const canSubmit =
    !busy && !uploading && !needsVisionSwitch && (input.trim() || readyImages.length > 0);

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

        {messages.map((message, index) => (
          <ChatMessage
            key={message.id}
            role={message.role}
            parts={message.parts}
            metadata={message.metadata}
            brandSlug={brandSlug}
            query={message.role === "assistant" ? precedingUserText(messages, index) : undefined}
            fallbackModelId={modelId}
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
        className="sticky bottom-0 mt-8 space-y-2 pb-6 pt-4"
      >
        <AttachmentStrip attachments={attachments} onRemove={removeAttachment} />

        <div className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-zinc-50 p-2 shadow-sm focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(event) => {
              handleFilesSelected(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_IMAGES}
            aria-label="Attach image"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-200 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path
                d="M4 10.5l2.5-2.5a1.5 1.5 0 012 0l2 2M9 8l1.5-1.5a1.5 1.5 0 012 0L14 8"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="2"
                y="3"
                width="12"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <circle cx="5.5" cy="6" r="1" fill="currentColor" />
            </svg>
          </button>
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
              disabled={!canSubmit}
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
          <ModelPicker
            families={families}
            modelId={modelId}
            onChange={setModelId}
            requireVision={hasImages}
          />
          {needsVisionSwitch ? (
            <p className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
              Switch to a vision model to send an image
            </p>
          ) : (
            <p className="font-mono text-[10px] text-zinc-400">
              Enter to send · Shift+Enter for new line
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
