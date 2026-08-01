import AddKnowledge from "./add-knowledge";
import DocumentList from "./document-list";
import { requireBrandRole } from "@/lib/auth/dal";
import { listBrandDocuments } from "@/lib/db/queries";

export const metadata = {
  title: "Knowledge · Madbrain",
};

export default async function KnowledgePage({ params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug);
  const docs = await listBrandDocuments(access.brandId);

  const isAdmin = access.role === "admin" || access.role === "owner";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Knowledge
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Everything {access.name} knows about itself. Brand books, decks, notes
        and links — all of it is chunked and indexed so fit checks can cite it.
      </p>

      {isAdmin ? <AddKnowledge brandSlug={slug} /> : null}

      <DocumentList
        brandSlug={slug}
        isAdmin={isAdmin}
        documents={docs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          sourceType: doc.sourceType,
          status: doc.status,
          error: doc.error,
          pinnedOrder: doc.pinnedOrder,
          sourceUrl: doc.sourceUrl,
          createdAt: doc.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
