import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";

import { resolveModelId } from "@/lib/ai/models";
import { openrouterModel } from "@/lib/ai/providers";
import { formatContext, retrieveBrandContext } from "@/lib/ai/retrieve";
import { authorizeBrandApi } from "@/lib/auth/dal";

export const maxDuration = 120;

const schema = z.object({
  messages: z.array(z.any()).min(1),
  modelId: z.string().optional(),
});

const SYSTEM = `You answer questions about one brand, for someone who is new to it.

Ground every answer in the CONTEXT passages provided. If the context does not
cover the question, say so plainly and suggest what document would need to be
added — do not fill the gap from general knowledge about the category.

Refer to the brand's documents by title when you use them. Keep answers short
and concrete.`;

export async function POST(request, { params }) {
  const { slug } = await params;
  const { access, response } = await authorizeBrandApi(slug, "member");
  if (response) return response;

  let payload;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const modelMessages = convertToModelMessages(payload.messages);

  // Retrieve against the latest user turn.
  const lastUser = [...modelMessages]
    .reverse()
    .find((message) => message.role === "user");

  const query =
    typeof lastUser?.content === "string"
      ? lastUser.content
      : (lastUser?.content ?? [])
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ");

  const chunks = query
    ? await retrieveBrandContext({ brandId: access.brandId, query })
    : [];

  const result = streamText({
    model: openrouterModel(resolveModelId(payload.modelId ?? "")),
    system: `${SYSTEM}\n\nBrand: ${access.name}\n\nCONTEXT\n${
      chunks.length
        ? formatContext(chunks)
        : "(No indexed documents matched this question.)"
    }`,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
