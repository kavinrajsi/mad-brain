import { count, eq, inArray } from "drizzle-orm";

import DeleteBrand from "./delete-brand";
import InviteForm from "./invite-form";
import MemberRow from "./member-row";
import { requireBrandRole } from "@/lib/auth/dal";
import { db } from "@/lib/db/client";
import {
  brands,
  documentChunks,
  documents,
  ideaChecks,
  users,
} from "@/lib/db/schema";
import { listBrandMembers, listPendingInvites } from "@/lib/db/queries";

export const metadata = {
  title: "Members · Madbrain",
};

export default async function MembersPage({ params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug, "admin");

  const [members, pending] = await Promise.all([
    listBrandMembers(access.brandId),
    listPendingInvites(access.brandId),
  ]);

  // Only an owner sees the delete control, so the counts behind it are only
  // worth fetching for an owner.
  const counts =
    access.role === "owner" ? await deletionCounts(access.brandId) : null;
  const [brand] = counts
    ? await db
        .select({ name: brands.name })
        .from(brands)
        .where(eq(brands.id, access.brandId))
        .limit(1)
    : [];

  const ids = members.map((m) => m.userId);
  const profiles = ids.length
    ? await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
        })
        .from(users)
        .where(inArray(users.id, ids))
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Members
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Members read the knowledge base and run fit checks. Admins can also add
        documents, edit the brand profile and invite people.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
          Invite someone
        </h2>
        <InviteForm brandSlug={slug} canInviteOwner={access.role === "owner"} />
      </section>

      {pending.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            Pending invites
          </h2>
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {pending.map((invite) => (
              <MemberRow
                key={invite.id}
                brandSlug={slug}
                invite={{
                  id: invite.id,
                  email: invite.email,
                  role: invite.role,
                  token: invite.token,
                  expiresAt: invite.expiresAt.toISOString(),
                }}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
          On this brand
        </h2>
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              brandSlug={slug}
              isSelf={member.userId === access.userId}
              canManageOwners={access.role === "owner"}
              member={{
                userId: member.userId,
                role: member.role,
                email: byId.get(member.userId)?.email ?? member.userId,
                displayName: byId.get(member.userId)?.displayName ?? null,
              }}
            />
          ))}
        </ul>
      </section>

      {counts ? (
        <section className="mt-16 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="text-sm font-medium text-red-700 dark:text-red-400">
            Danger zone
          </h2>
          <p className="mt-2 mb-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Only owners can delete a brand.
          </p>
          <DeleteBrand
            brandSlug={slug}
            brandName={brand?.name ?? slug}
            counts={counts}
          />
        </section>
      ) : null}
    </main>
  );
}

/** Counted so the confirmation states what is actually about to be destroyed. */
async function deletionCounts(brandId) {
  const [[docs], [chunks], [checks], members] = await Promise.all([
    db
      .select({ n: count() })
      .from(documents)
      .where(eq(documents.brandId, brandId)),
    db
      .select({ n: count() })
      .from(documentChunks)
      .where(eq(documentChunks.brandId, brandId)),
    db
      .select({ n: count() })
      .from(ideaChecks)
      .where(eq(ideaChecks.brandId, brandId)),
    listBrandMembers(brandId),
  ]);

  return {
    documents: docs.n,
    chunks: chunks.n,
    checks: checks.n,
    members: members.length,
  };
}
