"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Start here" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/profile", label: "Brand profile" },
  { href: "/check", label: "Fit check" },
  { href: "/ask", label: "Ask" },
  { href: "/history", label: "History" },
  { href: "/settings/members", label: "Members", adminOnly: true },
];

export default function BrandNav({ slug, role }) {
  const pathname = usePathname();
  const base = `/brand/${slug}`;
  const isAdmin = role === "admin" || role === "owner";

  return (
    <nav className="mx-auto w-full max-w-5xl overflow-x-auto px-6">
      <ul className="flex gap-1 whitespace-nowrap">
        {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
          const href = `${base}${tab.href}`;
          const active = tab.href
            ? pathname.startsWith(href)
            : pathname === base;

          return (
            <li key={tab.label}>
              <Link
                href={href}
                className={`-mb-px block border-b-2 px-3 py-2.5 text-sm transition ${
                  active
                    ? "border-zinc-950 text-zinc-950 dark:border-zinc-50 dark:text-zinc-50"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
