import "server-only";

import sanitizeHtml from "sanitize-html";

const BASE_OPTIONS = {
  // Blocks javascript: links — the one real XSS vector the Link mark opens.
  allowedSchemes: ["http", "https", "mailto"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform(
      "a",
      { rel: "noreferrer noopener", target: "_blank" },
      true,
    ),
  },
};

const PRESETS = {
  notes: {
    ...BASE_OPTIONS,
    allowedTags: [
      "p", "br", "hr",
      "h1", "h2", "h3",
      "strong", "em", "u", "s", "code",
      "blockquote", "pre",
      "ul", "ol", "li",
      "a",
    ],
  },
  compact: {
    ...BASE_OPTIONS,
    allowedTags: ["p", "br", "strong", "em", "a"],
  },
};

/**
 * Sanitizes Tiptap-produced HTML against an allowlist matching the editor
 * preset's actual schema. Defense-in-depth: a request can be POSTed directly
 * to the server action/API route with hand-crafted HTML, bypassing the
 * client editor entirely — without this, that HTML would render verbatim
 * (via dangerouslySetInnerHTML) for every brand member who later opens the
 * document/profile.
 *
 * Returns null for empty input so callers can store NULL rather than an
 * empty tag soup, matching the "no bodyHtml means fall back to plain text"
 * contract the read views rely on.
 */
export function sanitizeRichText(html, preset) {
  const raw = String(html ?? "").trim();
  if (!raw) return null;
  return sanitizeHtml(raw, PRESETS[preset]);
}
