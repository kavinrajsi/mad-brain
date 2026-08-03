import { convertToModelMessages, streamText } from "ai";
import { z } from "zod";

import { resolveModelId } from "@/lib/ai/models";
import { CHAT_SYSTEM, formatContext } from "@/lib/ai/prompt";
import { chatModel } from "@/lib/ai/providers";
import { retrieveBrandContext } from "@/lib/ai/retrieve";
import { summarizeUsage } from "@/lib/ai/usage";
import { authorizeBrandApi } from "@/lib/auth/dal";
import { saveChat } from "@/lib/db/queries";
import { assertBrandBlobUrl } from "@/lib/ingest/url-guard";

export const maxDuration = 120;

const schema = z.object({
  messages: z.array(z.any()).min(1),
  modelId: z.string().optional(),
  chatId: z.string().uuid(),
});

/**
 * Images attach as private Blob URLs (same access model as every other brand
 * upload) — not fetchable by the model provider without a store token. Only
 * the model-facing copy of the messages gets the swap: originalMessages
 * (used for persistence) keeps the real blob URL, so History's transcript
 * viewer can re-request it through /api/brands/[slug]/chat/image later
 * instead of the message row growing a multi-MB base64 string forever.
 */
async function inlineImages(messages) {
  const { get } = await import("@vercel/blob");
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      parts: await Promise.all(
        (message.parts ?? []).map(async (part) => {
          if (part.type !== "file" || !part.mediaType?.startsWith("image/")) {
            return part;
          }
          const blob = await get(part.url, { access: "private" });
          if (!blob?.stream) return part;
          const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer());
          return {
            ...part,
            url: `data:${part.mediaType};base64,${buffer.toString("base64")}`,
          };
        }),
      ),
    })),
  );
}

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

  // A client-supplied image URL is untrusted input, same as blobUrl on the
  // documents route — reject anything that isn't this brand's own blob
  // before it ever reaches convertToModelMessages/the model provider.
  try {
    for (const message of payload.messages) {
      for (const part of message.parts ?? []) {
        if (part.type === "file") assertBrandBlobUrl(part.url, slug);
      }
    }
  } catch (error) {
    return Response.json({ error: String(error?.message ?? error) }, { status: 400 });
  }

  // Awaited: convertToModelMessages returns a Promise in AI SDK v7. Without the
  // await this spreads a Promise and throws "modelMessages is not iterable" on
  // every single chat turn.
  const modelMessages = await convertToModelMessages(
    await inlineImages(payload.messages),
  );

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

  // One entry per chunk (not deduped), indexed to match the [n] labels
  // formatContext gives the model — lets inline citation markers in the
  // streamed answer resolve back to a document.
  const citations = chunks.map((chunk, index) => ({
    index: index + 1,
    documentId: chunk.documentId,
    title: chunk.documentTitle,
    snippet: chunk.content.slice(0, 220).trim(),
  }));
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
      if (part.type === "start" && sources.length) return { sources, citations };
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
