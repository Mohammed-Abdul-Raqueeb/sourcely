# Sourcely

**AI-native B2B industrial product discovery.**
Buyers describe the problem in their own words. Sourcely resolves it into a
structured specification, retrieves and ranks matching products, explains the
match, and turns the shortlist into a Request for Quotation.

India · INR · RFQ-first (no cart, no checkout)

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No database. No API key. No Docker. The catalogue, the search index and the
natural-language parser all run in-process — see [ARCHITECTURE.md](./ARCHITECTURE.md)
sections 3.4 and 5.2 for why that is a deliberate design property and not a
placeholder.

**Sign in with the demo account.** It is pre-seeded with a shortlist, search
history, two quotation requests and notifications, so the dashboard is
populated on first load. The credentials are printed on the sign-in page too.

| Role | Email | Password |
|---|---|---|
| Buyer | `buyer@deccanprojects.in` | `Sourcely2026` |
| Admin | `admin@sourcely.in` | `Sourcely2026` |

### Checks

```bash
npm run verify           # lint + typecheck + unit/component tests + smoke suites

npm run test             # Vitest — 241 tests, +34 more when a database is up
npm run test:coverage
npm run typecheck        # tsc --noEmit
npm run lint
npm run build            # production build

npm run smoke:all        # all four in-process suites — 154 checks
npm run smoke            # search engine + ranking quality        (20)
npm run smoke:auth       # passwords, tokens, sessions, scoping   (67)
npm run smoke:assistant  # follow-ups, refinement, honesty        (27)
npm run smoke:admin      # catalogue writes, quoting, comparison  (40)
```

The suites above call the services directly. Anything that only exists once a
request has been through Next — response headers, the CSP nonce, route guards,
cache directives, download dispositions — needs a running server:

```bash
npm run build && npm start           # in one terminal

npm run mint-session                 # prints a buyer session cookie
npm run mint-session admin           # …and an admin one

SMOKE_CUSTOMER_COOKIE='sourcely_session=…' SMOKE_ADMIN_COOKIE='sourcely_session=…'   npm run smoke:http                 # 96 checks over HTTP
```

Two things trip people up here, both by design:

- **Mint sessions before starting the server.** Under the memory driver the
  store is loaded once per process, so a session written afterwards is
  invisible to it. Under `DATA_DRIVER=postgres` the order does not matter.
- **`AUTH_SECRET` must match** between `mint-session` and the server, or the
  cookie is signature-invalid and every guarded route redirects to sign-in.
  Both read it from `.env.local`; `mint-session` needs it exported if you run
  it with a different environment.

Signed-in checks are skipped rather than failed when no cookie is supplied.

### Running against PostgreSQL and Redis

```bash
docker compose up -d     # postgres 16 + pgvector, redis 7
npm run db:migrate
npm run db:seed

# then set DATA_DRIVER="postgres" and REDIS_URL in .env.local
```

`tests/integration/postgres.test.ts` asserts that the two drivers return the
same products, the same counts and the same match percentages — it skips
entirely when no database is reachable. `tests/integration/rate-limit.test.ts`
does the same for Redis, including that fifty concurrent spends against a
bucket of ten admit exactly ten.

### Windows / OneDrive note

This project lives inside a OneDrive-synced folder. OneDrive intermittently
locks files in `node_modules` during `next build`, producing
`EBUSY: resource busy or locked`. Re-running the build succeeds. To remove the
problem entirely, either move the project outside OneDrive or exclude
`node_modules` and `.next` from sync.

---

## What is built

| Phase | Scope | Status |
|---|---|---|
| **0** | Architecture, design system, domain model, seed catalogue, search engine | **done** |
| **1** | Home, navigation, product listing, product detail, categories | **done** |
| **2** | Auth, sessions, roles, customer dashboard, settings | **done** |
| **3** | AI assistant workspace, conversational refinement, follow-up questions | **done** |
| **4** | Comparison page, RFQ workflow end to end, notifications | **done** |
| **5** | Admin dashboard, product management, search analytics | **done** |
| **6** | Postgres driver, tests, distributed rate limiting, audit trail, CSP nonce, mail, uploads, exports | **done** |

