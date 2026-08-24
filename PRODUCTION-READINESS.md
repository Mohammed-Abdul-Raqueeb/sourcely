# Production readiness

Phase 6, verified 23 August 2026 against commit-state on this machine.

Every figure below was produced by running the thing it describes. Where
something is unverified or incomplete it is listed under
[What is not done](#what-is-not-done) rather than omitted.

---

## Verification summary

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run test` — with PostgreSQL + Redis up | **276 passed, 0 skipped** |
| `npm run test` — nothing listening | 230 passed, 46 skipped (integration suites skip cleanly) |
| `npm run smoke:all` — 4 in-process suites | **154 passed** |
| `npm run smoke:http` — memory driver | **96 passed** |
| `npm run smoke:http` — PostgreSQL + Redis driver | **96 passed** |
| `npm run build` | 47 routes, 84 pages prerendered, 103 kB shared JS |
| `npm audit --omit=dev` | **0 vulnerabilities** |

`npm run verify` runs lint, typecheck, tests and all four in-process smoke
suites in one command and exits 0. It picks up local PostgreSQL and Redis
automatically when they are running, and the two integration suites skip rather
than fail when they are not — so the suite is still useful on a machine with no
Docker.

---

## What was built in this phase

### PostgreSQL driver — complete and verified against a live database

The Prisma driver is not just present; it is asserted to behave *identically*
to the in-memory one. `tests/integration/postgres.test.ts` (35 tests) runs the
same query through both drivers and compares products, counts, facets and match
percentages.

That comparison paid for itself immediately — it found three real defects that
would otherwise have been environment-specific production bugs:

1. **The same product scored 95% under one driver and 94% under the other.**
   BM25's IDF and length normalisation, and the demand component's peak view and
   RFQ counts, are all relative to whatever documents happen to be indexed. The
   memory driver never noticed because its index *is* the whole catalogue; the
   Postgres driver constrains in SQL and ranks the survivors, so its corpus
   differed per query. Fixed by injecting a cached catalogue-wide statistics
   snapshot into both — the same approach as Elasticsearch's
   `dfs_query_then_fetch`. See ARCHITECTURE.md §7.4.

2. **Spec facets were counted with their own filter applied.** Selecting
   "Stainless Steel" dropped every other material to zero, the facet fell below
   its two-value threshold and disappeared, and a multi-select filter had
   silently become single-choice. Category, brand, availability and price
   already excluded their own filter; spec facets now do too.

3. **`take: NaN` took the catalogue page down under PostgreSQL.** `PAGE_SIZE`
   was imported from a `'use client'` module into a Server Component, so it
   arrived as a client reference object rather than a number. The memory driver
   silently returned an empty slice; Postgres rejected the query outright. This
   is the second occurrence of that bug class — `MAX_COMPARE` did the same in
   phase 4 — so the constants now live in `src/lib/`, both drivers reject a
   non-finite limit explicitly, and there is a regression test.

**Verified live:** migrations applied to PostgreSQL 16 + pgvector, 63 products
seeded with 256-dimension embeddings, the generated `tsvector` column and its
GIN index confirmed present, a cosine-similarity query answered through
pgvector, and the full 96-check HTTP suite passing with `DATA_DRIVER=postgres`.

### Testing

| Suite | Count | Runtime |
|---|---|---|
| Unit — engine, parsing, scoring, persistence, auth, corpus stats, uploads, CSV | 202 | node |
| Component — match score, empty and error states | 28 | jsdom |
| Integration — PostgreSQL driver parity | 35 | node + live DB |
| Integration — distributed rate limiting | 11 | node + live Redis |
| In-process smoke suites | 154 | node |
| HTTP smoke | 96 | live server |

The integration suites deliberately do not mock. A fake Redis returning
whatever the test expects would pass while the Lua script was wrong, so they
skip when the real thing is unreachable instead.

The component tests found a real defect: `NetworkErrorState` rendered no action
at all when given no retry handler, contradicting the rule stated in its own
file header that every state ends with a way forward.

### Distributed rate limiting

Token bucket — not a fixed window, which admits double the quota across its
edge. Counted in Redis by an atomic Lua script when `REDIS_URL` is set.

Verified against a live Redis: fifty concurrent spends against a bucket of ten
admit **exactly ten** (a read-modify-write pair would admit more), buckets are
shared across independent connections, they refill continuously rather than
resetting, untouched keys expire, and a `SCRIPT FLUSH` underneath a running
process is recovered from rather than turning into a rejection storm.

When Redis is configured but unreachable, the limiter falls back to the
in-process bucket rather than failing open — a degraded limit still stops a
password-guessing script, and an unreachable cache must not be able to remove
the protection entirely.

One real bug was found while testing this: `enableOfflineQueue: false` rejects
every command issued before the socket is ready, so the window right after a
deploy — exactly when a retry storm is most likely — would silently lose
distributed limiting.

### CSP nonce

A per-request nonce is applied to every route that **cannot** be prerendered by
construction: `/account`, `/admin`, `/assistant`, `/compare` and the auth pages.
`'unsafe-eval'` is development-only and is confirmed absent from production
responses.

A nonce and static prerendering are mutually exclusive, so the 84 prerendered
pages keep `'unsafe-inline'` on `script-src`. That is a deliberate, documented
trade rather than an oversight — see ARCHITECTURE.md §7.3 — and those pages hold
no credentials, run no privileged action and render no user-submitted content.

The application's own inline script, the pre-paint theme bootstrap, was moved to
an external file so it needs neither a nonce nor `unsafe-inline`.

`smoke:http` asserts the property that actually matters: every `<script>` on a
nonced page carries the nonce from **its own response header**, and the nonce is
fresh per request. A nonce in the header with unnonced scripts in the body is a
broken page, not a hardened one.

### Audit trail

Append-only. There is no edit or delete path anywhere in the application, and
the repository exposes none — retention is a scheduled database job, so an
operator cannot quietly remove an entry about themselves.

Wired into every privileged action: product create, update and status change,
quotation pricing and status changes, quotation messages, sign-in success and
failure, password change and reset, session revocation, data exports and image
uploads. Only the fields that actually changed are recorded, not whole
snapshots. Client addresses are stored as salted hashes.

Readable at `/admin/audit`, admin-only rather than staff — the log records what
staff did.

Verified live: entries written through real HTTP requests were read back out of
PostgreSQL.

### Mail

Two real transports, selected by which environment variable is present:
**Resend** (HTTP, works where outbound SMTP ports are blocked) and **SMTP** via
nodemailer with a pooled connection. Without either, messages are written to the
server log — including the password-reset link, so the flow stays testable —
and `/admin/settings` reports mail as unconfigured.

Templates for password reset, quotation received and quotation ready, plus a
generic notification. Table-based layout with inline styles only, every message
carrying a plain-text alternative, and a preheader so the inbox list does not
show the recipient's own address.

Sending never throws and never fails the action that triggered it: a quotation
is not un-issued because the email about it bounced.

### Uploads

Validation runs cheapest-and-most-decisive first: declared size, then actual
byte length, then **magic-byte sniffing** — the first check whose input the
server produced. The filename and `Content-Type` are ignored entirely.

The security control is the re-encode, not the validation. Decoding the pixels
and writing a fresh WebP strips embedded payloads, polyglot content and EXIF
metadata — which routinely carries GPS coordinates a supplier did not intend to
publish. SVG is refused outright and must stay refused: it can carry `<script>`
and no re-encode makes it safe.

Storage is content-addressed outside `public/`, so keys contain no user input
and path traversal is removed as a category rather than as a check. Files are
served by a handler that states the content type rather than inferring it.

Verified end-to-end over HTTP: a PHP script named `shell.png` and declared
`image/png` is rejected with 422; a real PNG is accepted, stored, and served
back as `image/webp` with `nosniff` and immutable caching; traversal attempts
return 404. A unit test confirms EXIF is gone from the stored bytes.

### CSV exports

Four exports — catalogue, quotations (one row per line item), search events,
customers — at `/api/admin/export/[kind]`. Customers is admin-only; the rest are
staff. Every download is written to the audit trail with the requesting account.

Excel-correct rather than merely valid: CRLF line endings and a UTF-8 BOM,
without which "₹" and any Devanagari arrive as mojibake. Numbers are written
unformatted so a spreadsheet can compute on them.

**Formula injection is neutralised.** Excel evaluates any cell beginning `=`,
`+`, `-` or `@`, so a product name an admin can type becomes executable in
whoever opens the file. Five payloads are covered by tests.

Verified over HTTP: anonymous and buyer requests return 404 (not 403 — that
would confirm the endpoint exists), all four exports download with the right
disposition and cache directives, and neither the catalogue nor the customer
export contains any password material.

### Invented site details removed

`src/lib/site.ts` previously carried an invented address, phone number, GSTIN
and CIN. Every organisation-specific value is now read from the environment and
**omitted entirely when unset** — the footer says the deployment is a
demonstration rather than publishing a convincing registered office that reaches
nobody. Statutory identifiers render only when real ones are configured; social
links are dropped rather than pointed at a platform home page.

`PLATFORM_STATS` — "12,400+ SKUs", "96% search success rate", "4.2 hrs median
quote response" — is deleted. `src/server/metrics/platform-stats.ts` computes
those figures from the database at request time, and **drops a figure entirely
when the data is too thin to support it honestly**: fewer than 25 search events,
or fewer than 5 quoted RFQs. A homepage with three real statistics is better
than one with four where the fourth is invented.

The same treatment was applied to prose: "specifications from 340+ suppliers" in
the hero, "Median first response across the platform is 4.2 hours" in a
quotation notification, and a "340+ suppliers" claim in the homepage metadata.

### Missing pages, found by the HTTP suite

Every page linked `/about`, `/pricing`, `/contact`, `/faq` and four
`/legal/*` documents. All eight returned **404** — nine dead links on every page
of the site, in the header and footer. This had been true since phase 1 and was
invisible to the in-process suites, which never render a layout.

All eight are now built: About (the mechanism, with figures read from the
database), Pricing, Contact (env-driven, honest when unconfigured), a
four-section FAQ using native `<details>` so it works without JavaScript, and
terms, privacy, refund and security documents.

The legal pages describe what the software genuinely does — every claim about
the software is checkable against the source — and each says on its face that it
has not been reviewed by a lawyer for a specific entity or jurisdiction. A
convincing-looking legal page nobody reviewed is worse than an honest one.

### Dependency vulnerabilities cleared

`npm audit` reported 6 high-severity advisories via transitive dependencies:
libvips CVEs through `sharp`, an XSS advisory in `postcss`, and stack exhaustion
in `deepmerge-ts` through the Prisma CLI. The suggested fix was a Next.js major
upgrade.

Resolved with npm `overrides` pinning patched versions instead, then verified
that Prisma still validates and generates and that the application still builds.
**`npm audit --omit=dev` now reports 0 vulnerabilities.** This mattered more
than usual because the upload pipeline feeds untrusted images to libvips.

---

## Requires an external service or environment variable

Nothing below blocks the application from running. Each degrades to a documented
local behaviour, and `/admin/settings` reports which are active.

| Capability | Needs | Without it |
|---|---|---|
| **Session signing** | `AUTH_SECRET` (≥32 chars) | **Production start-up throws.** Development uses a fixed fallback key. This is the one hard requirement — a predictable signing key is a total authentication bypass |
| **PostgreSQL driver** | `DATABASE_URL`, `DATA_DRIVER=postgres`, migrations, seed | In-memory driver with JSON persistence. Correct for one process; writes are lost with the file store |
| **Distributed rate limiting** | `REDIS_URL` | Counted in-process. Correct for a single instance; each replica behind a load balancer grants its own quota |
| **Email** | `RESEND_API_KEY` **or** `SMTP_URL`, plus `MAIL_FROM` | Messages written to the server log, reset link included. Admin settings reports mail as unconfigured |
| **AI assistant prose** | `ANTHROPIC_API_KEY`, `AI_PROVIDER=claude` | Deterministic offline parser. **Ranking, filtering and scoring are identical either way** — the model never touched them |
| **Audit address correlation** | `AUDIT_IP_SALT` | A fixed development salt. Entries are still written; only cross-environment correlation is affected |
| **Image storage at scale** | `UPLOAD_DIR` on a mounted volume, or an S3 driver behind `UploadStorage` | Local filesystem. Ephemeral and per-instance on a serverless host |
| **Organisation details** | `NEXT_PUBLIC_*` (see `.env.example`) | Omitted from the site; the footer states it is a demonstration deployment |

Local infrastructure for all of the above: `docker compose up -d` starts
PostgreSQL 16 + pgvector and Redis 7.

---

## What is not done

Stated plainly rather than left to be discovered.

- **The ivfflat vector index and the `tsvector` column exist but are not on the
  read path.** Both are created by migration and populated by the seed, and the
  integration suite confirms they answer queries — but `PrismaCatalogRepository`
  still constrains in SQL and ranks in application memory, capped at 600
  candidates. That is correct and fast at this catalogue size and is the
  documented next step at scale.

- **Uploaded images are never garbage-collected.** An abandoned admin form
  leaves an orphaned file. That is the cheaper failure — an orphan is
  reclaimable by a sweep, a half-written product is not — but the sweep is not
  written.

- **No object-storage driver.** `UploadStorage` is a seam with one local
  implementation. On a serverless host this needs an S3 or R2 driver behind the
  same interface.

- **No email verification or delivery tracking.** Registration sets
  `emailVerified: false` and nothing sends a confirmation. Bounces and
  complaints are not consumed from the provider; a send reported as successful
  means accepted by the relay, not delivered.

- **No supplier portal.** The schema is seller-scoped throughout and the admin
  quotation console does the work, but suppliers have no login of their own.

- **Audit retention is not scheduled.** The table grows without bound. The
  application deliberately has no delete path; the scheduled database job that
  should trim it does not exist yet.

- **No CI pipeline.** Every check is a single npm script and they all pass, but
  nothing runs them automatically on push.

- **`smoke:http` is not in `npm run verify`.** It needs a built, running server
  and minted session cookies, so it is a separate documented step rather than
  part of the one-command check.

- **Load and performance budgets are unmeasured.** ARCHITECTURE.md §8 states
  targets (LCP < 2.0s, INP < 200ms, CLS < 0.05). The build output supports them
  — 103 kB shared JS, 84 pages prerendered, blur placeholders and explicit
  dimensions throughout — but no Lighthouse or load test has been run.

- **Seed data is fictional.** Brands and sellers use no real trademark, product
  specifications are realistic but invented, and datasheet links resolve to
  `/documents/*.pdf`, which do not exist.

---

## Environment used for verification

- Node with Next.js 15.5.23, React 19.2.8, TypeScript strict with
  `noUncheckedIndexedAccess`
- PostgreSQL 16 with pgvector (`pgvector/pgvector:pg16`), Redis 7-alpine, both
  via `docker-compose.yml`
- Prisma 6.19.3, Vitest 3.2.7
- Windows 11, project inside a OneDrive-synced folder — `.next` must be removed
  before a build in the same shell invocation, as README notes

Two containers, `sourcely-postgres` and `sourcely-redis`, were started during
this work and are still running. `docker compose down` stops them;
`docker compose down -v` also drops the seeded data.
