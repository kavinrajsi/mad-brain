"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import RichTextField from "@/components/rich-text-field";

const TABS = [
  { key: "upload", label: "Upload a file" },
  { key: "note", label: "Write a note" },
  { key: "url", label: "Ingest a link" },
];

async function createDocument(brandSlug, payload) {
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

// Straight to Blob — the file never passes through our server. Private
// access, because brand books are confidential: the URL alone grants nothing
// without a token. Stored under the brand's prefix, so one brand's files
// stay in one brand's folder. Shared by the Upload tab and QuickCapture's
// paste/drop handling — same file, two ways to trigger it.
async function uploadFile(brandSlug, file) {
  const blob = await upload(`${brandSlug}/${file.name}`, file, {
    access: "private",
    handleUploadUrl: "/api/blob/upload",
    clientPayload: JSON.stringify({ brandSlug }),
  });
  return createDocument(brandSlug, {
    sourceType: "upload",
    title: file.name,
    blobUrl: blob.url,
    mime: file.type || undefined,
  });
}

export default function AddKnowledge({ brandSlug }) {
  const router = useRouter();
  const [tab, setTab] = useState("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  // RichTextField is uncontrolled and ignores a native form reset (it only
  // clears form controls, not the ProseMirror DOM) — bumping this key forces
  // the note tab to remount with a fresh, empty editor after a save.
  const [noteKey, setNoteKey] = useState(0);

  async function handleUpload(event) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      await uploadFile(brandSlug, file);
      fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSimple(event, build, { onSaved } = {}) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await createDocument(brandSlug, build(form));
      event.target.reset();
      onSaved?.();
      router.refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <QuickCapture brandSlug={brandSlug} />

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
              key={noteKey}
              onSubmit={(e) => {
                const form = new FormData(e.currentTarget);
                // A hidden textarea participates in no HTML5 `required`
                // validation, so the emptiness check that used to come free
                // from <textarea required> has to be explicit now.
                if (!String(form.get("body") ?? "").trim()) {
                  e.preventDefault();
                  setError("Write something first.");
                  return;
                }
                handleSimple(
                  e,
                  (form) => ({
                    sourceType: "note",
                    title: String(form.get("title")),
                    body: String(form.get("body")),
                    bodyHtml: String(form.get("bodyHtml") ?? ""),
                  }),
                  { onSaved: () => setNoteKey((k) => k + 1) },
                );
              }}
              className="flex flex-col gap-2"
            >
              <input
                name="title"
                required
                maxLength={200}
                placeholder="What is this about?"
                className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
              />
              <RichTextField
                name="body"
                htmlName="bodyHtml"
                preset="notes"
                placeholder="Campaign learnings, past decisions, tribal knowledge — anything a new joiner would otherwise have to ask about."
                minHeightClass="min-h-40"
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
    </>
  );
}

const MAX_QUICK_CAPTURE_HEIGHT = 300;

/** True only when the whole trimmed input is a single link — no surrounding
 * prose. Prose that happens to contain a URL is captured as a note instead,
 * since the URL-ingest path fetches and re-extracts page content, which
 * doesn't make sense for mixed text. */
function isBareUrl(text) {
  if (/\s/.test(text)) return false;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveUrlTitle(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const path = pathname === "/" ? "" : pathname;
    return `${host}${path}`.slice(0, 200);
  } catch {
    return url.slice(0, 200);
  }
}

function deriveNoteTitle(text) {
  const firstLine = text.split("\n").find((line) => line.trim().length > 0) ?? "";
  const trimmed = firstLine.trim();
  if (!trimmed) return "Untitled capture";
  return trimmed.length > 80 ? `${trimmed.slice(0, 80).trimEnd()}…` : trimmed;
}

function QuickCapture({ brandSlug }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_QUICK_CAPTURE_HEIGHT)}px`;
  }

  async function capture(build) {
    setBusy(true);
    setError(null);
    try {
      await build();
      setText("");
      requestAnimationFrame(resizeTextarea);
      router.refresh();
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  function captureFile(file) {
    return capture(() => uploadFile(brandSlug, file));
  }

  function captureText(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    return capture(() =>
      isBareUrl(trimmed)
        ? createDocument(brandSlug, {
            sourceType: "url",
            title: deriveUrlTitle(trimmed),
            sourceUrl: trimmed,
          })
        : createDocument(brandSlug, {
            sourceType: "note",
            title: deriveNoteTitle(trimmed),
            body: trimmed,
          }),
    );
  }

  return (
    <div className="mt-8">
      <p className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-400">
        Quick capture
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          captureText(text);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer?.files?.[0];
          if (file) captureFile(file);
        }}
        onDragOver={(event) => event.preventDefault()}
        className="flex items-end gap-2 rounded-2xl border border-zinc-300 bg-zinc-50 p-2 shadow-sm focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            resizeTextarea();
          }}
          onPaste={(event) => {
            const file = event.clipboardData?.files?.[0];
            if (file) {
              event.preventDefault();
              captureFile(file);
            }
          }}
          rows={1}
          placeholder="Paste anything — a link, notes, a screenshot…"
          className="max-h-[300px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-zinc-400"
        />
        <SubmitButton busy={busy} label="Capture" />
      </form>
      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
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