**Public** `/` · `/products` · `/products/[slug]` · `/categories` ·
`/categories/[slug]` · `/assistant` · `/compare` · `/about` · `/pricing` ·
`/contact` · `/faq` · `/legal/[terms|privacy|refunds|security]`
**Auth** `/login` · `/register` · `/forgot-password` · `/reset-password`
**Account** `/account` · `/saved` · `/searches` · `/recent` · `/assistant` ·
`/comparisons` · `/rfq` · `/rfq/[id]` · `/rfq/new` · `/notifications` ·
`/settings`
**Admin** `/admin` · `/products` · `/products/new` · `/products/[id]` ·
`/inventory` · `/categories` · `/brands` · `/rfq` · `/rfq/[id]` ·
`/customers` · `/search-analytics` · `/ai` · `/reports` · `/audit` · `/settings`
**API** `/api/assistant/query` · `/api/account/shortlist` ·
`/api/admin/export/[kind]` · `/api/admin/upload` · `/api/media/[...key]`

84 pages prerender — the homepage, catalogue, every category and product page,
and the written pages. `/account`, `/admin` and `/products` are server-rendered
per request, the last because its filter state lives in the URL. That split is
also what decides which routes carry a CSP nonce; see ARCHITECTURE.md §7.3.

### Comparison

`/compare?ids=…` is URL-driven so a comparison is shareable. Arriving from the
floating tray instead? The ids live in `localStorage`, and a small client
component promotes them into the URL on mount.

Rows where every product agrees are dimmed and can be hidden entirely — the
reader came for the differences. Within a differing row the strongest value is
ticked, but **only where "strongest" is unambiguous**: lowest price, longest
warranty, readiest stock, highest rating. A higher pressure rating is not
automatically better, so numeric specs are left unmarked, and a tie crowns
nobody.

### Admin

`requireRole('staff')` runs in the admin layout *and* again inside every server
action. That is not belt-and-braces: a Server Action is a public POST endpoint
whose id ships in the client bundle, so an action that merely *renders* inside
an admin page is still reachable by anyone who finds the id.

- **Product management is real.** Admin edits are stored as an overlay on the
  seed catalogue with a `catalogVersion` counter; a write bumps it and the
  search index rebuilds on the next read. Archiving is a status change, never a
  delete — a product that has been quoted still has to resolve for the RFQ that
  references it.
- **The form is driven by the spec registry.** Choosing "Valves" produces valve
  fields; choosing "Electrical" produces current rating and breaking capacity.
  No field is hardcoded.
- **`AdminRepository` is a separate interface** from the user-scoped
  `ActivityRepository`. Every method there is scoped by `userId` — that scoping
  *is* the security property, and putting an unscoped `listAllRfqs` beside
  `listRfqs(userId)` would leave a privileged call one autocomplete away from
  an accidental leak.
- **A quoted total is derived from its line items**, never accepted from the
  form. A header total that disagrees with its own lines is the fastest way to
  lose a buyer's trust in the whole quotation.
- **`/admin/ai` keeps the promise in ARCHITECTURE.md §3.2** — the live weight
  model, per-category overrides, and a query box that runs the real parser and
  shows the actual score arithmetic behind the top result.

### The assistant

`/assistant` is a three-column workspace, not a chat window. The middle column
is the conversation; the right column is the **resolved specification**, which
is the part that matters — every chip is removable, and removing one refines
the previous intent rather than re-parsing the sentence.

- **One follow-up question, chosen by information gain.** When a request is
  under-specified, the assistant asks about the single field that most reduces
  the candidate set — Shannon entropy over the value distribution, weighted by
  how much that spec matters for the category. Rendered as tappable chips with
  live result counts, because typing a specification on a phone is where these
  conversations die.
- **Refinement is server-side.** The client sends an *action* (`ask`, `answer`,
  `remove-chip`), never a `SearchIntent`. Accepting an intent from the client
  would be accepting a search filter from the client.
- **Honesty rules are tested.** Narration must report the true match count and
  not the page size, must never describe a failing criterion as satisfied, and
  a zero-result answer must name the binding constraint. `npm run smoke:assistant`
  asserts all three.

