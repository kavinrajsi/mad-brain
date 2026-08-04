import Sidebar from "./sidebar";
import { listMyBrands, requireBrandRole } from "@/lib/auth/dal";

/**
 * The layout renders the shell and nothing sensitive.
 *
 * The authorisation call here is for navigation data only — layouts do not
 * re-render on navigation, so this is NOT the access check. Every page below
 * calls requireBrandRole itself.
 */
export default async function BrandLayout({ children, params }) {
  const { brand: slug } = await params;
  const [access, brands] = await Promise.all([
    requireBrandRole(slug),
    listMyBrands(),
  ]);

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar slug={slug} access={access} brands={brands} />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
