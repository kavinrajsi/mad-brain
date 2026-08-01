import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";

import { resolveModelId } from "@/lib/ai/models";
import { CHAT_SYSTEM, formatContext } from "@/lib/ai/prompt";
import { openrouterModel } from "@/lib/ai/providers";
import { retrieveBrandContext } from "@/lib/ai/retrieve";
import { authorizeBrandApi } from "@/lib/auth/dal";

export const maxDuration = 120;

const schema = z.object({
  messages: z.array(z.any()).min(1),
  modelId: z.string().optional(),
});

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
    system: `${CHAT_SYSTEM}\n\nBrand: ${access.name}\n\nCONTEXT\n${
      chunks.length
        ? formatContext(chunks)
        : "(No indexed documents matched this question.)"
    }`,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
