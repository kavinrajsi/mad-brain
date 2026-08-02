/**
 * Exercises the SSRF and blob-ownership guards in src/lib/ingest/url-guard.js.
 *
 * Ingest fetches run inside our own function and the fetched text is rendered
 * straight back to the person who asked for it, so a missed host is a readable
 * internal endpoint. Everything here runs without credentials or network.
 *
 *   npm run verify:urlguard
 */
import {
  assertBrandBlobUrl,
  assertPublicHttpUrl,
  fetchGuardedText,
} from "../src/lib/ingest/url-guard.js";

const results = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    results.push(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${error.message}`);
  }
};
const checkAsync = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    results.push(`FAIL  ${name} — ${error.message}`);
  }
};

const blocks = (url) => {
  try {
    assertPublicHttpUrl(url);
  } catch {
    return true;
  }
  return false;
};

check("public URLs are allowed", () => {
  const allowed = [
    "https://example.com/brand-book",
    "http://www.example.co.uk/a?b=c#d",
    "https://8.8.8.8/page",
    "https://203.0.113.10/page",
    "https://[2606:4700:4700::1111]/page",
    "https://[::ffff:8.8.8.8]/page",
  ];
  const wrong = allowed.filter((url) => blocks(url));
  if (wrong.length) throw new Error(`wrongly blocked: ${wrong.join(", ")}`);
  return `${allowed.length} allowed`;
});

check("non-http schemes are blocked", () => {
  const cases = [
    "file:///etc/passwd",
    "ftp://example.com/x",
    "gopher://example.com/",
    "data:text/html,hi",
  ];
  const leaked = cases.filter((url) => !blocks(url));
  if (leaked.length) throw new Error(`ALLOWED: ${leaked.join(", ")}`);
  return `${cases.length} blocked`;
});

check("cloud metadata and loopback are blocked", () => {
  const cases = [
    "http://169.254.169.254/latest/meta-data/",
    "http://127.0.0.1:6379/",
    "http://127.5.5.5/",
    "http://localhost:3000/",
    "http://app.localhost/",
    "http://0.0.0.0:8080/",
  ];
  const leaked = cases.filter((url) => !blocks(url));
  if (leaked.length) throw new Error(`ALLOWED: ${leaked.join(", ")}`);
  return `${cases.length} blocked`;
});

check("private ranges are blocked", () => {
  const cases = [
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://172.31.255.254/",
    "http://192.168.1.1/",
    "http://100.64.0.1/",
    "http://224.0.0.1/",
  ];
  const leaked = cases.filter((url) => !blocks(url));
  if (leaked.length) throw new Error(`ALLOWED: ${leaked.join(", ")}`);
  return `${cases.length} blocked`;
});

check("public neighbours of private ranges still resolve", () => {
  // 172.32.x is public even though 172.16-31 is not — an over-broad rule here
  // would quietly break legitimate ingest.
  const allowed = ["http://172.32.0.1/", "http://11.0.0.1/", "http://192.169.1.1/"];
  const wrong = allowed.filter((url) => blocks(url));
  if (wrong.length) throw new Error(`wrongly blocked: ${wrong.join(", ")}`);
  return "172.32, 11.0, 192.169 allowed";
});

check("encoded loopback forms are blocked", () => {
  const cases = [
    "http://2130706433/", // decimal 127.0.0.1
    "http://0177.0.0.1/", // octal
    "http://0x7f.0.0.1/", // hex
    "http://127.1/", // short form
    "http://redis/", // internal service name
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[64:ff9b::169.254.169.254]/", // NAT64 to the metadata endpoint
    "http://[fd00::1]/",
    "http://[fe80::1]/",
  ];
  const leaked = cases.filter((url) => !blocks(url));
  if (leaked.length) throw new Error(`ALLOWED: ${leaked.join(", ")}`);
  return `${cases.length} blocked`;
});

const reply = (body, { status = 200, headers = {} } = {}) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html", ...headers },
  });

await checkAsync("a redirect to link-local is refused", async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (seen.length === 1) {
      return reply(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      });
    }
    return reply("<p>secret</p>");
  };

  try {
    await fetchGuardedText("https://example.com/start", { fetchImpl });
  } catch (error) {
    if (seen.length !== 1) {
      throw new Error(`followed the redirect: ${seen.length} requests`);
    }
    return error.message;
  }
  throw new Error("LEAK: the redirect was followed");
});

await checkAsync("a redirect chain to a public host is followed", async () => {
  let hop = 0;
  const fetchImpl = async () => {
    hop += 1;
    if (hop < 3) {
      return reply(null, {
        status: 302,
        headers: { location: `https://example.com/hop-${hop}` },
      });
    }
    return reply("<p>brand book</p>");
  };

  const { text } = await fetchGuardedText("https://example.com/start", {
    fetchImpl,
  });
  if (!text.includes("brand book")) throw new Error(`got: ${text}`);
  return `${hop} hops`;
});

