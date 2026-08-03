import Link from "next/link";

import CheckForm from "./check-form";
import { requireBrandRole } from "@/lib/auth/dal";
import { DEFAULT_MODEL_ID, modelsByFamily } from "@/lib/ai/models";
import { isProfileEmpty } from "@/lib/brand-profile";
import { getBrandProfile } from "@/lib/db/queries";

export const metadata = {
  title: "Fit check · Madbrain",
};

export default async function CheckPage({ params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug);
  const profile = await getBrandProfile(access.brandId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Does this fit {access.name}?
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Describe the idea as you would pitch it. You get a score per brand
        pillar, the risks, and the passages from the brand&apos;s own documents
        that back the judgement.
      </p>

      {isProfileEmpty(profile) ? (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          This brand has no profile yet, so there is no rubric to score against
          and results will be vague.{" "}
          <Link href={`/brand/${slug}/profile`} className="font-medium underline">
            Fill in the brand profile
          </Link>{" "}
          first.
        </p>
      ) : null}

      <CheckForm
        brandSlug={slug}
        families={modelsByFamily()}
        defaultModelId={DEFAULT_MODEL_ID}
      />
    </main>
  );
}
