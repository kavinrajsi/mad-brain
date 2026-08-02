import { eq } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import { authorizeBrandApi } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { ingestDocument } from "@/lib/ingest/pipeline";
import { assertBrandBlobUrl, assertPublicHttpUrl } from "@/lib/ingest/url-guard";

// Ingestion runs in after(), whose budget is this route's maxDuration. A large
// brand book takes far longer than the default.
export const maxDuration = 300;

const schema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("upload"),
    title: z.string().trim().min(1).max(200),
    blobUrl: z.string().url(),
    mime: z.string().max(200).optional(),
  }),
  z.object({
    sourceType: z.literal("url"),
    title: z.string().trim().min(1).max(200),
    sourceUrl: z.string().url(),
  }),
  z.object({
    sourceType: z.literal("note"),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(200_000),
  }),
]);

export async function POST(request, { params }) {
  const { slug } = await params;
  const { access, response } = await authorizeBrandApi(slug, "admin");
  if (response) return response;

  let payload;
  try {
    payload = schema.parse(await request.json());
  } catch (error) {
    return Response.json(
      { error: "invalid_payload", detail: error?.issues ?? null },
      { status: 400 },
    );
  }

  // Both URLs arrive from the browser, so both are checked here rather than at
  // fetch time: a pasted page must be a public http(s) host, and an uploaded
  // file must be a private blob stored under this brand's prefix.
  try {
    if (payload.sourceType === "url") assertPublicHttpUrl(payload.sourceUrl);
    if (payload.sourceType === "upload") {
      assertBrandBlobUrl(payload.blobUrl, slug);
    }
  } catch (error) {
    return Response.json(
      { error: String(error?.message ?? error) },
      { status: 400 },
    );
  }

  const [doc] = await db
    .insert(documents)
    .values({
      brandId: access.brandId,
      title: payload.title,
      sourceType: payload.sourceType,
      blobUrl: payload.sourceType === "upload" ? payload.blobUrl : null,
      sourceUrl: payload.sourceType === "url" ? payload.sourceUrl : null,
      mime: payload.sourceType === "upload" ? (payload.mime ?? null) : null,
      body: payload.sourceType === "note" ? payload.body : null,
      createdBy: access.userId,
      status: "pending",
    })
    .returning();

  // Respond immediately and index in the background. The client polls the
  // document's status, so a slow PDF never blocks the request.
  after(async () => {
    try {
      await ingestDocument(doc.id);
    } catch {
      // ingestDocument already records the failure on the row.
    }
  });

  return Response.json({ document: { id: doc.id, status: doc.status } });
}

/** Polled by the knowledge page while documents are indexing. */
export async function GET(request, { params }) {
  const { slug } = await params;
  const { access, response } = await authorizeBrandApi(slug, "member");
  if (response) return response;

  const rows = await db
    .select({
      id: documents.id,
      status: documents.status,
      error: documents.error,
    })
    .from(documents)
    .where(eq(documents.brandId, access.brandId));

  return Response.json({ documents: rows });
}