await checkAsync("an endless redirect loop terminates", async () => {
  let hops = 0;
  const fetchImpl = async () => {
    hops += 1;
    return reply(null, {
      status: 302,
      headers: { location: "https://example.com/again" },
    });
  };

  try {
    await fetchGuardedText("https://example.com/start", { fetchImpl });
  } catch {
    if (hops > 5) throw new Error(`made ${hops} requests before stopping`);
    return `stopped after ${hops}`;
  }
  throw new Error("the loop never terminated");
});

await checkAsync("an oversized body is cut off, not buffered", async () => {
  // No content-length, so only a cap applied while reading can catch this.
  const megabyte = new Uint8Array(1024 * 1024).fill(65);
  const fetchImpl = async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(megabyte);
        },
      }),
      { headers: { "content-type": "text/plain" } },
    );

  try {
    await fetchGuardedText("https://example.com/huge", {
      fetchImpl,
      maxBytes: 3 * 1024 * 1024,
    });
  } catch (error) {
    return error.message;
  }
  throw new Error("an unbounded body was read to completion");
});

await checkAsync("binary content types are refused", async () => {
  const fetchImpl = async () =>
    reply("%PDF-1.7", { headers: { "content-type": "application/pdf" } });

  try {
    await fetchGuardedText("https://example.com/file.pdf", { fetchImpl });
  } catch (error) {
    return error.message;
  }
  throw new Error("a PDF was accepted as a readable page");
});

check("blob URLs must be private and brand-prefixed", () => {
  const store = "store123";
  const ok = `https://${store}.private.blob.vercel-storage.com/acme/book-x1.pdf`;
  if (assertBrandBlobUrl(ok, "acme") !== ok) throw new Error("rejected a valid URL");

  const bad = [
    // Another brand's file, attached to this brand's document.
    [`https://${store}.private.blob.vercel-storage.com/rival/book-x1.pdf`, "acme"],
    // Public access, which the client can request and the server cannot pin.
    [`https://${store}.public.blob.vercel-storage.com/acme/book.pdf`, "acme"],
    // Prefix smuggled past a naive `includes` check.
    [`https://${store}.private.blob.vercel-storage.com/rival/acme/book.pdf`, "acme"],
    // A lookalike host.
    ["https://private.blob.vercel-storage.com.evil.test/acme/book.pdf", "acme"],
    // Percent-encoded traversal out of the prefix.
    [`https://${store}.private.blob.vercel-storage.com/%72ival/book.pdf`, "acme"],
  ];

  const leaked = bad.filter(([url, slug]) => {
    try {
      assertBrandBlobUrl(url, slug);
      return true;
    } catch {
      return false;
    }
  });
  if (leaked.length) throw new Error(`ALLOWED: ${leaked.map((x) => x[0]).join(", ")}`);
  return `1 allowed, ${bad.length} blocked`;
});

console.log(results.join("\n"));
const failed = results.some((r) => r.startsWith("FAIL"));
console.log(failed ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
