import "server-only";

/**
 * Turns an uploaded file into plain text.
 *
 * unpdf is used for PDFs because it ships a serverless-safe pdf.js build with no
 * native dependencies — pdf-parse and friends need a filesystem and break on
 * Vercel Functions.
 */
export async function extractText({ buffer, mime, filename = "" }) {
  const kind = detectKind({ mime, filename });

  switch (kind) {
    case "pdf": {
      const { extractText: extractPdfText, getDocumentProxy } = await import(
        "unpdf"
      );
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractPdfText(pdf, { mergePages: true });
      return { text: normalise(text), kind };
    }

    case "docx": {
      const mammoth = (await import("mammoth")).default;
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: normalise(value), kind };
    }

    case "text": {
      return { text: normalise(buffer.toString("utf8")), kind };
    }

    default:
      throw new Error(
        `Unsupported file type: ${mime || filename || "unknown"}. Upload a PDF, DOCX, Markdown or plain text file.`,
      );
  }
}

function detectKind({ mime, filename }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return "docx";
  }
  if (
    mime?.startsWith("text/") ||
    mime === "application/json" ||
    ["md", "markdown", "txt", "csv", "json"].includes(ext)
  ) {
    return "text";
  }
  return "unknown";
}

/** Collapses the ragged whitespace PDF extraction leaves behind. */
function normalise(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strips tags from fetched HTML so a pasted URL can be ingested as text. */
export function htmlToText(html) {
  return normalise(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}
