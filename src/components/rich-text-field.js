"use client";

import { useRef, useState } from "react";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions/placeholder";
import StarterKit from "@tiptap/starter-kit";

/**
 * Shared typography for both the editable surface and the sanitized-HTML
 * read view, so edit and read look identical. Hand-styled per element, same
 * approach as src/components/markdown.js — no typography plugin installed.
 */
export const RICH_TEXT_VIEW_CLASSES =
  "text-sm leading-7 text-zinc-700 dark:text-zinc-300 " +
  "[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
  "[&_strong]:font-semibold [&_strong]:text-zinc-950 dark:[&_strong]:text-zinc-50 " +
  "[&_em]:italic [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:leading-6 " +
  "[&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-zinc-950 dark:[&_h1]:text-zinc-50 " +
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-zinc-950 dark:[&_h2]:text-zinc-50 " +
  "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-950 dark:[&_h3]:text-zinc-50 " +
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-600 dark:[&_blockquote]:border-zinc-700 dark:[&_blockquote]:text-zinc-400 " +
  "[&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] dark:[&_code]:bg-zinc-900 " +
  "[&_a]:underline [&_a]:underline-offset-2 " +
  "[&_hr]:my-5 [&_hr]:border-zinc-200 dark:[&_hr]:border-zinc-800";

// Each item's activeKey maps to a boolean computed once per selection change
// by useToolbarActiveState below, rather than every button calling
// editor.isActive() inline on every render.
const TOOLBAR_ITEMS = {
  notes: [
    { label: "B", activeKey: "bold", run: (e) => e.chain().focus().toggleBold().run() },
    { label: "I", activeKey: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
    { label: "U", activeKey: "underline", run: (e) => e.chain().focus().toggleUnderline().run() },
    { label: "S", activeKey: "strike", run: (e) => e.chain().focus().toggleStrike().run() },
    { label: "</>", activeKey: "code", run: (e) => e.chain().focus().toggleCode().run() },
    {
      label: "H1",
      activeKey: "heading1",
      run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "H2",
      activeKey: "heading2",
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Bullet list",
      icon: "M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z",
      activeKey: "bulletList",
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    { label: "1.", activeKey: "orderedList", run: (e) => e.chain().focus().toggleOrderedList().run() },
    {
      label: "Blockquote",
      icon: "M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z",
      activeKey: "blockquote",
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
  ],
  compact: [
    { label: "B", activeKey: "bold", run: (e) => e.chain().focus().toggleBold().run() },
    { label: "I", activeKey: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
  ],
};

const TOOLBAR_BUTTON_CLASS =
  "rounded px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
const TOOLBAR_BUTTON_ACTIVE_CLASS =
  "bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50";

function extensionsFor(preset, placeholder) {
  const kit =
    preset === "compact"
      ? StarterKit.configure({
          heading: false,
          codeBlock: false,
          code: false,
          blockquote: false,
          horizontalRule: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          listKeymap: false,
          underline: false,
          strike: false,
        })
      : StarterKit;
  return [kit, Placeholder.configure({ placeholder })];
}

/** Never treat old plain text as HTML — a literal "<"/">" a user once typed
 * into the old textarea must not be parsed as a tag. */
function initialContent(defaultHtml, defaultValue) {
  if (defaultHtml) return defaultHtml;
  if (!defaultValue) return "";
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: defaultValue }] }],
  };
}

/** Subscribes to editor selection/content changes so the fixed toolbar's
 * active-button highlighting stays live without re-rendering on every
 * keystroke (useEditorState only re-renders when the selector's result
 * actually changes). */
function useToolbarActiveState(editor) {
  return useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: !!editor?.isActive("bold"),
      italic: !!editor?.isActive("italic"),
      underline: !!editor?.isActive("underline"),
      strike: !!editor?.isActive("strike"),
      code: !!editor?.isActive("code"),
      heading1: !!editor?.isActive("heading", { level: 1 }),
      heading2: !!editor?.isActive("heading", { level: 2 }),
      bulletList: !!editor?.isActive("bulletList"),
      orderedList: !!editor?.isActive("orderedList"),
      blockquote: !!editor?.isActive("blockquote"),
      link: !!editor?.isActive("link"),
    }),
  });
}

function LinkButton({ editor, active }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const url = value.trim();
            const chain = editor.chain().focus().extendMarkRange("link");
            if (url) chain.setLink({ href: url }).run();
            else chain.unsetLink().run();
            setEditing(false);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        onBlur={() => setEditing(false)}
        placeholder="https://…"
        className="w-40 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-950 outline-none placeholder:text-zinc-400 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
    );
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setValue(editor.getAttributes("link").href ?? "");
        setEditing(true);
      }}
      className={`${TOOLBAR_BUTTON_CLASS} ${active ? TOOLBAR_BUTTON_ACTIVE_CLASS : ""}`}
    >
      Link
    </button>
  );
}

export default function RichTextField({
  id,
  name,
  htmlName,
  preset = "notes",
  defaultValue = "",
  defaultHtml = null,
  placeholder,
  readOnly = false,
  minHeightClass = "min-h-32",
}) {
  const textareaRef = useRef(null);
  const htmlInputRef = useRef(null);
  const resolvedHtmlName = htmlName ?? `${name}Html`;

  const editor = useEditor({
    extensions: extensionsFor(preset, placeholder),
    content: initialContent(defaultHtml, defaultValue),
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: `rich-text-editor outline-none ${RICH_TEXT_VIEW_CLASSES}` },
    },
    onUpdate: ({ editor }) => {
      if (textareaRef.current) {
        textareaRef.current.value = editor.getText({ blockSeparator: "\n\n" });
      }
      if (htmlInputRef.current) {
        htmlInputRef.current.value = editor.getHTML();
      }
    },
  });

  const active = useToolbarActiveState(editor);
  const items = TOOLBAR_ITEMS[preset] ?? TOOLBAR_ITEMS.notes;

  return (
    <div>
      <textarea ref={textareaRef} id={id} name={name} defaultValue={defaultValue} className="hidden" />
      <input ref={htmlInputRef} type="hidden" name={resolvedHtmlName} defaultValue={defaultHtml ?? ""} />

      <div
        className={`overflow-hidden rounded-lg border border-zinc-300 focus-within:border-zinc-500 dark:border-zinc-700 ${readOnly ? "opacity-70" : ""}`}
      >
        {editor && !readOnly ? (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-zinc-50 px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                title={item.icon ? item.label : undefined}
                aria-label={item.icon ? item.label : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => item.run(editor)}
                className={`${TOOLBAR_BUTTON_CLASS} ${active?.[item.activeKey] ? TOOLBAR_BUTTON_ACTIVE_CLASS : ""}`}
              >
                {item.icon ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <path d={item.icon} />
                  </svg>
                ) : (
                  item.label
                )}
              </button>
            ))}
            <LinkButton editor={editor} active={active?.link} />
          </div>
        ) : null}

        <div className={`bg-transparent px-3 py-2 ${minHeightClass}`}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
