# Setup

Madbrain is a multi-brand knowledge base. Each brand holds its documents, a
structured brand profile, and a history of idea checks. A new joiner reads the
brand in via a curated path; anyone can test an idea against the brand and get a
scored, cited verdict.

## Already provisioned

| Service | What it holds | Status |
|---|---|---|
| Neon Postgres | brands, members, invites, documents, chunks, checks | done — `DATABASE_URL` pulled, migrations applied |
| Vercel Blob (`madbrain-docs`, private) | uploaded brand books and decks | done — `BLOB_READ_WRITE_TOKEN` pulled |

The Vercel project is linked as `madarth/madbrain`.

## Still needed

Add each of these, then re-run `vercel env pull`:

```bash
vercel env add PINECONE_API_KEY development
vercel env add OPENROUTER_API_KEY development
vercel env add OPENAI_API_KEY development
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON development
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY development
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN development
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID development
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID development
```

Repeat with `preview` and `production` when you deploy.

### Firebase

1. Create a Firebase project.
2. Authentication → Sign-in method → enable **Google**.
3. Project settings → Your apps → add a **Web** app. The config values it shows
   become the four `NEXT_PUBLIC_FIREBASE_*` variables.
4. Project settings → Service accounts → **Generate new private key**.
   `FIREBASE_SERVICE_ACCOUNT_JSON` is that file, base64-encoded:
   `base64 -i serviceAccount.json | pbcopy`
   (Raw JSON is accepted too, but base64 avoids newline mangling in env files.)
5. Authentication → Settings → Authorized domains: add `localhost` and your
   deployment domain.

### Pinecone

Create an account and an API key, then:

```bash
npm run setup:pinecone
```

This creates a serverless index at **1536 dimensions, cosine** — matching
`text-embedding-3-small`. The dimension is fixed at creation, so the script
refuses to reuse an index of the wrong size rather than failing later at query
time.

### OpenRouter and OpenAI

- `OPENROUTER_API_KEY` — powers the fit checker and chat. One key fronts every
  model family in `src/lib/ai/models.js`; users pick a model per check.
- `OPENAI_API_KEY` — embeddings only. OpenRouter exposes no embeddings endpoint,
  so this cannot be folded into the same key.

## Run it

```bash
npm run db:migrate   # already applied, but safe to re-run
npm run dev
```

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run db:generate` | Generate a migration after editing `src/lib/db/schema.js` |
| `npm run db:migrate` | Apply migrations to Neon |
| `npm run db:studio` | Browse the database |
| `npm run setup:pinecone` | Create the vector index |
| `npm run verify:sql` | Exercise the hand-written SQL against the dev database |
| `npm run lint` | ESLint (`next build` no longer lints in Next 16) |

`verify:sql` is worth running after any change to `src/lib/db/queries.js`. This
is untyped JavaScript, so a wrong query builder call compiles and lints
cleanly and only fails when a user hits it — that script exists because two
such bugs shipped past both checks.

## Things that will bite you if changed carelessly

- **`src/lib/ai/config.js` couples the embedding model to the index dimension.**
  Changing the model means creating a new index and re-ingesting every document.
- **`cacheComponents` is intentionally off.** Turning it on removes the
  `dynamic` / `revalidate` / `fetchCache` route segment configs and forbids
  `use cache` inside route handler bodies.
- **`src/proxy.js` is an optimistic gate, not a security boundary.** It only
  checks that a cookie exists. Real verification is in `src/lib/auth/dal.js`.
  Server Actions are not covered by the proxy at all, so every action
  re-authorises itself.
- **Uploads must not go through a Server Action** (1MB body cap) or through the
  proxy (oversized bodies are truncated silently, not rejected). They go
  browser → Blob directly, via `/api/blob/upload`, which is excluded from the
  proxy matcher.
