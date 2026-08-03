"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getBrandAccess } from "@/lib/auth/dal";
import { linesToArray, PRISM_FACETS, profileToText } from "@/lib/brand-profile";
import { db } from "@/lib/db/client";
import { brandProfiles, documents } from "@/lib/db/schema";
import { ingestDocument } from "@/lib/ingest/pipeline";
import { sanitizeRichText } from "@/lib/rich-text/sanitize";

const textField = z.string().trim().max(4000);
// HTML is bulkier than the text it renders — 3x the plain-text cap is
// generous headroom, not a typo.
const richTextField = z.string().trim().max(12_000).optional();

export async function saveBrandProfileAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const access = await getBrandAccess(slug, "admin");
  if (!access) return { error: "You do not have permission to edit this." };

  const mission = textField.safeParse(formData.get("mission") ?? "");
  const audience = textField.safeParse(formData.get("audience") ?? "");
  const missionHtml = richTextField.safeParse(formData.get("missionHtml") ?? "");
  const audienceHtml = richTextField.safeParse(formData.get("audienceHtml") ?? "");
  if (!mission.success || !audience.success || !missionHtml.success || !audienceHtml.success) {
    return { error: "Mission and audience must be under 4000 characters." };
  }

  const prism = {};
  const prismHtml = {};
  for (const facet of PRISM_FACETS) {
    const parsed = textField.safeParse(formData.get(`prism_${facet.key}`) ?? "");
    const parsedHtml = richTextField.safeParse(
      formData.get(`prism_${facet.key}_html`) ?? "",
    );
    if (!parsed.success || !parsedHtml.success) {
      return { error: `${facet.label} must be under 4000 characters.` };
    }
    if (parsed.data) {
      prism[facet.key] = parsed.data;
      // prismHtml is null exactly when the plain text is empty — decided by
      // the plain text, since an empty Tiptap doc serializes to "<p></p>",
      // not "". Both are written together below, never independently.
      prismHtml[facet.key] = sanitizeRichText(parsedHtml.data, "compact");
    }
  }

  const profile = {
    mission: mission.data || null,
    missionHtml: mission.data ? sanitizeRichText(missionHtml.data, "compact") : null,
    audience: audience.data || null,
    audienceHtml: audience.data ? sanitizeRichText(audienceHtml.data, "compact") : null,
    values: linesToArray(formData.get("values")),
    tone: linesToArray(formData.get("tone")),
    dos: linesToArray(formData.get("dos")),
    donts: linesToArray(formData.get("donts")),
    visual: linesToArray(formData.get("visual")),
    prism,
    prismHtml,
    rules: linesToArray(formData.get("rules")),
  };

  await db
    .insert(brandProfiles)
    .values({ brandId: access.brandId, ...profile, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: brandProfiles.brandId,
      set: { ...profile, updatedAt: new Date() },
    });

  // The profile is also indexed as a document, so retrieval can cite it the way
  // it cites a brand book — it is the most on-brand text that exists.
  const body = profileToText(profile, access.name);

  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.brandId, access.brandId),
        eq(documents.sourceType, "profile"),
      ),
    )
    .limit(1);

  let documentId = existing?.id;

  if (documentId) {
    await db
      .update(documents)
      .set({ body, status: "pending", error: null, updatedAt: new Date() })
      .where(eq(documents.id, documentId));
  } else {
    const [created] = await db
      .insert(documents)
      .values({
        brandId: access.brandId,
        title: `${access.name} — brand profile`,
        sourceType: "profile",
        body,
        createdBy: access.userId,
        status: "pending",
      })
      .returning({ id: documents.id });
    documentId = created.id;
  }

  try {
    await ingestDocument(documentId);
  } catch (error) {
    // The profile itself saved; only indexing failed. Say so rather than
    // pretending the whole save went wrong.
    revalidatePath(`/brand/${slug}/profile`);
    return {
      ok: true,
      warning: `Saved, but indexing failed: ${String(error?.message ?? error)}`,
    };
  }

  revalidatePath(`/brand/${slug}/profile`);
  revalidatePath(`/brand/${slug}`);
  return { ok: true };
}
