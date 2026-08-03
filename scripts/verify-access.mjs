/**
 * The HTTP half of the tenant-isolation test, against a running dev server.
 *
 * verify-e2e.mjs proves retrieval cannot cross brands. This proves the request
 * layer cannot either: a signed-in member of one brand asking for another
 * brand's pages and API routes must get a redirect or a 403, never data. That
 * boundary lives in the DAL and in each route, and no unit test reaches it —
 * it needs a real session cookie.
 *
 * Sessions are minted the way the app does: an Admin SDK custom token is
 * exchanged for an ID token, and that is POSTed to /api/auth/session. No
 * browser required.
 *
 * Requires `npm run dev` on http://localhost:3000. Writes rows prefixed
 * `zz-access` and removes them afterwards.
 *
 *   npm run verify:access
 */
import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url).pathname });

const { and, eq } = await import("drizzle-orm");
const { db } = await import("../src/lib/db/client.js");
const { brandMembers, brands, users } = await import("../src/lib/db/schema.js");
const { adminAuth } = await import("../src/lib/auth/firebase-admin.js");

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const TAG = "zz-access";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

const results = [];
const check = async (name, fn) => {
  try {
    results.push(`PASS  ${name} — ${await fn()}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${String(error?.message ?? error).slice(0, 300)}`);
  }
};

