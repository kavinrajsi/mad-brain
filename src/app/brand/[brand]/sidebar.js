"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import SignOutButton from "@/components/sign-out-button";

/**
 * Persisted collapse state, read via useSyncExternalStore rather than
 * useState+useEffect — the officially-recommended pattern for reading an
 * external store (localStorage here) without a setState-in-effect
 * anti-pattern or a hydration mismatch: React renders the server snapshot
 * (always expanded) through hydration, then syncs to the real client value.
 */
const SIDEBAR_KEY = "sidebar-collapsed";
const sidebarListeners = new Set();

function subscribeSidebarCollapsed(callback) {
  sidebarListeners.add(callback);
  return () => sidebarListeners.delete(callback);
}
function getSidebarCollapsedSnapshot() {
  return localStorage.getItem(SIDEBAR_KEY) === "1";
}
function getSidebarCollapsedServerSnapshot() {
  return false;
}
function setSidebarCollapsed(value) {
  localStorage.setItem(SIDEBAR_KEY, value ? "1" : "0");
  sidebarListeners.forEach((callback) => callback());
}

const TABS = [
  {
    href: "",
    label: "Start here",
    icon: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  },
  {
    href: "/knowledge",
    label: "Knowledge",
    icon: "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z",
  },
  {
    href: "/profile",
    label: "Brand profile",
    icon: "M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z",
  },
  {
    href: "/check",
    label: "Fit check",
    icon: "M20,3H4C2.9,3,2,3.9,2,5v14c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V5 C22,3.9,21.1,3,20,3z M10,17H5v-2h5V17z M10,13H5v-2h5V13z M10,9H5V7h5V9z M14.82,15L12,12.16l1.41-1.41l1.41,1.42L17.99,9 l1.42,1.42L14.82,15z",
  },
  {
    href: "/ask",
    label: "Ask",
    icon: "M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z",
  },
  {
    href: "/history",
    label: "History",
    icon: "M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z",
  },
  {
    href: "/settings/members",
    label: "Members",
    adminOnly: true,
    icon: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  },
];

function NavIcon({ path }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

function CollapseIcon({ collapsed }) {
  // chevron_left when expanded (click to collapse), chevron_right when
  // collapsed (click to expand) — the icon always points the direction the
  // click will move the sidebar edge.
  const d = collapsed
    ? "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"
    : "M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z";
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d={d} />
    </svg>
  );
}

function BrandSwitcher({ slug, brands, collapsed }) {
  const [open, setOpen] = useState(false);
  const current = brands.find((b) => b.slug === slug);

  if (collapsed) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        {(current?.name ?? "?").slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
            {current?.name ?? "…"}
          </span>
        </span>
        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0 text-zinc-400">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute left-0 top-full z-20 mt-1 block w-full min-w-[14rem] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brand/${brand.slug}`}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-2.5 py-1.5 text-sm transition ${
                  brand.slug === slug
                    ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                }`}
              >
                {brand.name}
              </Link>
            ))}
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-lg border-t border-zinc-200 px-2.5 py-1.5 pt-2 text-xs text-zinc-400 transition hover:text-zinc-700 dark:border-zinc-800 dark:hover:text-zinc-200"
            >
              All brands
            </Link>
          </span>
        </>
      ) : null}
    </div>
  );
}

export default function Sidebar({ slug, access, brands }) {
  const pathname = usePathname();
  const base = `/brand/${slug}`;
  const isAdmin = access.role === "admin" || access.role === "owner";

  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );

  function toggleCollapsed() {
    setSidebarCollapsed(!collapsed);
  }

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-zinc-200 transition-[width] duration-150 dark:border-zinc-800 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="flex items-center gap-1 border-b border-zinc-200 p-2 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <BrandSwitcher slug={slug} brands={brands} collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
          const href = `${base}${tab.href}`;
          const active = tab.href ? pathname.startsWith(href) : pathname === base;

          return (
            <Link
              key={tab.label}
              href={href}
              title={collapsed ? tab.label : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition ${
                active
                  ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              <NavIcon path={tab.icon} />
              {collapsed ? null : <span className="truncate">{tab.label}</span>}
            </Link>
          );
        })}
      </nav>

      {collapsed ? null : (
        <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
          <div className="rounded-lg px-2 py-1.5">
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {access.email}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {access.role}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
