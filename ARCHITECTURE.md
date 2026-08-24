# Sourcely — Product & Technical Architecture

> **AI-native B2B industrial product discovery.**
> Buyers describe the problem in their own words. Sourcely resolves it into a
> structured specification, retrieves and ranks matching products, explains the
> match, and converts the shortlist into a Request for Quotation.

**Version** 1.0 · **Market** India (INR, ₹) · **Model** RFQ-first B2B (no cart, no checkout)

---

## 1. The problem this product exists to solve

Industrial buyers rarely know the product name. They know the *problem*:

> "I need something to control water flow in a commercial HVAC riser. Stainless,
> threaded connection, and it has to survive 16 bar."

Traditional e-commerce forces that intent through a keyword box and a column of
checkboxes. The buyer must already know that the answer is a *2-piece stainless
steel ball valve, SS316, BSP threaded, PN16* before they can find it. That is a
**vocabulary gap**, and it is where B2B catalogue conversion dies.

Sourcely closes the gap in one hop: **natural language in → ranked, explained,
specification-matched products out.**

The three failure modes we design against:

| Failure | Conventional catalogue | Sourcely |
|---|---|---|
| Buyer lacks the term | Zero results, buyer leaves | Intent → category + spec inference |
| Buyer under-specifies | Returns 4,000 items | Assistant asks the *one* highest-entropy follow-up |
| Buyer cannot judge trade-offs | Buyer opens 6 tabs | Side-by-side compare + AI trade-off summary |

**Design principle that governs every decision below:** the AI is infrastructure,
not the feature. Nothing in the UI should say "powered by AI" where it could
instead say "92% match — SS316 body, BSP threaded, within your ₹5,000 budget."
Show the reasoning, not the technology.

---

## 2. Domain model

The catalogue is **specification-first**. A product is not a blob of marketing
text with a price; it is a typed specification sheet that a machine can reason
over. This is the single most important modelling decision in the system —
every ranking, filter, comparison and explanation feature depends on it.

### 2.1 Core entities

```
Seller ─┬─< Product >─┬─ Category (self-referencing tree)
        │             ├─ Brand
        │             ├─< ProductSpec      (typed attribute values)
        │             ├─< ProductImage
        │             ├─< ProductDocument  (datasheet, IS/ISO cert, CAD)
        │             ├─< ProductApplication
        │             └─  ProductEmbedding (1 : 1, vector)
        └─< RfqItem

User ─┬─< Session
      ├─< SavedProduct            (shortlist)
      ├─< SavedSearch
      ├─< ComparisonSet ─< ComparisonItem
      ├─< Conversation ─< Message ─< MessageResult
      ├─< SearchEvent             (analytics spine)
      ├─< ProductView
      ├─< Rfq ─< RfqItem, ─< RfqMessage
      └─< Notification
```

### 2.2 Why `ProductSpec` is a typed side table, not a JSON column

A valve has `connection_size`, a pump has `head_metres`, a breaker has
`breaking_capacity_ka`. Modelling this as one wide table is impossible; modelling
it as opaque JSON makes faceting and range filters impossible.

`ProductSpec` is an **EAV table with a typed value column set**, governed by a
`SpecDefinition` registry per category:

| column | purpose |
|---|---|
| `key` | canonical key, e.g. `connection_size_dn` |
| `valueText` | enum/string values (`SS316`, `Threaded`) |
| `valueNumber` + `unit` | numeric values for **range filters and scoring** |
| `valueBool` | flags |
| `displayValue` | pre-rendered human string (`DN50 (2 inch)`) |
| `isFilterable` / `isComparable` / `rankWeight` | drives facets, compare grid, ranking |

`SpecDefinition` carries the unit, the datatype, the allowed enum, the synonym
list (`SS`, `stainless`, `SS304` → `material=stainless_steel`) and the
per-category ranking weight. **The synonym list is what lets the offline NLU
engine work without an LLM**, and what grounds the LLM when one is configured.

