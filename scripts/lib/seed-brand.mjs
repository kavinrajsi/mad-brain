/**
 * Shared seeding for brand briefs.
 *
 * A brief arrives as a document written for a designer — tables, arrows, editing
 * instructions. What goes into the knowledge base is the brand's rules as prose,
 * because the retriever returns passages to a model, and a markdown table row
 * shorn of its header reads as noise.
 *
 * Idempotent by (brand slug, document title): re-running replaces the profile
 * and re-ingests every document, so an edited brief can be applied by rerunning.
 */
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";

export async function seedBrand({ slug, name, profile, documents: specs, ownerEmail }) {
  const { db } = await import("../../src/lib/db/client.js");
  const { brandMembers, brandProfiles, brands, documents, invites, users } =
    await import("../../src/lib/db/schema.js");
  const { ingestDocument } = await import("../../src/lib/ingest/pipeline.js");
  const { profileToText } = await import("../../src/lib/brand-profile.js");

  let [brand] = await db.select().from(brands).where(eq(brands.slug, slug));

  if (!brand) {
    [brand] = await db.insert(brands).values({ slug, name }).returning();
    console.log(`Created brand ${slug}.`);
  } else {
    console.log(`Brand ${slug} already exists — refreshing.`);
  }

  await db
    .insert(brandProfiles)
    .values({ brandId: brand.id, ...profile })
    .onConflictDoUpdate({
      target: brandProfiles.brandId,
      set: { ...profile, updatedAt: new Date() },
    });
  console.log("Profile written.");

  // Mirror actions/profile.js: the profile is also indexed as a document so
  // Ask can retrieve and cite it. Without this, a seeded brand's rubric is
  // invisible to chat until someone re-saves the profile form by hand.
  // Rendered from the merged DB row, not the seed's profile object — fields
  // the seed doesn't carry (prism, rules entered in the form) must survive.
  const [mergedProfile] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.brandId, brand.id));
  const profileBody = profileToText(mergedProfile, name);
  const [existingProfileDoc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(eq(documents.brandId, brand.id), eq(documents.sourceType, "profile")),
    )
    .limit(1);

  let profileDocId = existingProfileDoc?.id;
  if (profileDocId) {
    await db
      .update(documents)
      .set({ body: profileBody, status: "pending", error: null, updatedAt: new Date() })
      .where(eq(documents.id, profileDocId));
  } else {
    const [row] = await db
      .insert(documents)
      .values({
        brandId: brand.id,
        title: `${name} — brand profile`,
        sourceType: "profile",
        body: profileBody,
        status: "pending",
      })
      .returning({ id: documents.id });
    profileDocId = row.id;
  }
  const profileIngest = await ingestDocument(profileDocId);
  console.log(`  ${name} — brand profile — ${profileIngest.chunks} chunks`);

  for (const [index, spec] of specs.entries()) {
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.brandId, brand.id), eq(documents.title, spec.title)))
      .limit(1);

    let id = existing?.id;
    if (id) {
      await db
        .update(documents)
        .set({ body: spec.body, pinnedOrder: index + 1, status: "pending" })
        .where(eq(documents.id, id));
    } else {
      const [row] = await db
        .insert(documents)
        .values({
          brandId: brand.id,
          title: spec.title,
          sourceType: "note",
          body: spec.body,
          pinnedOrder: index + 1,
          status: "pending",
        })
        .returning({ id: documents.id });
      id = row.id;
    }

    const { chunks } = await ingestDocument(id);
    console.log(`  ${spec.title} — ${chunks} chunks`);
  }

  if (ownerEmail) {
    const email = ownerEmail.toLowerCase();

    // Seeding often lands on a brand someone already created by hand, in which
    // case an invite would sit unconsumed forever for a person who is already
    // an owner.
    const [member] = await db
      .select({ userId: brandMembers.userId })
      .from(brandMembers)
      .innerJoin(users, eq(users.id, brandMembers.userId))
      .where(and(eq(brandMembers.brandId, brand.id), eq(users.email, email)))
      .limit(1);

    const [already] = await db
      .select({ id: invites.id })
      .from(invites)
      .where(and(eq(invites.brandId, brand.id), eq(invites.email, email)))
      .limit(1);

    if (member) {
      console.log(`${email} is already a member — no invite needed.`);
    } else if (already) {
      console.log(`Owner invite for ${email} already exists.`);
    } else {
      // An invite rather than a membership row: the owner may have no Firebase
      // account yet, and invites are consumed by email on first sign-in.
      await db.insert(invites).values({
        brandId: brand.id,
        email,
        role: "owner",
        token: randomBytes(32).toString("base64url"),
        expiresAt: new Date(Date.now() + 365 * 86400_000),
      });
      console.log(`Owner invite created for ${email}.`);
    }
  }

  console.log(`\nDone. Open /brand/${slug}`);
  return brand;
}
