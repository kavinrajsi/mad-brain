"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runFitCheck } from "@/lib/ai/fit-check";
import { resolveModelId } from "@/lib/ai/models";
import { getBrandAccess } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { getBrandProfile } from "@/lib/db/queries";
import { ideaChecks } from "@/lib/db/schema";

const ideaSchema = z.string().trim().min(10).max(8000);

export async function runFitCheckAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const access = await getBrandAccess(slug, "member");
  if (!access) return { error: "You do not have access to this brand." };

  const idea = ideaSchema.safeParse(formData.get("idea"));
  if (!idea.success) {
    return { error: "Describe the idea in at least 10 characters." };
  }

  // Never pass a client-supplied model id straight through — it could route to
  // an arbitrary or expensive model, or one that cannot honour the schema.
  const modelId = resolveModelId(String(formData.get("modelId") ?? ""));
  const profile = await getBrandProfile(access.brandId);

  let result;
  try {
    result = await runFitCheck({
      brandId: access.brandId,
      brandName: access.name,
      profile,
      idea: idea.data,
      modelId,
    });
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }

  const [saved] = await db
    .insert(ideaChecks)
    .values({
      brandId: access.brandId,
      userId: access.userId,
      ideaText: idea.data,
      modelId,
      overallScore: Math.round(result.overallScore),
      verdict: {
        verdict: result.verdict,
        summary: result.summary,
        pillars: result.pillars,
        risks: result.risks,
        suggestions: result.suggestions,
      },
      citations: result.citations,
      usage: result.usage,
    })
    .returning({ id: ideaChecks.id });

  revalidatePath(`/b/${slug}/history`);

  return { ok: true, checkId: saved.id, result, modelId };
}
