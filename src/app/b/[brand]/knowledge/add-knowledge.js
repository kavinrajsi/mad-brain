"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const TABS = [
  { key: "upload", label: "Upload a file" },
  { key: "note", label: "Write a note" },
  { key: "url", label: "Ingest a link" },
];

export default function AddKnowledge({ brandSlug }) {
  const router = useRouter();
  const [tab, setTab] = useState("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  async function createDocument(payload) {
    const response = await fetch(`/api/brands/${brandSlug}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not add this document.");
    }
    return response.json();
  }

  async function handleUpload(event) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      // Straight to Blob — the file never passes through our server. Private
      // access, because brand books are confidential: the URL alone grants
      // nothing without a token.
      const blob = await upload(file.name, file, {
        access: "private",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ brandSlug }),
      });

      await createDocument({
        sourceType: "upload",
        title: file.name,
        blobUrl: blob.url,
        mime: file.type || undefined,
      });

      fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSimple(event, build) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await createDocument(build(form));
      event.target.reset();
      router.refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex gap-1 border-b border-zinc-200 px-3 pt-3 dark:border-zinc-800">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setError(null);
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              tab === item.key
                ? "border-zinc-950 text-zinc-950 dark:border-zinc-50 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === "upload" ? (
          <form onSubmit={handleUpload} className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              required
              accept=".pdf,.docx,.md,.markdown,.txt,.csv"
              className="flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-zinc-900 dark:file:text-zinc-200"
            />
            <SubmitButton busy={busy} label="Upload" />
            <p className="w-full text-xs text-zinc-500">
              PDF, DOCX, Markdown, text or CSV. Up to 25MB.
            </p>
          </form>
        ) : null}

        {tab === "note" ? (
          <form
            onSubmit={(e) =>
              handleSimple(e, (form) => ({
                sourceType: "note",
                title: String(form.get("title")),
                body: String(form.get("body")),
              }))
            }
            className="flex flex-col gap-2"
          >
            <input
              name="title"
              required
              maxLength={200}
              placeholder="What is this about?"
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
            />
            <textarea
              name="body"
              required
              rows={6}
              placeholder="Campaign learnings, past decisions, tribal knowledge — anything a new joiner would otherwise have to ask about."
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
            />
            <SubmitButton busy={busy} label="Save note" align="self-start" />
          </form>
        ) : null}

        {tab === "url" ? (
          <form
            onSubmit={(e) =>
              handleSimple(e, (form) => ({
                sourceType: "url",
                title: String(form.get("title")),
                sourceUrl: String(form.get("sourceUrl")),
              }))
            }
            className="flex flex-col gap-2"
          >
            <input
              name="title"
              required
              maxLength={200}
              placeholder="Title"
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
            />
            <input
              name="sourceUrl"
              type="url"
              required
              placeholder="https://…"
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
            />
            <SubmitButton busy={busy} label="Ingest" align="self-start" />
          </form>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    </section>
  );
}

function SubmitButton({ busy, label, align = "" }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={`${align} rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950`}
    >
      {busy ? "Working…" : label}
    </button>
  );
}
