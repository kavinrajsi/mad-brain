import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";

const PUBLIC_PATHS = ["/login"];

/**
 * Optimistic gate only.
 *
 * This reads the cookie and nothing else — no Firebase verification, no database
 * call. Proxy runs on every request including prefetches, so anything expensive
 * here is paid constantly, and it is NOT a security boundary:
 *
 *   - Server Actions are POSTs to the page route, so a matcher exclusion silently
 *     skips them (see proxy.md:217).
 *   - Real verification happens in src/lib/auth/dal.js, close to the data.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Page routes only. Excluded:
     *   _next/static, _next/image, favicon.ico, static asset extensions
     *   api/*  — every API route authorises itself via the data access layer
     *            and answers 401/403 as JSON. Redirecting them here would send
     *            a fetch() an HTML login page to parse instead of an error, and
     *            it also keeps request bodies out of the proxy buffer, which
     *            truncates oversized bodies silently rather than rejecting them.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