### 2.3 Multi-seller readiness

Every product carries `sellerId` from day one and every catalogue query is
seller-scoped-capable. The seller portal is not built in phase 1, but no
migration is required to add it — a decision made now specifically to satisfy
the "multiple businesses/sellers" requirement without paying for it up front.

### 2.4 Scale posture

Targets: **10,000+ products, 100k+ SKU-specs, thousands of concurrent users.**

- Cursor pagination everywhere (no `OFFSET` scans).
- Composite indexes: `(categoryId, status, price)`, `(sellerId, status)`,
  `(brandId, status)`; GIN on `searchVector`; `ivfflat` on `embedding`.
- Facet counts come from a **materialised rollup** refreshed on write, not from
  `COUNT(*) GROUP BY` per request.
- Embeddings are computed in a background job on product write, never inline.

---

## 3. The retrieval and ranking pipeline

This is the engine. It is **deliberately not "ask the LLM and print the answer"** —
an LLM cannot see 10,000 products, cannot be trusted on price arithmetic, and
cannot produce a stable ranking. The LLM does what it is genuinely good at
(language → structure, and structure → explanation) and classical IR does the rest.

```
 natural language query
          │
          ▼
┌─────────────────────┐
│ 1. INTENT PARSE     │  LLM (Claude) with a strict JSON schema,
│                     │  OR deterministic offline parser.
│                     │  Output: SearchIntent
└──────────┬──────────┘
           │  category, brand, material, price band, size, application,
           │  quantity, industry, compatibility, free-text residue,
           │  + per-field confidence, + missingCriticalFields[]
           ▼
┌─────────────────────┐
│ 2. CONSTRAIN        │  Hard filters. Non-negotiable facts:
│                     │  status=active, price <= max, category in tree,
│                     │  in-stock if requested. Reduces 10k to ~10^2-10^3.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 3. RETRIEVE (hybrid)│  a) BM25 over name+description+tags+spec text
│                     │  b) Cosine over product embedding
│                     │  fused by Reciprocal Rank Fusion (k=60)
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 4. SCORE            │  Explainable weighted model — see 3.2
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 5. DIVERSIFY        │  Cap 2 per brand in top 8 so the page is not
│                     │  one vendor; keep one budget and one
│                     │  heavy-duty outlier for trade-off framing.
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ 6. EXPLAIN          │  Per-product: which criteria matched, which
│                     │  did not. Generated from the score breakdown —
│                     │  facts first. LLM only rephrases; it never
│                     │  invents a reason and never sees the price math.
└──────────┬──────────┘
           ▼
   ranked results + match % + "why this matches" + editable filter chips
```

### 3.1 Why the score is computed, not generated

Every number the user sees — the match percentage, the "matched 4 of 5 criteria"
line — comes from step 4, a deterministic function. This gives us three things an
LLM cannot: **stability** (same query → same ranking), **auditability** (admin
analytics can show exactly why a search failed), and **honesty** (the model
cannot hallucinate a spec the product does not have).

### 3.2 The scoring model

```
score = sum( w_i * component_i ) , normalised to 0..1, surfaced as a match %

  specMatch      0.34   fraction of requested specs satisfied, weighted by
                        SpecDefinition.rankWeight; exact enum hit = 1.0,
                        compatible-substitute = 0.6, contradiction = 0.0
  semantic       0.22   cosine(query embedding, product embedding)
  lexical        0.14   BM25, normalised against the candidate set
  priceFit       0.12   1.0 inside band; decays smoothly outside;
                        hard-zero above an explicit maximum
  applicationFit 0.08   requested application in product applications
  availability   0.05   in-stock > lead-time > made-to-order
  popularity     0.03   log-damped view/RFQ counts — a tiebreaker, never a driver
  sellerTrust    0.02   fulfilment rate, response time
```

