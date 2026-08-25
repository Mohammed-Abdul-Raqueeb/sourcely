# Deploying Sourcely to Vercel (Hobby)

The application runs on Vercel's Node.js serverless runtime with two external
backing services. Nothing on Vercel's filesystem is durable, so the two things
the app persists live elsewhere:

| Concern | Local development | Vercel production |
| --- | --- | --- |
| Application data (catalogue, accounts, sessions, RFQs, audit) | `DATA_DRIVER=memory` → `.data/store.json` | `DATA_DRIVER=postgres` → PostgreSQL via `DATABASE_URL` |
| Admin-uploaded images | `.data/uploads`, streamed by `/api/media` | Vercel Blob, `/api/media` redirects to the store's CDN |
| The 63 catalogue photographs | `public/products/*.webp` — static repository assets | identical; shipped with the build, never touch Blob |

Misconfiguration fails loudly: the memory data driver and the local upload
driver both **refuse to boot on Vercel** with an error naming the variable to
set, rather than silently losing writes.

## 1. External services you must connect

Neither is created automatically; no provider is assumed or hard-coded.

1. **PostgreSQL** — any provider reachable from Vercel that can run
   `CREATE EXTENSION vector` (pgvector) and `pg_trgm`. The migrations create
   both extensions; if the provider does not ship pgvector, migration fails.
   Prefer the provider's **pooled** connection string if one is offered —
   serverless functions open many short-lived connections. If only a direct
   connection is available, append `?connection_limit=8&connect_timeout=15`
   to `DATABASE_URL`: the build prerenders pages in parallel worker
   processes, each with its own Prisma pool, and unbounded pools across
   workers can exhaust the server's `max_connections` — a failure that reads
   as “Can't reach database server” midway through `Generating static pages`.
   (Verified against a 100-connection server: the unbounded build fails, the
   bounded one passes.)
2. **Vercel Blob** — Vercel dashboard → Storage → Blob → create a store and
   connect it to the project. Connecting it injects `BLOB_READ_WRITE_TOKEN`
   into the project environment automatically.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Required in Production (and in any environment that builds — the build
prerenders the catalogue from the database and refuses to start without these):

| Variable | Value |
| --- | --- |
| `DATA_DRIVER` | `postgres` |
| `DATABASE_URL` | the PostgreSQL connection string (never committed) |
| `AUTH_SECRET` | fresh 64-hex secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — generate a new one for production, at least 32 chars; startup throws without it |
| `NEXT_PUBLIC_APP_URL` | the final public URL, e.g. `https://<project>.vercel.app` — inlined at build time |
| `BLOB_READ_WRITE_TOKEN` | added automatically when the Blob store is connected |

Recommended:

| Variable | Value |
| --- | --- |
| `AUDIT_IP_SALT` | a second random secret; audit-trail IP hashing falls back to a fixed salt without it |
| `AUTH_SESSION_TTL_HOURS` | e.g. `72` (the default) |

Optional integrations (the app degrades to documented local behaviour without
them — the admin settings page reports what resolved):

| Variable | Enables |
| --- | --- |
| `AI_PROVIDER=claude` + `ANTHROPIC_API_KEY` | Claude-written assistant prose; the deterministic offline engine otherwise |
| `RESEND_API_KEY` **or** `SMTP_URL` + `MAIL_FROM` | real outbound mail; otherwise messages (incl. reset links) go to the function log |
| `REDIS_URL` | rate-limit buckets shared across instances; in-process per instance otherwise |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_CONTACT_*`, `NEXT_PUBLIC_ADDRESS_*`, … | public contact/legal details (see `.env.example`) |

`UPLOAD_DRIVER` and `UPLOAD_DIR` need not be set on Vercel: the presence of
`BLOB_READ_WRITE_TOKEN` selects the blob driver.

## 3. First deploy — order matters

The build prerenders the homepage, catalogue, category and product pages
**from the database**, so the database must be migrated *and seeded* before the
first build runs.

```bash
# One-time, from your machine, against the PRODUCTION database.
# PowerShell: use  $env:DATABASE_URL = "..."  etc. instead of inline vars.
DATABASE_URL="<production url>" npm run db:migrate
DATA_DRIVER=postgres DATABASE_URL="<production url>" npm run db:seed
```

`db:seed` is idempotent — it can be re-run without duplicating anything — but
it is deliberately **not** part of any deploy pipeline: a pipeline that rewrote
catalogue rows on every push would fight the admin console's edits.

Then import the GitHub repository in Vercel and deploy. `vercel.json` pins the
build command to `npm run vercel-build`, which:

1. verifies `DATA_DRIVER`/`DATABASE_URL` are present (clear error if not),
2. runs `prisma migrate deploy` — applies pending migrations only; a no-op on
   an up-to-date database; never destructive, never seeds,
3. runs the ordinary `next build`.

## 4. After the first deploy

- Set `NEXT_PUBLIC_APP_URL` to the URL Vercel actually assigned (or your
  custom domain) and **redeploy** — the value is inlined at build time.
- Sign in as an admin and upload a product image to confirm the Blob path
  end-to-end (`/api/media/...` should answer 302 to
  `*.public.blob.vercel-storage.com`).

## 5. Platform limits worth knowing (Hobby)

- **Uploads over ~4.5 MB fail on Vercel.** The application's own limit is 8 MB,
  but Vercel rejects any function request body over 4.5 MB before the route
  runs, with a generic 413 rather than the app's friendly message. Uploads up
  to 4.5 MB behave exactly as locally. (Raising this requires client-direct
  Blob uploads — an intentional non-change for now.)
- **Rate limiting is per function instance** unless `REDIS_URL` is set. Limits
  still bite, but each concurrent instance grants its own quota.
- **`images.unoptimized: true` stays.** Catalogue images are pre-optimized by
  the ingest pipeline; the on-demand optimizer is deliberately bypassed (see
  `next.config.ts`). This also suits Vercel: no image-optimization quota is
  consumed.
- If you enable `AI_PROVIDER=claude`, keep an eye on function duration; the
  offline engine (default) is fast enough for any plan's limits.

## 6. What deployment must never change

- The 63 photographs in `public/products/` and the manifest
  `src/server/seed/product-images.ts` are repository assets — they ship with
  every build and do not depend on Blob or the database.
- `product-images/` (the supplied originals) stays in the repository.
- Do not run `npm run images:generate`; the ingest pipeline
  (`npm run images:ingest`) is the only image entry point, and only when new
  originals are supplied.