/** Signs a uid in the same way the browser does, and returns its session cookie. */
async function sessionCookieFor(uid, email) {
  const customToken = await adminAuth().createCustomToken(uid);

  const exchange = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const { idToken, error } = await exchange.json();
  if (!idToken) throw new Error(`token exchange failed: ${JSON.stringify(error)}`);

  const response = await fetch(`${BASE}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw new Error(`session mint failed (${response.status}): ${await response.text()}`);
  }

  const cookie = response.headers.getSetCookie().find((c) => c.startsWith("__session="));
  if (!cookie) throw new Error("no __session cookie was set");
  return { cookie, raw: cookie.split(";")[0], email };
}

const get = (path, cookie) =>
  fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });

let owner, outsider, brandA, brandB;

await check("seed an owner of brand A and an outsider with no memberships", async () => {
  for (const [uid, email] of [
    [`uid-${TAG}-owner`, `${TAG}-owner@example.com`],
    [`uid-${TAG}-outsider`, `${TAG}-outsider@example.com`],
  ]) {
    await adminAuth()
      .createUser({ uid, email })
      .catch(async (error) => {
        if (error.code !== "auth/uid-already-exists") throw error;
      });
    await db
      .insert(users)
      .values({ id: uid, email })
      .onConflictDoUpdate({ target: users.id, set: { email } });
  }

  [brandA] = await db
    .insert(brands)
    .values({ slug: `${TAG}-alpha`, name: "Alpha" })
    .returning();
  [brandB] = await db
    .insert(brands)
    .values({ slug: `${TAG}-beta`, name: "Beta" })
    .returning();

  await db.insert(brandMembers).values({
    brandId: brandA.id,
    userId: `uid-${TAG}-owner`,
    role: "owner",
  });

  return `${brandA.slug} (owned), ${brandB.slug} (no members)`;
});

await check("signing in mints an httpOnly session cookie", async () => {
  owner = await sessionCookieFor(`uid-${TAG}-owner`, `${TAG}-owner@example.com`);
  outsider = await sessionCookieFor(
    `uid-${TAG}-outsider`,
    `${TAG}-outsider@example.com`,
  );

  const flags = owner.cookie.toLowerCase();
  if (!flags.includes("httponly")) throw new Error("cookie is readable from JavaScript");
  if (!flags.includes("samesite")) throw new Error("no SameSite attribute");
  return owner.cookie.split(";").slice(1).join(";").trim();
});

await check("a signed-out request never reaches brand data", async () => {
  const page = await get(`/brand/${brandA.slug}`);
  if (![302, 303, 307, 308].includes(page.status)) {
    throw new Error(`page returned ${page.status}, expected a redirect to /login`);
  }
  if (!(page.headers.get("location") ?? "").includes("/login")) {
    throw new Error(`redirected to ${page.headers.get("location")}`);
  }

  const api = await get(`/api/brands/${brandA.slug}/documents`);
  if (api.status !== 401) throw new Error(`API returned ${api.status}, expected 401`);
  // The proxy must not swallow API routes: a 307 to an HTML login page would
  // make fetch() die parsing JSON rather than surface the real status.
  const type = api.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error(`API returned ${type}, not JSON`);

  return "page redirects to /login, API returns 401 JSON";
});

await check("a member reaches their own brand", async () => {
  const page = await get(`/brand/${brandA.slug}`, owner.raw);
  if (page.status !== 200) throw new Error(`got ${page.status}`);

  const api = await get(`/api/brands/${brandA.slug}/documents`, owner.raw);
  if (api.status !== 200) throw new Error(`API got ${api.status}`);
  return "page 200, API 200";
});

await check("a non-member is refused another brand's pages", async () => {
  for (const path of [
    `/brand/${brandB.slug}`,
    `/brand/${brandB.slug}/knowledge`,
    `/brand/${brandB.slug}/check`,
    `/brand/${brandB.slug}/settings/members`,
  ]) {
    const response = await get(path, outsider.raw);
    if (response.status === 200) throw new Error(`LEAK: ${path} returned 200`);
    if (![302, 303, 307, 308, 403, 404].includes(response.status)) {
      throw new Error(`${path} returned an unexpected ${response.status}`);
    }
  }
  return "4 routes, none served";
});

await check("a non-member is refused another brand's API routes", async () => {
  const listing = await get(`/api/brands/${brandB.slug}/documents`, outsider.raw);
  if (listing.status !== 403) throw new Error(`GET documents returned ${listing.status}`);

  const write = await fetch(`${BASE}/api/brands/${brandB.slug}/documents`, {
    method: "POST",
    headers: { cookie: outsider.raw, "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType: "note", title: "intrusion", body: "hello" }),
  });
  if (write.status !== 403) throw new Error(`POST documents returned ${write.status}`);

  const chat = await fetch(`${BASE}/api/brands/${brandB.slug}/chat`, {
    method: "POST",
    headers: { cookie: outsider.raw, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  if (chat.status !== 403) throw new Error(`POST chat returned ${chat.status}`);

  return "GET 403, POST 403, chat 403";
});

await check("a brand slug that does not exist is indistinguishable from one you cannot see", async () => {
  const unknown = await get(`/brand/${TAG}-does-not-exist`, outsider.raw);
  const forbidden = await get(`/brand/${brandB.slug}`, outsider.raw);
  if (unknown.status !== forbidden.status) {
    throw new Error(
      `unknown brand ${unknown.status} vs forbidden brand ${forbidden.status} — slugs are probeable`,
    );
  }
  return `both ${unknown.status}`;
});

await check("a member of one brand cannot upload into another", async () => {
  const response = await fetch(`${BASE}/api/blob/upload`, {
    method: "POST",
    headers: { cookie: outsider.raw, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname: `${brandB.slug}/secret.pdf`,
        callbackUrl: `${BASE}/api/blob/upload`,
        clientPayload: JSON.stringify({ brandSlug: brandB.slug }),
        multipart: false,
      },
    }),
  });
  if (response.status === 200) {
    const body = await response.text();
    if (body.includes("clientToken")) throw new Error("LEAK: an upload token was issued");
  }
  return `${response.status}, no token issued`;
});

await check("deleting a brand is reachable by admins but not by members", async () => {
  // The gate is admin, so an admin must see the control and a plain member
  // must not. Rendering is not the boundary — deleteBrandAction re-authorises
  // — but a member shown a button they cannot use is its own bug.
  for (const [role, shouldSee] of [
    ["admin", true],
    ["member", false],
  ]) {
    await db
      .insert(brandMembers)
      .values({ brandId: brandA.id, userId: `uid-${TAG}-outsider`, role })
      .onConflictDoUpdate({
        target: [brandMembers.brandId, brandMembers.userId],
        set: { role },
      });

    const response = await get(
      `/brand/${brandA.slug}/settings/members`,
      outsider.raw,
    );
    const html = response.status === 200 ? await response.text() : "";
    const sees = html.includes("Delete this brand");

    if (sees !== shouldSee) {
      throw new Error(
        `a ${role} ${sees ? "was shown" : "was not shown"} the delete control`,
      );
    }
  }

  await db
    .delete(brandMembers)
    .where(
      and(
        eq(brandMembers.brandId, brandA.id),
        eq(brandMembers.userId, `uid-${TAG}-outsider`),
      ),
    );
  return "shown to admin, hidden from member";
});

await check("a member can actually hold a chat turn", async () => {
  // The chat route had never been exercised end to end. It was broken for
  // every turn — convertToModelMessages returns a Promise in AI SDK v7, and
  // spreading it threw "modelMessages is not iterable" before a single token
  // was streamed. A 403 test does not reach that line.
  const response = await fetch(`${BASE}/api/brands/${brandA.slug}/chat`, {
    method: "POST",
    headers: { cookie: owner.raw, "Content-Type": "application/json" },
    body: JSON.stringify({
      modelId: "deepseek/deepseek-v3.2",
      messages: [
        {
          id: "m1",
          role: "user",
          parts: [{ type: "text", text: "Say the single word: ready." }],
        },
      ],
    }),
  });

  if (response.status !== 200) {
    throw new Error(`chat returned ${response.status}: ${await response.text()}`);
  }

  const body = await response.text();
  if (/"type"\s*:\s*"error"/.test(body)) {
    throw new Error(`stream carried an error: ${body.slice(0, 200)}`);
  }
  if (!/"type"\s*:\s*"text-delta"/.test(body)) {
    throw new Error(`no text was streamed: ${body.slice(0, 200)}`);
  }
  return `${body.length} bytes streamed`;
});

await check("signing out clears the cookie", async () => {
  const response = await fetch(`${BASE}/api/auth/session`, {
    method: "DELETE",
    headers: { cookie: owner.raw },
  });
  if (!response.ok) throw new Error(`DELETE returned ${response.status}`);

  const cleared = response.headers.getSetCookie().find((c) => c.startsWith("__session="));
  if (!cleared) throw new Error("no clearing cookie was sent");
  if (!/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(cleared)) {
    throw new Error(`cookie was not expired: ${cleared}`);
  }
  return "cookie expired";
});

// Cleanup
for (const brand of [brandA, brandB]) {
  if (brand) await db.delete(brands).where(eq(brands.id, brand.id));
}
for (const uid of [`uid-${TAG}-owner`, `uid-${TAG}-outsider`]) {
  await db.delete(users).where(eq(users.id, uid));
  await adminAuth().deleteUser(uid).catch(() => {});
}

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