Weights live in `src/server/catalog/ranking-weights.ts`, are per-category
overridable, and are **surfaced in the admin dashboard** so search quality is a
tunable product parameter rather than a hidden constant.

Match % is a *floored, banded* presentation of the score (never shows 100%,
never shows below 40% — below that the product is not shown at all). Showing
"100% match" is a trust liability; showing "94%" reads as measured.

### 3.3 The follow-up question strategy

When `missingCriticalFields` is non-empty, we do **not** interrogate the user.
We ask **one** question — the field with the highest expected information gain,
computed as the field that most reduces the candidate set entropy:

```
nextQuestion = argmax_f  H(candidates) - E[H(candidates | f)]
```

In practice: if 400 candidates remain and `connectionSize` splits them into
even buckets while `brand` does not, we ask about connection size. The question
is rendered with tappable chips, not a blank input — one thumb tap on mobile.

### 3.4 Graceful degradation (`AI_PROVIDER=offline`)

The offline engine is a real implementation, not a stub:

- **Intent parsing** — normalisation, unit extraction (`DN50`, `2 inch`, `₹5,000`,
  `5k`, `16 bar`), synonym resolution against `SpecDefinition`, category
  classification by weighted term overlap, negation handling (`not brass`).
- **Semantic retrieval** — a deterministic hashed character-n-gram + term
  embedding built at seed time. Lower recall than a neural embedding, but real
  vector search with real cosine similarity.
- **Explanations** — templated from the score breakdown.

The whole product demos, end to end, with **no API key and no network**. Setting
`AI_PROVIDER=claude` upgrades steps 1 and 6 in place; steps 2-5 never change.
This is why the provider is an adapter behind `AiProvider` and not `fetch()`
calls sprinkled through route handlers.

---

## 4. Information architecture

```
PUBLIC
  /                        Home (8 sections)
  /products                Listing — dual-mode: Traditional / AI search
  /products/[slug]         Detail — gallery, specs, docs, why-recommended
  /categories              Category index
  /categories/[slug]       Category landing (SEO surface)
  /assistant               AI workspace  <- primary conversion surface
  /compare                 2-4 product comparison + AI trade-off summary
  /about  /contact  /faq  /pricing
  /login  /register  /forgot-password  /reset-password

CUSTOMER  (role: customer)
  /account                 Dashboard
  /account/assistant       Conversations
  /account/searches        Search history + saved searches
  /account/saved           Shortlist
  /account/comparisons
  /account/rfq             RFQs + thread
  /account/recent          Recently viewed
  /account/notifications
  /account/settings

ADMIN  (role: admin | staff)
  /admin                   Dashboard + analytics
  /admin/products          List / create / edit / bulk import
  /admin/categories  /admin/brands  /admin/inventory
  /admin/search-analytics  queries, zero-result rate, ranking quality
  /admin/ai                intent accuracy, weight tuning, failed parses
  /admin/customers  /admin/rfq  /admin/reports  /admin/settings
```

**Navigation rule.** The public header carries exactly five destinations plus one
primary CTA. Everything else is reachable but not promoted. A B2B catalogue with
nine top-level nav items reads as a directory, not a product.

**Header session state.** Marketing pages are statically prerendered (§7.3), so
the header cannot read the session cookie at render time. It reuses the
shortlist provider's post-mount reconcile: `GET /api/account/shortlist` returns
the caller's own display identity (`user: { name, role }`, `no-store`)
alongside the saved ids, and the header swaps "Sign in" for the account state —
plus an Admin link for staff and admin roles — once that resolves. The static
HTML always says "Sign in", so there is no hydration mismatch; authorization is
unaffected because the role in the payload only shows a link, while `/admin`
stays gated by middleware and `requireRole`.

---

## 5. Technical architecture

