/**
 * Gives plain node the two resolution conveniences the bundler provides: the
 * `@/` path alias from jsconfig.json, and extensionless imports.
 *
 * The verify scripts import the app's real modules on purpose — a test that
 * reimplements a call cannot catch a wrong call, which is exactly how the first
 * draft of verify-pinecone.mjs failed. Rewriting app imports to suit the
 * scripts would be the tail wagging the dog, so the scripts adapt instead.
 *
 *   node --import ./scripts/alias-hooks.mjs scripts/verify-something.mjs
 */
import { registerHooks } from "node:module";

const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), SRC).href
      : specifier;

    // Extensionless is tried first so a real `./thing.js` is never shadowed by
    // a `./thing.js.js` guess.
    const candidates = [mapped];
    if (!/\.[mc]?js$/.test(mapped)) {
      candidates.push(`${mapped}.js`, `${mapped}/index.js`);
    }

    let lastError;
    for (const candidate of candidates) {
      try {
        return nextResolve(candidate, context);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  },
});
