import { handleUpload } from "@vercel/blob/client";

import { getBrandAccess } from "@/lib/auth/dal";

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
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { brandSlug } = JSON.parse(clientPayload ?? "{}");

        // Re-checked here because the client chose the brand — a valid session
        // for brand A must not mint an upload token for brand B.
        const access = await getBrandAccess(brandSlug, "admin");
        if (!access) {
          throw new Error("You do not have permission to upload to this brand.");
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
      onUploadCompleted: async () => {
        // The document row is created by the client in a follow-up call, so
        // there is nothing to do here. Blob requires the callback to exist.
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: String(error?.message ?? error) },
      { status: 400 },
    );
  }
}