### 5.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | RSC keeps the catalogue payload small; one deployable |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | The spec engine is index-heavy; this catches real bugs |
| Styling | Tailwind CSS v4, CSS-first `@theme` tokens | Design tokens are actual CSS variables, themeable at runtime |
| Motion | Framer Motion | Scoped to entrances and micro-interaction only |
| Validation | Zod | One schema shared by route handler, form, and LLM tool-call contract |
| Persistence | Repository interface + two drivers | see 5.2 |
| AI | `AiProvider` adapter: `claude` or `offline` | see 3.4 |

### 5.2 The data layer boundary

```
route handler / server component
        │  (never touches the DB directly)
        ▼
   service        src/server/services/*      business rules, authz, events
        │
        ▼
   repository     src/server/repositories/   interface — the seam
        ├── memory/    JSON-persisted, seeded, zero-infrastructure  <- default
        └── prisma/    PostgreSQL 16 + pgvector                     <- production
```

The seam exists for a concrete reason: **the project must run and demo
immediately after `npm install`, with no database server and no API key**, while
still being a genuine Postgres application. `DATA_DRIVER` selects the driver at
the composition root. Services, and therefore every page, are identical in both.

### 5.3 Request flow (AI search)

```
Client                Route handler              Service            Provider
  │  POST /api/assistant/query                       │                 │
  ├───────────────>  zod parse                       │                 │
  │                  rate limit (per user + IP)      │                 │
  │                  session -> userId               │                 │
  │                       └──────────────────────>  interpret ───────> │  Claude
  │                                                  │<────────────────┘  or offline
  │                                                  ├─ chat? reply and stop
  │                                                  ├─ constrain
  │                                                  ├─ retrieve (BM25 + vector)
  │                                                  ├─ score + diversify
  │                                                  ├─ explain ──────> │
  │                                                  ├─ persist SearchEvent
  │  <─── stream: intent chips -> results -> prose ──┘                 │
```

The response **streams in three stages** so the user sees the parsed filter
chips within ~200 ms, before retrieval finishes. Perceived latency is a design
surface, not an infrastructure problem.

**The conversational gate.** `interpret` classifies a fresh question before
anything searches: a greeting, thanks, or a "what can you do" gets a
conversational reply and never touches the engine, while anything carrying
product structure flows through the pipeline unchanged. The rule is
deliberately conservative and enforced in both providers — a message chats
only when it matches a small small-talk lexicon AND the offline parser finds
no structure in it (`src/server/ai/conversation.ts`), so "hi, I need a DN50
valve" always searches. Chat turns append to the same conversation (context is
preserved) but are not recorded as search events, so admin search analytics
stay honest.

---

## 6. Design system

**Identity:** *Sourcely* — industrial supply, warm signal on cold steel.
Deep slate surfaces, a single amber accent reserved for action and match score.
Dark-first with a complete light theme.

| Token group | Notes |
|---|---|
| Colour | `--bg` `--surface` `--surface-2` `--border` `--text` `--muted` `--accent` + semantic `success/warn/danger/info`. Amber is used **only** for primary CTA and match score — scarcity is what makes it read as signal. |
| Type | **Archivo** display (tight tracking, industrial-editorial) · **Inter** UI · **JetBrains Mono** for SKU, spec values, prices — tabular figures so spec tables align |
| Space | 4-point scale; generous section rhythm (96-128px desktop) |
| Radius | 4 / 8 / 12 / 16 / 24 |
| Elevation | Two shadows only, both low-contrast. Depth comes from borders, not drop shadows |
| Motion | 150ms micro / 250ms entrance / `cubic-bezier(.16,1,.3,1)`. All of it behind `prefers-reduced-motion` |

**Anti-goals, explicitly:** no purple-to-blue gradient hero, no glassmorphism,
no pulsing "AI" glow, no animated particle background, no full-width carousel.
Every one of those reads as demo. Restraint is the differentiator.

