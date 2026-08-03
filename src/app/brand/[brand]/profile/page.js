import ProfileForm from "./profile-form";
import { requireBrandRole } from "@/lib/auth/dal";
import { arrayToLines } from "@/lib/brand-profile";
import { getBrandProfile } from "@/lib/db/queries";

export const metadata = {
  title: "Brand profile · Madbrain",
};

export default async function ProfilePage({ params }) {
  const { brand: slug } = await params;
  const access = await requireBrandRole(slug);
  const profile = await getBrandProfile(access.brandId);

  const isAdmin = access.role === "admin" || access.role === "owner";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Brand profile
      </h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        This is the rubric a fit check scores against. Documents supply the
        evidence; these pillars decide what the score means — which is what
        makes two checks of the same idea comparable.
      </p>

      <ProfileForm
        brandSlug={slug}
        readOnly={!isAdmin}
        initial={{
          mission: profile?.mission ?? "",
          missionHtml: profile?.missionHtml ?? null,
          audience: profile?.audience ?? "",
          audienceHtml: profile?.audienceHtml ?? null,
          values: arrayToLines(profile?.values),
          tone: arrayToLines(profile?.tone),
          dos: arrayToLines(profile?.dos),
          donts: arrayToLines(profile?.donts),
          visual: arrayToLines(profile?.visual),
          prism: profile?.prism ?? {},
          prismHtml: profile?.prismHtml ?? {},
          rules: arrayToLines(profile?.rules),
        }}
      />
    </main>
  );
}
