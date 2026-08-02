/**
 * Guards for the two places a brand admin hands us a URL that the server then
 * fetches: pasted page ingest, and the blob URL of a client-direct upload.
 *
 * Deliberately dependency-free and side-effect-free so it can be exercised by
 * scripts/verify-url-guard.mjs without credentials.
 */

const MAX_REDIRECTS = 3;

/** Text-ish content types worth running through the HTML stripper. */
const READABLE_TYPES = [
  "text/",
  "application/xhtml",
  "application/xml",
  "application/json",
];

/**
 * Rejects anything that is not a public http(s) origin.
 *
 * Ingest fetches run inside our own function, so an unguarded URL is a
 * server-side request forgery: the fetched text lands in `documents.body` and
 * renders straight back to the person who asked for it, which turns any
 * reachable internal endpoint into a readable one.
 */
export function assertPublicHttpUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be ingested.");
  }

  // Strip the brackets Node keeps around IPv6 literals.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) throw new Error("That URL has no host.");

  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("That host is not reachable from the internet.");
  }

  // A dotless host is an internal service name (`redis`, `db`) or an integer-
  // encoded address such as http://2130706433/ — 127.0.0.1 in decimal.
  if (!host.includes(".") && !host.includes(":")) {
    throw new Error("That host is not reachable from the internet.");
  }

  if (host.includes(":")) {
    assertPublicIpv6(host);
  } else if (looksNumeric(host)) {
    assertPublicIpv4(host);
  }

  return url;
}

function looksNumeric(host) {
  // Only a trailing all-digit label makes a hostname an IPv4 literal; a real
  // domain never ends in one, so this cannot reject a legitimate host.
  const last = host.split(".").pop();
  return /^[0-9]/.test(last);
}

function assertPublicIpv4(host) {
  const parts = host.split(".");
  const blocked = () => {
    throw new Error("That address is on a private network.");
  };

  // Anything that is not a plain decimal dotted quad is an encoding trick
  // (0177.0.0.1, 127.1, 0x7f.0.0.1) rather than an address we should resolve.
  if (parts.length !== 4) blocked();
  const octets = parts.map((part) => {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) blocked();
    const n = Number(part);
    if (n > 255) blocked();
    return n;
  });

  const [a, b] = octets;
  if (
    a === 0 || // this network
    a === 10 || // RFC1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 168) || // RFC1918
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 198 && b >= 18 && b <= 19) || // benchmarking
    a >= 224 // multicast and reserved
  ) {
    blocked();
  }
}

function assertPublicIpv6(host) {
  const blocked = () => {
    throw new Error("That address is on a private network.");
  };

  if (host === "::" || host === "::1") blocked();

  // ::ffff:127.0.0.1 reaches IPv4 loopback over an IPv6 literal. WHATWG URL
  // parsing rewrites the dotted tail to hex first — `[::ffff:127.0.0.1]`
  // arrives here as `::ffff:7f00:1` — so both spellings have to be unpacked.
  const mapped = host.match(/^::ffff:([0-9a-f.:]+)$/);
  if (mapped) {
    assertPublicIpv4(unpackMappedIpv4(mapped[1]));
    return;
  }

  const head = host.slice(0, 4);
  // 64:ff9b::/96 is NAT64: the last 32 bits are an IPv4 address a translator
  // will happily route to, so the same range rules apply.
  if (head === "64:f") {
    const tail = host.split(":").filter(Boolean).slice(-2);
    if (tail.length === 2) assertPublicIpv4(unpackMappedIpv4(tail.join(":")));
  }
  if (/^f[cd]/.test(head)) blocked(); // fc00::/7 unique-local
  if (/^fe[89ab]/.test(head)) blocked(); // fe80::/10 link-local
}

/** Turns the two trailing hextets of a mapped address back into a dotted quad. */
function unpackMappedIpv4(tail) {
  if (tail.includes(".")) return tail;

  const [high, low] = tail.split(":");
  const value = (parseInt(high, 16) << 16) | parseInt(low, 16);
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

/**
 * Fetches a page as text with the guard applied to every hop.
 *
 * `redirect: "follow"` would undo the host check entirely — a public URL is
 * free to 302 to 169.254.169.254 — so redirects are resolved by hand and each
 * Location is re-validated.
 */
export async function fetchGuardedText(rawUrl, { maxBytes, fetchImpl } = {}) {
  const doFetch = fetchImpl ?? fetch;
  const limit = maxBytes ?? 5 * 1024 * 1024;
  let target = assertPublicHttpUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await doFetch(target.toString(), {
      headers: { "User-Agent": "MadbrainBot/1.0" },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error(`Could not fetch ${target} (redirect without a target)`);
      target = assertPublicHttpUrl(new URL(location, target).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Could not fetch ${target} (${response.status})`);
    }

    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type && !READABLE_TYPES.some((prefix) => type.startsWith(prefix))) {
      throw new Error(`That URL returned ${type.split(";")[0]}, not a readable page.`);
    }

    return { url: target.toString(), text: await readCapped(response, limit) };
  }

  throw new Error("That URL redirected too many times.");
}

/**
 * Reads the body while counting bytes.
 *
 * content-length is not trusted: it is routinely absent on chunked responses
 * and nothing stops a hostile origin from understating it, so the only cap
 * that holds is one applied while reading.
 */
async function readCapped(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        throw new Error(
          `That page is larger than the ${Math.round(limit / 1024 / 1024)}MB ingest limit.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return new TextDecoder("utf-8").decode(concat(chunks, total));
}

function concat(chunks, total) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * A blob URL is supplied by the browser after a direct upload, so it is
 * attacker-controlled input even though the upload token was server-issued.
 *
 * Two things are checked. The host must be this store's *private* domain: the
 * SDK lets the client pick `access` at PUT time and `onBeforeGenerateToken`
 * cannot override it, so a modified client could otherwise publish a brand book
 * at a world-readable URL. And the pathname must carry this brand's prefix, so
 * one brand's admin cannot attach another brand's file to their own document.
 */
export function assertBrandBlobUrl(rawUrl, brandSlug) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("That is not a valid upload URL.");
  }

  if (!url.hostname.toLowerCase().endsWith(".private.blob.vercel-storage.com")) {
    throw new Error("Uploads must go to private Blob storage.");
  }

  const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!pathname.startsWith(`${brandSlug}/`)) {
    throw new Error("That file does not belong to this brand.");
  }

  return url.toString();
}

/** The prefix every upload for a brand must be stored under. */
export function brandBlobPrefix(brandSlug) {
  return `${brandSlug}/`;
}