Primitives in `src/components/ui/`: Button, Input, Select, Textarea, Card,
Badge, Chip, Table, Modal, Drawer, Tabs, Tooltip, Skeleton, EmptyState,
ErrorState, Pagination, Avatar, Toast, StatCard, SpecTable, MatchScore.

### 6.1 Every state is designed

No-results, unparseable query, AI unavailable, network error, server error,
empty shortlist, empty comparison, empty dashboard, out-of-stock, missing image,
rate-limited. Each gets a purpose-built component with an icon, a plain-language
explanation, and **a next action** — an empty state without a next action is a
dead end.

---

## 7. Security

| Concern | Control |
|---|---|
| AuthN | bcrypt/Argon2id password hashing, HttpOnly + Secure + SameSite=Lax session cookie, server-side session records with revocation, rotation on privilege change |
| AuthZ | Role enum `customer / staff / admin`; enforced in the **service layer**, not middleware alone — middleware guards routes, services guard data |
| Input | Zod at every boundary; parse, do not validate |
| Injection | Parameterised queries only via Prisma; no string-built SQL |
| XSS | No `dangerouslySetInnerHTML` on user or LLM output; LLM prose is rendered as text |
| CSRF | SameSite cookies + origin check on mutating handlers |
| Uploads | Magic-byte sniffing (declared type and filename are ignored entirely), size and dimension caps, decode-and-re-encode to WebP which strips EXIF and any embedded payload, SVG refused outright. Stored content-addressed outside `public/` and served by a handler that states the content type. See §7.2 |
| Secrets | Server-only env; `NEXT_PUBLIC_` reserved for genuinely public values. **No AI call is ever made from the browser.** |
| Rate limit | Token bucket, not a fixed window — a fixed window admits double the quota across its edge. Counted in Redis by an atomic Lua script when `REDIS_URL` is set, in-process otherwise; an unreachable Redis degrades to the in-process bucket rather than failing open. AI and upload endpoints are budgeted separately |
| Prompt injection | Product text is delivered to the LLM as data in a delimited block with an explicit instruction that catalogue content is never an instruction; the LLM output is constrained to a JSON schema and can never trigger a mutation |
| Headers | Per-request CSP nonce on every route that cannot be prerendered; `unsafe-eval` is development-only. HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`. See §7.3 |
| Audit | Append-only trail of every privileged action — product edits, quotation pricing, sign-ins, session revocations, exports, uploads. Client addresses stored as salted hashes. No edit or delete path exists anywhere in the application |

### 7.1 One rule stated explicitly

**The LLM has no write authority.** It parses language into a schema and
rephrases a computed result. It cannot filter, price, rank, or mutate. Every
number shown to a user is produced by code we can unit-test.

### 7.2 Why uploads are re-encoded rather than validated

Checking an upload is not the same as making it safe. The filename, the
extension and the `Content-Type` header are attacker-chosen strings, so the
first check whose input the server produced is the magic-byte sniff — and even
that only proves the file *starts* like an image.

Decoding the pixels and writing a fresh file from them is the control. A
polyglot — valid JPEG header, script in a comment segment — loses everything
that was not pixel data, and EXIF goes with it, which routinely carries GPS
coordinates a supplier did not intend to publish.

SVG is refused outright and must stay refused. It is an XML document that can
carry `<script>`, external entities and foreign HTML; served from our own
origin it is a stored-XSS primitive, and unlike a raster format there is no
re-encode that makes it safe.

### 7.3 The CSP nonce, and where it does not apply

A nonce and static prerendering are mutually exclusive. The nonce differs per
request; a prerendered page is one cached HTML file whose script tags were
stamped at build time. Sending a nonce policy to a prerendered page blocks
every script on it.

So the nonce is applied to the routes that *cannot* be prerendered by
construction — `/account`, `/admin`, `/assistant`, `/compare` and the auth
pages, each of which reads a session or a query string. That list is structural
rather than a snapshot of what happens to be dynamic today, so it does not rot.

The 84 prerendered pages — homepage, catalogue, every category, product and
written page — keep `'unsafe-inline'` on `script-src`, which Next's inline
flight-data scripts require. Those pages hold no credentials, run no privileged action and render
no user-submitted content. Making them dynamic to close that gap would cost
every one of them its static generation, which is a worse trade.

The application's own inline script — the pre-paint theme bootstrap — was moved
to an external file so it needs neither a nonce nor `unsafe-inline`. That is
also why `'strict-dynamic'` is deliberately *not* used: it would nullify
`'self'`, and `'self'` is what covers that file.

`scripts/smoke-http.ts` asserts that every script tag on a nonced page carries
the nonce from its own response header, so a route drifting between the two
policies fails a check rather than silently breaking in a browser.

### 7.4 Corpus statistics, and why a match score cannot be pool-relative

A match percentage is a claim about one product against one requirement, so it
must mean the same thing wherever it is shown. Three scoring inputs break that
rule if left to themselves: BM25's IDF and length normalisation, and the demand
component's peak view and RFQ counts. All three are relative to whatever set of
documents happens to be indexed.

The memory driver never noticed, because its index *is* the whole catalogue.
The Postgres driver constrains in SQL and ranks the survivors, so its index is a
different corpus on every query — and the same product came out at 95% under
one driver and 94% under the other. A cached catalogue-wide snapshot is
injected into both, which is the same idea as Elasticsearch's
`dfs_query_then_fetch`: gather global term statistics first, score locally
against them.

---

## 8. Performance

- RSC by default; `"use client"` only where interaction demands it.
- `next/image` with AVIF/WebP, explicit dimensions, blur placeholders, priority
  on the hero only.
- Catalogue: cursor pagination, `Suspense` streaming, skeletons matched to final
  layout so there is zero cumulative layout shift.
- Search: in-memory inverted index for the memory driver; GIN + `ivfflat` for
  Postgres. Facet counts from rollups.
- Caching: static marketing pages, ISR on category/product pages, request-level
  memoisation via `React.cache`, LRU on intent-parse results (identical query →
  no LLM call).
- Background work: embedding generation, RFQ email, analytics rollups.
- Budget: **LCP < 2.0s, INP < 200ms, CLS < 0.05** on mid-tier mobile.

---

## 9. Build phases

| Phase | Scope | Status |
|---|---|---|
| **0** | Architecture, design tokens, primitives, domain types, seed catalogue | done |
| **1** | Home, navigation, product listing, product detail | done |
| **2** | Auth, sessions, roles, customer dashboard | done |
| **3** | AI assistant workspace, NL search, recommendation engine | done |
| **4** | Comparison, RFQ workflow, notifications | done |
| **5** | Admin dashboard, product management, search analytics | done |
| **6** | Postgres driver, tests, distributed rate limiting, audit trail, CSP nonce, mail, uploads, exports | done |

---

## 10. Decisions worth challenging later

Recorded honestly, because a decision without its trade-off is not a decision.

1. **Memory driver as default.** Buys zero-friction demo; costs a second
   repository implementation. The cost is real and was paid during phase 6: the
   two drivers disagreed about a match percentage (§7.4) and about facet counts,
   and a `take: NaN` that the memory driver silently swallowed took the
   catalogue page down under Postgres. `tests/integration/postgres.test.ts`
   now asserts parity rather than trusting it. Revisit once Postgres is the
   only target.
2. **EAV specs.** Buys arbitrary per-category attributes and range filtering;
   costs join complexity. A JSONB column with GIN would be simpler but loses
   clean numeric range queries and unit normalisation.
3. **Computed match score.** Buys stability and auditability; costs the fluency
   an LLM-authored ranking might show on genuinely novel queries.
4. **RFQ-only.** Correct for industrial supply where price is quantity-negotiated.
   If the catalogue ever carries fixed-price consumables, a checkout path is a
   real addition — the schema does not preclude it.
