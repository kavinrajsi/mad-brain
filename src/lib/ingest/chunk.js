// Relative rather than aliased so this module can be exercised by a plain
// node script, outside the Next bundler that resolves "@/".
import { CHUNKING } from "../ai/config.js";

/**
 * Splits text into overlapping chunks, preferring to break at a paragraph and
 * falling back to a sentence.
 *
 * Overlap matters for citations: a passage that straddles a boundary would
 * otherwise be retrievable in neither chunk, and the fit checker would cite
 * half a sentence.
 */
export function chunkText(text, options = {}) {
  const {
    targetChars = CHUNKING.targetChars,
    overlapChars = CHUNKING.overlapChars,
    minChars = CHUNKING.minChars,
  } = options;

  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= targetChars) return [clean];

  const chunks = [];
  let cursor = 0;

  while (cursor < clean.length) {
    const hardEnd = Math.min(cursor + targetChars, clean.length);
    let end = hardEnd;

    if (hardEnd < clean.length) {
      // Look for a natural break in the last third of the window.
      const windowStart = cursor + Math.floor(targetChars * 0.66);
      const paragraph = clean.lastIndexOf("\n\n", hardEnd);
      const sentence = clean.lastIndexOf(". ", hardEnd);

      if (paragraph > windowStart) end = paragraph;
      else if (sentence > windowStart) end = sentence + 1;
    }

    const piece = clean.slice(cursor, end).trim();
    if (piece.length >= minChars || end >= clean.length) {
      if (piece) chunks.push(piece);
    }

    if (end >= clean.length) break;
    cursor = Math.max(end - overlapChars, cursor + 1);
  }

  return chunks;
}
