import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";

import { resolveModelId } from "@/lib/ai/models";
import { CHAT_SYSTEM, formatContext } from "@/lib/ai/prompt";
import { chatModel } from "@/lib/ai/providers";
import { retrieveBrandContext } from "@/lib/ai/retrieve";
import { summarizeUsage } from "@/lib/ai/usage";
import { authorizeBrandApi } from "@/lib/auth/dal";
import { saveChat } from "@/lib/db/queries";

export const maxDuration = 120;

const schema = z.object({
  messages: z.array(z.any()).min(1),
  modelId: z.string().optional(),
  chatId: z.string().uuid(),
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

  // Awaited: convertToModelMessages returns a Promise in AI SDK v7. Without the
  // await this spreads a Promise and throws "modelMessages is not iterable" on
  // every single chat turn.
  const modelMessages = await convertToModelMessages(payload.messages);

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

  // Chunks arrive ranked by score, so first-seen order is best-match order.
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.documentId)) continue;
    seen.add(chunk.documentId);
    sources.push({ documentId: chunk.documentId, title: chunk.documentTitle });
  }
  let finishStepCostUsd = null;

  const result = streamText({
    model: chatModel(resolveModelId(payload.modelId ?? "")),
    system: `${CHAT_SYSTEM}\n\nBrand: ${access.name}\n\nCONTEXT\n${
      chunks.length
        ? formatContext(chunks)
        : "(No indexed documents matched this question.)"
    }`,
    messages: modelMessages,
    // Uncapped, the provider reserves the model's whole output window and
    // refuses the call on a low balance — OpenRouter quoted 65536 tokens for
    // an answer the system prompt asks to keep short.
    maxOutputTokens: 4000,
  });

  // Keeps the model stream running to completion even if the person closes the
  // tab mid-answer, so onEnd still fires and the turn is persisted.
  result.consumeStream();

  return result.toUIMessageStreamResponse({
    // With originalMessages, onEnd receives the full conversation as
    // UIMessages (parts + metadata) instead of just the response deltas.
    originalMessages: payload.messages,
    generateMessageId: () => crypto.randomUUID(),
    // Emitted on stream start so the sources list renders before the answer
    // finishes streaming; usage lands on finish. Both merge into one
    // metadata object server-side (AI SDK merges across messageMetadata
    // calls), so this route has no tool-calling loop — exactly one
    // finish-step fires, so stashing its cost for the finish part needs no
    // cross-step summing.
    messageMetadata: ({ part }) => {
      if (part.type === "start" && sources.length) return { sources };
      if (part.type === "finish-step") {
        finishStepCostUsd = part.providerMetadata?.openrouter?.usage?.cost ?? null;
        return undefined;
      }
      if (part.type === "finish") {
        return {
          usage: {
            ...summarizeUsage(part.totalUsage, undefined),
            costUsd: finishStepCostUsd,
          },
        };
      }
    },
    onEnd: async ({ messages }) => {
      try {
        await saveChat({
          chatId: payload.chatId,
          brandId: access.brandId,
          userId: access.userId,
          modelId: resolveModelId(payload.modelId ?? ""),
          title: query.slice(0, 120) || "Untitled chat",
          messages,
        });
      } catch (error) {
        // Persistence is best-effort: a failed save must not turn a delivered
        // answer into a client-visible error.
        console.error("chat history save failed", error);
      }
    },
    // The default masks every failure as "An error occurred", which leaves the
    // user staring at a dead chat box. Provider messages here are operational —
    // out of credits, model unavailable, context too long — and are what the
    // person needs in order to act.
    onError: (error) =>
      String(error?.message ?? error) || "The model did not respond.",
  });
}