---

## The engine

The part that matters is not that an LLM is involved — it is that one mostly
is not. See [ARCHITECTURE.md §3](./ARCHITECTURE.md#3-the-retrieval-and-ranking-pipeline).

```
natural language
      ↓
1. INTENT PARSE      Claude, or the deterministic offline parser
      ↓                units, synonyms, negation, category inference
2. CONSTRAIN         hard filters — price ceiling, stated exclusions
      ↓
3. RETRIEVE          BM25  ⊕  vector cosine, fused by reciprocal rank
      ↓
4. SCORE             8-component weighted model, per-category weights
      ↓
5. DIVERSIFY         brand cap on selection, never on ordering
      ↓
6. EXPLAIN           criteria table generated from the score breakdown
```

**The LLM has no write authority.** It converts language into a schema and
rephrases a computed result. It cannot filter, price, rank, or mutate. Every
number a buyer sees comes from `src/server/catalog/scoring.ts` and is
unit-testable.

Match percentages are floored at 42 and capped at 97. A catalogue cannot know
that a product is a *perfect* answer to a human requirement, and claiming so is
a trust liability.

---

## Layout

```
src/
├── app/
│   ├── layout.tsx              root — fonts, theme bootstrap, metadata
│   ├── globals.css             design tokens (the only place colours exist)
│   └── (marketing)/            public site shell + pages
├── components/
│   ├── ui/                     design system primitives
│   ├── layout/                 header, footer, logo, theme toggle
│   ├── catalog/                product cards, filters, gallery, artwork
│   └── home/                   the eight homepage sections
├── lib/
│   ├── domain/                 pure types — the shared contract
│   ├── catalog-params.ts       URL ⇄ CatalogQuery
│   ├── format.ts               en-IN pinned formatting
│   └── site.ts                 brand, contact, navigation  ← edit this first
└── server/
    ├── catalog/                spec registry, BM25, vectors, scoring, engine
    ├── ai/                     provider seam, offline parser, follow-ups, chips
    ├── auth/                   passwords, session tokens, rate limiting
    ├── actions/                server actions (auth, account, RFQ)
    ├── seed/                   taxonomy + 63 hand-written products
    └── repositories/           the persistence seam (memory | prisma)
```

### Authentication

bcrypt at cost 12, an HttpOnly session cookie carrying a signed JWT, and a
server-side session record that decides whether that token is *still* valid —
which is what makes sign-out and "sign out everywhere" take effect immediately
rather than whenever the token happens to expire.

Middleware does cheap route gating only; it runs on the Edge and cannot reach
the session store, so **the authoritative check is `requireUser` / `requireRole`
in the layout**, and the repository scopes every read by user id. Middleware is
a fast path, not the security boundary.

Login is uniform in both message and timing: an unknown email still runs a
bcrypt comparison against a dummy hash, so response latency is not a
user-enumeration oracle. Reset tokens are stored as SHA-256 hashes, are
single-use, and issuing a new one invalidates the last.

---

## Things worth knowing before you change something

**Colours live in exactly one file.** `src/app/globals.css`. Components
reference semantic tokens (`bg-surface`, `text-muted`, `border-accent-line`),
never raw values. Amber is reserved for primary actions and match scores —
its scarcity is what makes it read as signal.

**The specification registry is the vocabulary of the whole product.**
`src/server/catalog/spec-registry.ts` drives facets, the comparison grid, the
offline parser's synonym resolution, and the ranking weights. Adding a spec
there makes it filterable, comparable, searchable in natural language and
rankable with no other code change.

**Seed data fails loudly.** An unknown spec key or an invalid enum value throws
at boot rather than producing a product that silently cannot be filtered.

**Filter state is in the URL, never in React state.** That is what makes a
filtered result set shareable, bookmarkable, back-button-correct and
server-rendered.

**Product imagery: real photos by drop folder, line art as the fallback.**
Put images named by SKU into `product-images/` (see the README there for the
full filename list) and run `npm run images:ingest`: each is re-encoded to
WebP, given a blur-up placeholder, written to `public/products/`, and recorded
in the generated manifest that the seed reads at boot. `<ProductMedia />`
serves any manifest or uploaded URL through `next/image`; products without a
photo keep the generated technical line art, so a partial image set never
leaves a hole. Admin uploads (`.data/uploads`, served via `/api/media`)
continue to take precedence per product.

**A constant read on both sides of the client boundary lives in `src/lib`.**
Importing one from a `'use client'` module into a Server Component does not give
you the value; it gives you a client reference object, and arithmetic on it
yields `NaN` with no error. This has now bitten twice: `MAX_COMPARE` truncated
a comparison to zero products in phase 4, and `PAGE_SIZE` produced `take: NaN`
in phase 6 — which the memory driver swallowed and PostgreSQL rejected with an
error naming neither the page nor the constant. `src/lib/compare.ts`,
`src/lib/pagination.ts` and `src/lib/uploads.ts` exist for this reason.

**The audit trail has no write path other than append.** No edit, no delete,
nowhere in the application. Retention is a scheduled database job, so an
operator cannot quietly remove an entry about themselves. Recording never fails
the action it describes — a write that succeeded but whose audit row failed must
not be rolled back and reported as an error, or the operator retries and does
it twice.

---

## Configuration

Copy `.env.example` to `.env.local`. Everything has a working default and
nothing is required to run — except `AUTH_SECRET`, which production start-up
refuses to boot without rather than falling back to a predictable signing key.

| Variable | Default | Effect |
|---|---|---|
| `AUTH_SECRET` | dev-only fallback | **Required in production.** A predictable signing key is a total authentication bypass, so a missing one throws rather than degrading |
| `DATA_DRIVER` | `memory` | `postgres` uses Prisma + PostgreSQL 16 + pgvector |
| `DATABASE_URL` | — | required by the `postgres` driver |
| `REDIS_URL` | — | shares one rate-limit bucket across instances; in-process without it |
| `AI_PROVIDER` | `offline` | `claude` upgrades intent parsing and explanations. Ranking is identical either way |
| `ANTHROPIC_API_KEY` | — | server-only; no AI call is ever made from the browser |
| `RESEND_API_KEY` / `SMTP_URL` | — | either enables real mail; without both, messages are written to the server log |
| `MAIL_FROM` | — | sender address; mail counts as unconfigured without it |
| `UPLOAD_DIR` | `.data/uploads` | where re-encoded product images are written |
| `AUDIT_IP_SALT` | dev-only fallback | salt for hashing client addresses in the audit trail |
| `NEXT_PUBLIC_*` | — | organisation details. Unset values are omitted from the site, never substituted |

`/admin/settings` reports the resolved driver, AI provider, rate-limit backend,
mail transport, and which organisation details are still unset.

---

## Before this goes anywhere public

There are no invented organisation details left in the source. Contact address,
phone, email, GSTIN, CIN and social links are all read from the environment and
**omitted entirely when unset** — the footer says the deployment is a
demonstration rather than publishing a convincing-looking registered office
that reaches nobody. Set them in `.env.local`; every variable is listed in
[.env.example](./.env.example), and `/admin/settings` shows which are missing.

The homepage figures are computed from the database by
`src/server/metrics/platform-stats.ts`, not written into a constant. Where the
data is too thin to support a figure honestly — fewer than 25 search events,
fewer than 5 quoted RFQs — the figure is dropped rather than padded.

What genuinely remains:

- **Seed data is fictional by design.** Brands and sellers in
  `src/server/seed/taxonomy.ts` use no real trademark. Product specifications
  are realistic but invented.
- **Product datasheet links** resolve to `/documents/*.pdf`, which do not exist.
  Real files or an object-store URL are needed before those links mean anything.
- **The legal pages** at `/legal/*` describe what this software actually does,
  and every claim about the software is checkable against the source. They have
  not been reviewed by a lawyer for a specific operating entity or jurisdiction,
  and each page says so on its face.
- **Pricing plan figures** on `/pricing` are the platform's own list pricing —
  a product decision, and the one set of numbers on the public site that is
  written rather than computed.
