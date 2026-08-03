import { get } from "@vercel/blob";

import { authorizeBrandApi } from "@/lib/auth/dal";
import { assertBrandBlobUrl } from "@/lib/ingest/url-guard";

/**
 * Streams a chat-attached image back to the browser.
 *
 * Attachments are private Blob URLs (same as every other brand upload) —
 * only a store-token-authenticated server request can read them, which a
 * plain <img src> can never do. This route is that authenticated read,
 * gated the same way every other brand resource is: membership first, then
 * a brand-ownership check on the URL itself before trusting it.
 */
export async function GET(request, { params }) {
  const { slug } = await params;
  const { response } = await authorizeBrandApi(slug, "member");
  if (response) return response;

  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) return Response.json({ error: "missing_url" }, { status: 400 });

  let blobUrl;
  try {
    blobUrl = assertBrandBlobUrl(rawUrl, slug);
  } catch (error) {
    return Response.json({ error: String(error?.message ?? error) }, { status: 400 });
  }

  const blob = await get(blobUrl, { access: "private" });
  if (!blob?.stream) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return new Response(blob.stream, {
    headers: {
      "Content-Type": blob.contentType || "application/octet-stream",
      // Private cache only — this is brand-confidential imagery, never a CDN.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
