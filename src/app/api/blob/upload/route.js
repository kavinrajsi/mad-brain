import { handleUpload } from "@vercel/blob/client";

import { getBrandAccess } from "@/lib/auth/dal";
import { brandBlobPrefix } from "@/lib/ingest/url-guard";

/**
 * Issues a short-lived token so the browser can upload straight to Blob.
 *
 * The file itself never passes through this function. That avoids the 1MB
 * Server Action body cap and, more importantly, the proxy body-buffer limit,
 * which truncates oversized bodies silently rather than rejecting them — a
 * brand book would arrive quietly cut in half.
 *
 * This route is excluded from the proxy matcher, so authorisation is enforced
 * here and nowhere else.
 */
export async function POST(request) {
  const body = await request.json();

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { brandSlug } = JSON.parse(clientPayload ?? "{}");

        // Re-checked here because the client chose the brand — a valid session
        // for brand A must not mint an upload token for brand B.
        const access = await getBrandAccess(brandSlug, "admin");
        if (!access) {
          throw new Error("You do not have permission to upload to this brand.");
        }

        // The token is bound to this pathname, so pinning the prefix here is
        // what stops one brand writing into another brand's folder. Document
        // creation checks the same prefix on the way back in.
        if (!pathname.startsWith(brandBlobPrefix(brandSlug))) {
          throw new Error("Upload path does not match this brand.");
        }

        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/markdown",
            "text/csv",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ brandId: access.brandId }),
        };
      },
      // onUploadCompleted is deliberately omitted. It is optional, and supplying
      // it makes the SDK derive a callbackUrl from this request — which Vercel
      // Blob then tries to reach. On localhost that host is unreachable, so it
      // would break local development for no benefit: the document row is
      // created by an authenticated follow-up call from the client instead.
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: String(error?.message ?? error) },
      { status: 400 },
    );
  }
}
