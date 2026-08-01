"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getBrandAccess, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import { createBrand } from "@/lib/db/queries";
import { brandMembers, invites } from "@/lib/db/schema";

const INVITE_TTL_DAYS = 14;

const brandNameSchema = z.string().trim().min(2).max(80);
const emailSchema = z.string().trim().email().max(254);
const roleSchema = z.enum(["member", "admin", "owner"]);

/**
 * Every action re-authorises from the session. Rendering a form only on an
 * admin page is not a security boundary — Server Actions are reachable
 * directly, and the proxy does not cover them.
 */
export async function createBrandAction(_prevState, formData) {
  const session = await requireUser();

  const parsed = brandNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: "Brand name must be between 2 and 80 characters." };
  }

  const brand = await createBrand({
    name: parsed.data,
    ownerId: session.userId,
  });
  redirect(`/b/${brand.slug}`);
}

export async function inviteMemberAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const access = await getBrandAccess(slug, "admin");
  if (!access) return { error: "You do not have permission to invite people." };

  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };

  const role = roleSchema.safeParse(formData.get("role") ?? "member");
  if (!role.success) return { error: "Pick a valid role." };

  // Only an owner may mint another owner.
  if (role.data === "owner" && access.role !== "owner") {
    return { error: "Only an owner can invite another owner." };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000);

  await db.insert(invites).values({
    brandId: access.brandId,
    email: email.data.toLowerCase(),
    role: role.data,
    token,
    invitedBy: access.userId,
    expiresAt,
  });

  revalidatePath(`/b/${slug}/settings/members`);
  return { ok: true, token };
}

export async function revokeInviteAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const access = await getBrandAccess(slug, "admin");
  if (!access) return { error: "You do not have permission to do that." };

  const inviteId = String(formData.get("inviteId") ?? "");

  // Scoped by brandId so an admin of one brand cannot revoke another's invite.
  await db
    .delete(invites)
    .where(and(eq(invites.id, inviteId), eq(invites.brandId, access.brandId)));

  revalidatePath(`/b/${slug}/settings/members`);
  return { ok: true };
}

export async function changeRoleAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const access = await getBrandAccess(slug, "admin");
  if (!access) return { error: "You do not have permission to do that." };

  const userId = String(formData.get("userId") ?? "");
  const role = roleSchema.safeParse(formData.get("role"));
  if (!role.success) return { error: "Pick a valid role." };

  if (userId === access.userId) {
    return { error: "You cannot change your own role." };
  }
  if (role.data === "owner" && access.role !== "owner") {
    return { error: "Only an owner can promote someone to owner." };
  }

  await db
    .update(brandMembers)
    .set({ role: role.data })
    .where(
      and(
        eq(brandMembers.brandId, access.brandId),
        eq(brandMembers.userId, userId),
      ),
    );

  revalidatePath(`/b/${slug}/settings/members`);
  return { ok: true };
}

export async function removeMemberAction(_prevState, formData) {
  const slug = String(formData.get("brandSlug") ?? "");
  const access = await getBrandAccess(slug, "admin");
  if (!access) return { error: "You do not have permission to do that." };

  const userId = String(formData.get("userId") ?? "");
  if (userId === access.userId) {
    return { error: "You cannot remove yourself." };
  }

  await db
    .delete(brandMembers)
    .where(
      and(
        eq(brandMembers.brandId, access.brandId),
        eq(brandMembers.userId, userId),
      ),
    );

  revalidatePath(`/b/${slug}/settings/members`);
  return { ok: true };
}
