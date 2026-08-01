/**
 * Exercises the ingestion parsing and chunking against real bytes.
 *
 * PDF and DOCX extraction is the part most likely to break silently: a wrong
 * SDK shape still builds and lints, and only fails when someone uploads a brand
 * book. This needs no network and no API keys.
 *
 *   npm run verify:ingest
 */
import { chunkText } from "../src/lib/ingest/chunk.js";
import { extractText, htmlToText } from "../src/lib/ingest/parse.js";

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${error.message}`);
  }
};

/** Smallest structurally valid PDF that carries extractable text. */
function tinyPdf(text) {
  const stream = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

await check("PDF extraction via unpdf", async () => {
  const buffer = tinyPdf("Never use the logo on a photograph");
  const { text, kind } = await extractText({
    buffer,
    mime: "application/pdf",
    filename: "brand-book.pdf",
  });
  if (kind !== "pdf") throw new Error(`detected kind "${kind}"`);
  if (!text.includes("logo on a photograph")) {
    throw new Error(`extracted text missing expected phrase: "${text.slice(0, 120)}"`);
  }
  return `${text.length} chars`;
});

await check("plain text and markdown", async () => {
  const { text, kind } = await extractText({
    buffer: Buffer.from("# Tone\n\nDry,   never   zany.\r\n\r\n\r\n\r\nPlain words."),
    mime: "text/markdown",
    filename: "tone.md",
  });
  if (kind !== "text") throw new Error(`detected kind "${kind}"`);
  if (text.includes("   ")) throw new Error("runs of spaces were not collapsed");
  if (/\n{3,}/.test(text)) throw new Error("blank-line runs were not collapsed");
  return "normalised";
});

await check("unsupported type is rejected with a usable message", async () => {
  try {
    await extractText({
      buffer: Buffer.from([0x00, 0x01]),
      mime: "image/png",
      filename: "logo.png",
    });
    throw new Error("expected a rejection, got none");
  } catch (error) {
    if (!error.message.includes("Unsupported file type")) throw error;
    return "rejected";
  }
});

await check("htmlToText strips scripts, styles and tags", () => {
  const text = htmlToText(
    `<html><head><style>.a{color:red}</style><script>var x=1;</script></head>
     <body><h1>Values</h1><p>Plain &amp; direct</p><ul><li>One</li><li>Two</li></ul></body></html>`,
  );
  if (text.includes("color:red") || text.includes("var x")) {
    throw new Error("style or script content leaked into the text");
  }
  if (!text.includes("Plain & direct")) throw new Error("entity not decoded");
  if (!text.includes("One") || !text.includes("Two")) throw new Error("list items lost");
  return JSON.stringify(text.slice(0, 40));
});

await check("chunkText: short input stays one chunk", () => {
  const chunks = chunkText("Short brand note.");
  if (chunks.length !== 1) throw new Error(`got ${chunks.length} chunks`);
  return "1 chunk";
});

await check("chunkText: empty input yields nothing", () => {
  if (chunkText("   \n\n  ").length !== 0) throw new Error("expected no chunks");
  return "0 chunks";
});

await check("chunkText: long input splits, overlaps, and loses no content", () => {
  const sentences = [];
  for (let i = 0; i < 400; i += 1) {
    sentences.push(`Sentence number ${i} about the brand and how it behaves.`);
  }
  const source = sentences.join(" ");
  const chunks = chunkText(source);

  if (chunks.length < 3) throw new Error(`expected several chunks, got ${chunks.length}`);

  const oversized = chunks.filter((c) => c.length > 3200 * 1.1);
  if (oversized.length) throw new Error(`${oversized.length} chunks exceed the target size`);

  // Every sentence must survive somewhere — a gap between chunks would make a
  // passage unretrievable and uncitable.
  const missing = [];
  for (let i = 0; i < 400; i += 1) {
    const needle = `Sentence number ${i} `;
    if (!chunks.some((c) => c.includes(needle))) missing.push(i);
  }
  if (missing.length) {
    throw new Error(`${missing.length} sentences fell into a gap (e.g. ${missing[0]})`);
  }

  // Consecutive chunks should share a tail/head, or a passage straddling the
  // boundary would be retrievable in neither.
  let overlapping = 0;
  for (let i = 0; i < chunks.length - 1; i += 1) {
    const tail = chunks[i].slice(-120);
    if (chunks[i + 1].includes(tail.slice(0, 40))) overlapping += 1;
  }
  if (overlapping === 0) throw new Error("no overlap between any consecutive chunks");

  return `${chunks.length} chunks, ${overlapping} overlapping, no gaps`;
});

await check("chunkText: no infinite loop on pathological input", () => {
  const chunks = chunkText("x".repeat(20000));
  if (chunks.length < 2) throw new Error("did not split");
  return `${chunks.length} chunks`;
});

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
