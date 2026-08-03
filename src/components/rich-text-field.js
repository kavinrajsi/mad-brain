"use client";

import { useRef, useState } from "react";

import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
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

const TOOLBAR_ITEMS = {
  notes: [
    { label: "B", name: "bold", run: (e) => e.chain().focus().toggleBold().run() },
    { label: "I", name: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
    { label: "U", name: "underline", run: (e) => e.chain().focus().toggleUnderline().run() },
    { label: "S", name: "strike", run: (e) => e.chain().focus().toggleStrike().run() },
    { label: "</>", name: "code", run: (e) => e.chain().focus().toggleCode().run() },
    {
      label: "H1",
      name: "heading",
      attrs: { level: 1 },
      run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "H2",
      name: "heading",
      attrs: { level: 2 },
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    { label: "•", name: "bulletList", run: (e) => e.chain().focus().toggleBulletList().run() },
    { label: "1.", name: "orderedList", run: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: "”", name: "blockquote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  ],
  compact: [
    { label: "B", name: "bold", run: (e) => e.chain().focus().toggleBold().run() },
    { label: "I", name: "italic", run: (e) => e.chain().focus().toggleItalic().run() },
  ],
};

const TOOLBAR_BUTTON_CLASS =
  "rounded px-2 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50";
const TOOLBAR_BUTTON_ACTIVE_CLASS = "bg-zinc-800 text-zinc-50";

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

function LinkButton({ editor }) {
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
        className="w-40 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-50 outline-none placeholder:text-zinc-500"
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
      className={`${TOOLBAR_BUTTON_CLASS} ${editor.isActive("link") ? TOOLBAR_BUTTON_ACTIVE_CLASS : ""}`}
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

  const items = TOOLBAR_ITEMS[preset] ?? TOOLBAR_ITEMS.notes;

  return (
    <div>
      <textarea ref={textareaRef} id={id} name={name} defaultValue={defaultValue} className="hidden" />
      <input ref={htmlInputRef} type="hidden" name={resolvedHtmlName} defaultValue={defaultHtml ?? ""} />

      {editor && !readOnly ? (
        <BubbleMenu editor={editor} className="flex items-center gap-0.5 rounded-lg bg-zinc-950 p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => item.run(editor)}
              className={`${TOOLBAR_BUTTON_CLASS} ${editor.isActive(item.name, item.attrs) ? TOOLBAR_BUTTON_ACTIVE_CLASS : ""}`}
            >
              {item.label}
            </button>
          ))}
          <LinkButton editor={editor} />
        </BubbleMenu>
      ) : null}

      <div
        className={`rounded-lg border border-zinc-300 bg-transparent px-3 py-2 focus-within:border-zinc-500 dark:border-zinc-700 ${minHeightClass} ${readOnly ? "opacity-70" : ""}`}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
