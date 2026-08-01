import AskChat from "./ask-chat";
import { requireBrandRole } from "@/lib/auth/dal";
import { DEFAULT_MODEL_ID, modelsByFamily } from "@/lib/ai/models";

export const metadata = {
  title: "Ask · Madbrain",
};

export default async function AskPage({ params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Ask about {access.name}
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Answers come from this brand&apos;s documents only. If something is not
        in there, you will be told rather than guessed at.
      </p>

      <AskChat
        brandSlug={slug}
        families={modelsByFamily()}
        defaultModelId={DEFAULT_MODEL_ID}
      />
    </main>
  );
}
