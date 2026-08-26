import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Product } from '@/lib/domain/catalog'
import { parseIntentOffline } from '@/server/ai/intent-offline'
import { MemoryCatalogRepository } from '@/server/repositories/memory/catalog-repository'
import { PrismaCatalogRepository } from '@/server/repositories/prisma/catalog-repository'
import { PrismaAccountRepository } from '@/server/repositories/prisma/account-repository'
import { PrismaActivityRepository } from '@/server/repositories/prisma/activity-repository'
import { PrismaAdminRepository } from '@/server/repositories/prisma/admin-repository'
import { PrismaAuditRepository } from '@/server/repositories/prisma/audit-repository'
import { hashPassword, verifyPassword } from '@/server/auth/password'

/**
 * PostgreSQL driver verification.
 *
 * Two things are being checked here, and the second matters more than the
 * first: that the Prisma driver works, and that it behaves *identically* to
 * the memory driver. Two implementations of one interface that quietly
 * disagree are worse than one implementation, because every bug becomes
 * environment-specific.
 *
 * Skipped entirely when no database is reachable, so `npm test` still passes
 * on a machine with no Docker. Run the database first:
 *
 *   docker compose up -d && npm run db:migrate && npm run db:seed
 */

// `DATABASE_URL` is set in tests/setup.ts, not here — a test file's top-level
// statements run after its imports, so a PrismaClient would already have been
// constructed without one. See the note in that file.

/**
 * The probe runs at module scope, not in `beforeAll`.
 *
 * `describe` bodies execute during collection, which happens before any hook
 * fires — so a flag set in `beforeAll` is still false when `it` vs `it.skip`
 * is decided, and every test silently skips. Top-level await resolves first.
 */
const reachable = await (async () => {
  try {
    const { prisma } = await import('@/server/db/prisma')
    await prisma.$queryRaw`SELECT 1`
    const count = await prisma.product.count()
    if (count === 0) {
      console.warn('[postgres] database reachable but empty — run `npm run db:seed`')
      return false
    }
    return true
  } catch {
    console.warn('[postgres] no database reachable — skipping driver parity tests')
    return false
  }
})()

afterAll(async () => {
  if (!reachable) return
  const { prisma } = await import('@/server/db/prisma')
  await prisma.$disconnect()
})

const when = () => (reachable ? it : it.skip)

describe('PostgreSQL catalogue driver', () => {
  const pg = new PrismaCatalogRepository()
  const memory = new MemoryCatalogRepository()

  when()('reads a product by slug with its taxonomy joined', async () => {
    const product = await pg.findBySlug(
      'vantek-2-piece-ball-valve-ss316-dn50-threaded-vtk-bv2s-050'
    )
    expect(product).not.toBeNull()
    expect(product?.brand.name).toBe('Vantek Valves')
    expect(product?.category.key).toBe('valves')
    expect(product?.specs.length).toBeGreaterThan(3)
  })

  when()('returns ISO date strings, not Date objects', async () => {
    // A `Date` cannot cross the RSC boundary. If this regressed, every page
    // would work under the memory driver and break under Postgres.
    const product = await pg.findById('prod_vtk-bv2s-050')
    expect(typeof product?.createdAt).toBe('string')
    expect(product?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  when()('preserves caller order in findManyByIds', async () => {
    const ids = ['prod_dor-bv-050t', 'prod_vtk-bv2s-050', 'prod_afx-fcu-600']
    const products = await pg.findManyByIds(ids)
    expect(products.map((product) => product.id)).toEqual(ids)
  })

  when()('agrees with the memory driver on catalogue size', async () => {
    const [a, b] = await Promise.all([pg.stats(), memory.stats()])
    expect(a.products).toBe(b.products)
    expect(a.categories).toBe(b.categories)
    expect(a.brands).toBe(b.brands)
    expect(a.inStock).toBe(b.inStock)
  })

  when()('agrees with the memory driver on a filtered search count', async () => {
    const query = { categoryKeys: ['valves'], limit: 96 }
    const [a, b] = await Promise.all([pg.search(query), memory.search(query)])
    expect(a.total).toBe(b.total)
  })

  when()('agrees with the memory driver on a spec-filtered count', async () => {
    const query = {
      categoryKeys: ['valves'],
      specs: [{ key: 'material', values: ['stainless_steel'] }],
      limit: 96,
    }
    const [a, b] = await Promise.all([pg.search(query), memory.search(query)])
    expect(a.total).toBe(b.total)
  })

  when()('AND-s multiple spec constraints rather than OR-ing them', async () => {
    // One `some` per constraint. A single `some` with both conditions would
    // match a product whose *different* spec rows each satisfied one.
    const both = await pg.search({
      categoryKeys: ['valves'],
      specs: [
        { key: 'material', values: ['stainless_steel'] },
        { key: 'connection_type', values: ['threaded'] },
      ],
      limit: 96,
    })

    for (const product of both.items) {
      expect(product.specs.find((s) => s.key === 'material')?.valueText).toBe('stainless_steel')
      expect(product.specs.find((s) => s.key === 'connection_type')?.valueText).toBe('threaded')
    }
  })

  when()('produces facets whose counts exclude their own filter', async () => {
    const page = await pg.search({
      categoryKeys: ['valves'],
      specs: [{ key: 'material', values: ['stainless_steel'] }],
      limit: 24,
    })

    const material = page.facets.find((facet) => facet.key === 'material')
    const nonZero = material?.buckets?.filter((bucket) => bucket.count > 0) ?? []
    // Siblings must survive so a second material can be added.
    expect(nonZero.length).toBeGreaterThan(1)
  })

  when()('ranks the canonical query identically to the memory driver', async () => {
    const intent = parseIntentOffline(
      'I need a stainless steel threaded valve for an HVAC system, between ₹3,000 and ₹5,000'
    )

    const [a, b] = await Promise.all([pg.rankByIntent(intent, 8), memory.rankByIntent(intent, 8)])

    expect(a.results[0]?.product.id).toBe(b.results[0]?.product.id)
    expect(a.results[0]?.explanation.matchPercent).toBe(b.results[0]?.explanation.matchPercent)
    expect(a.total).toBe(b.total)
  })

  when()('excludes a negated material from ranked results', async () => {
    const intent = parseIntentOffline('DN50 ball valve, not brass')
    const { results } = await pg.rankByIntent(intent, 12)

    expect(results.length).toBeGreaterThan(0)
    expect(
      results.some((r) => r.product.specs.some((s) => s.key === 'material' && s.valueText === 'brass'))
    ).toBe(false)
  })

  when()('falls back to a default page size for a non-finite limit', async () => {
    /**
     * NaN is not nullish, so `query.limit ?? 24` lets it through — and Prisma
     * rejects `take: NaN` with an error that names neither the caller nor the
     * cause. This happened for real: `PAGE_SIZE` was imported from a
     * `'use client'` module into a Server Component, arrived as a client
     * reference, and `Math.max` of it was NaN. The memory driver silently
     * returned nothing; PostgreSQL 500'd the catalogue page.
     */
    for (const limit of [Number.NaN, undefined, 0, -5] as (number | undefined)[]) {
      const [a, b] = await Promise.all([
        pg.search({ limit: limit as number }),
        memory.search({ limit: limit as number }),
      ])

      expect(a.items.length).toBeGreaterThan(0)
      expect(a.items.length).toBe(b.items.length)
    }
  })

  when()('paginates by cursor without repeating an item', async () => {
    const first = await pg.search({ sort: 'price_asc', limit: 10 })
    expect(first.nextCursor).toBeTruthy()

    const second = await pg.search({
      sort: 'price_asc',
      limit: 10,
      cursor: first.nextCursor ?? undefined,
    })

    const firstIds = new Set(first.items.map((item) => item.id))
    expect(second.items.every((item) => !firstIds.has(item.id))).toBe(true)
  })

  when()('matches multi-word keyword searches term by term', async () => {
    /**
     * The regression this pins down: the text filter matched the WHOLE query
     * string as one substring, so "ball valve ss316" returned nothing even
     * though "ball valve" lives in product names and "SS316" in their specs.
     * Each term must be free to match a different field.
     */
    const queries = [
      'ball valve ss316',
      'ball valve',
      'ss316',
      'control valve',
      'HVAC',
      'electrical',
      'plumbing',
    ]

    for (const text of queries) {
      const [a, b] = await Promise.all([
        pg.search({ text, limit: 96 }),
        memory.search({ text, limit: 96 }),
      ])
      expect(a.total, `postgres found nothing for "${text}"`).toBeGreaterThan(0)
      expect(b.total, `memory found nothing for "${text}"`).toBeGreaterThan(0)
    }
  })

  when()('ranks an SS316 ball valve first for "ball valve ss316"', async () => {
    const page = await pg.search({ text: 'ball valve ss316', limit: 24 })
    const top = page.items[0]
    expect(top).toBeDefined()
    expect(top?.name.toLowerCase()).toContain('ball valve')
    expect(
      top?.name.toLowerCase().includes('ss316') ||
        top?.specs.some((s) => s.displayValue.toLowerCase().includes('ss316'))
    ).toBe(true)
  })
})

describe('PostgreSQL writes', () => {
  const pg = new PrismaCatalogRepository()
  const testId = 'prod_pg-test-999'

  const draft: Product = {
    id: testId,
    slug: 'postgres-test-valve-pg-test-999',
    sku: 'PGTEST-999',
    name: 'Postgres Test Ball Valve, SS316, DN80',
    shortDescription: 'Written by the integration suite.',
    description: 'Created by tests/integration/postgres.test.ts to verify the write path.',
    categoryId: 'cat_valves',
    subcategoryId: 'cat_ball-valves',
    brandId: 'brand_vantek',
    sellerId: 'seller_metro-industrial',
    price: 7777,
    listPrice: null,
    currency: 'INR',
    priceUnit: 'per unit',
    taxRatePercent: 18,
    status: 'active',
    availability: {
      state: 'in_stock',
      quantityOnHand: 12,
      leadTimeDays: 2,
      minOrderQuantity: 1,
      unit: 'unit',
    },
    images: [
      { url: 'artwork:ball-valve:front:0', alt: 'front', width: 1200, height: 900, blurDataUrl: null },
    ],
    specs: [
      { key: 'material', valueText: 'stainless_steel', displayValue: 'Stainless Steel' },
      { key: 'connection_type', valueText: 'threaded', displayValue: 'Threaded' },
      { key: 'size_dn', valueNumber: 80, unit: 'DN', displayValue: 'DN80' },
    ],
    applications: ['hvac'],
    industries: [],
    tags: ['pg-test'],
    documents: [],
    warrantyMonths: 24,
    certifications: ['IS 554'],
    relatedProductIds: ['prod_vtk-bv2s-050'],
    rating: null,
    metrics: { views: 0, rfqs: 0, saves: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  afterAll(async () => {
    if (!reachable) return
    const { prisma } = await import('@/server/db/prisma')
    await prisma.product.deleteMany({ where: { id: testId } })
  })

  when()('creates a product with its child rows', async () => {
    await pg.upsertProduct(draft)

    const saved = await pg.findById(testId)
    expect(saved?.name).toBe(draft.name)
    expect(saved?.specs).toHaveLength(3)
    expect(saved?.images).toHaveLength(1)
    expect(saved?.relatedProductIds).toContain('prod_vtk-bv2s-050')
  })

  when()('makes the new product reachable through ranking', async () => {
    const { results } = await pg.rankByIntent(
      parseIntentOffline('stainless steel threaded ball valve DN80'),
      24
    )
    expect(results.some((result) => result.product.id === testId)).toBe(true)
  })

  when()('rewrites child rows on edit rather than duplicating them', async () => {
    await pg.upsertProduct({ ...draft, price: 5555 })

    const saved = await pg.findById(testId)
    expect(saved?.price).toBe(5555)
    expect(saved?.specs).toHaveLength(3)
    expect(saved?.images).toHaveLength(1)
  })

  when()('archives without deleting, and keeps the record recoverable', async () => {
    await pg.setProductStatus(testId, 'archived')

    expect(await pg.findById(testId)).toBeNull()
    expect((await pg.findAnyById(testId))?.status).toBe('archived')
    expect((await pg.listAll()).some((product) => product.id === testId)).toBe(true)

    await pg.setProductStatus(testId, 'active')
    expect(await pg.findById(testId)).not.toBeNull()
  })

  when()('keeps denormalised category counts truthful after a write', async () => {
    const { prisma } = await import('@/server/db/prisma')

    const stored = await prisma.category.findUnique({ where: { id: 'cat_valves' } })
    const actual = await prisma.product.count({
      where: {
        status: { not: 'archived' },
        OR: [{ categoryId: 'cat_valves' }, { subcategoryId: 'cat_valves' }],
      },
    })

    expect(stored?.productCount).toBe(actual)
  })
})

describe('PostgreSQL identity', () => {
  const accounts = new PrismaAccountRepository()
  const email = `pgtest-${Date.now()}@example.in`
  let userId = ''

  afterAll(async () => {
    if (!reachable || !userId) return
    const { prisma } = await import('@/server/db/prisma')
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  when()('creates a user with a normalised email', async () => {
    const user = await accounts.createUser({
      email: `  ${email.toUpperCase()} `,
      name: '  Test Buyer  ',
      passwordHash: await hashPassword('Sourcely2026'),
      gstin: '29aabcs1234a1z5',
    })

    userId = user.id
    expect(user.email).toBe(email.toLowerCase())
    expect(user.name).toBe('Test Buyer')
    expect(user.gstin).toBe('29AABCS1234A1Z5')
    expect(user.emailVerified).toBe(false)
  })

  when()('finds the demo user and verifies its seeded password', async () => {
    const user = await accounts.findUserByEmail('BUYER@DECCANPROJECTS.IN')
    expect(user).not.toBeNull()
    expect(await verifyPassword('Sourcely2026', user!.passwordHash)).toBe(true)
  })

  when()('creates, finds and revokes a session', async () => {
    const session = await accounts.createSession(userId, 'vitest/1.0')
    expect(await accounts.findActiveSession(session.id)).not.toBeNull()

    await accounts.revokeSession(session.id)
    expect(await accounts.findActiveSession(session.id)).toBeNull()
  })

  when()('spares the excepted session on revoke-all', async () => {
    const keep = await accounts.createSession(userId, 'keep')
    await accounts.createSession(userId, 'drop')

    await accounts.revokeAllSessions(userId, keep.id)

    expect(await accounts.findActiveSession(keep.id)).not.toBeNull()
    expect(await accounts.listSessions(userId)).toHaveLength(1)
  })

  when()('makes a reset token single-use', async () => {
    const token = await accounts.createResetToken(userId)
    expect(await accounts.consumeResetToken(token)).toBe(userId)
    expect(await accounts.consumeResetToken(token)).toBeNull()
  })

  when()('invalidates a previous reset token when a new one is issued', async () => {
    const first = await accounts.createResetToken(userId)
    const second = await accounts.createResetToken(userId)

    expect(await accounts.consumeResetToken(first)).toBeNull()
    expect(await accounts.consumeResetToken(second)).toBe(userId)
  })
})

describe('PostgreSQL activity scoping', () => {
  const activity = new PrismaActivityRepository()
  const accounts = new PrismaAccountRepository()

  let mine = ''
  let theirs = ''

  beforeAll(async () => {
    if (!reachable) return
    const hash = await hashPassword('Sourcely2026')
    mine = (
      await accounts.createUser({ email: `mine-${Date.now()}@x.in`, name: 'Mine', passwordHash: hash })
    ).id
    theirs = (
      await accounts.createUser({ email: `theirs-${Date.now()}@x.in`, name: 'Theirs', passwordHash: hash })
    ).id
  })

  afterAll(async () => {
    if (!reachable) return
    const { prisma } = await import('@/server/db/prisma')
    await prisma.user.deleteMany({ where: { id: { in: [mine, theirs].filter(Boolean) } } })
  })

  when()('scopes the shortlist to its owner', async () => {
    await activity.saveProduct(mine, 'prod_vtk-bv2s-050', 'mine')
    await activity.saveProduct(theirs, 'prod_dor-drv-050', 'theirs')

    const list = await activity.listSavedProducts(mine)
    expect(list).toHaveLength(1)
    expect(list[0]?.productId).toBe('prod_vtk-bv2s-050')
  })

  when()('does not duplicate a product saved twice', async () => {
    await activity.saveProduct(mine, 'prod_vtk-bv2s-050', 'updated note')
    expect(await activity.listSavedProducts(mine)).toHaveLength(1)
  })

  when()('de-duplicates recently viewed', async () => {
    await activity.recordView(mine, 'v1', 'prod_tru-pg-100')
    await activity.recordView(mine, 'v1', 'prod_afx-fcu-600')
    await activity.recordView(mine, 'v1', 'prod_tru-pg-100')

    const recent = await activity.recentlyViewed(mine, 10)
    expect(recent).toHaveLength(2)
    expect(recent[0]).toBe('prod_tru-pg-100')

    // And back again. A re-view must return to the front even when every
    // write lands within one millisecond — the old upsert kept the original
    // row id and mixed two clocks for `viewedAt`, so this exact sequence
    // failed intermittently on timestamp ties.
    await activity.recordView(mine, 'v1', 'prod_afx-fcu-600')
    const flipped = await activity.recentlyViewed(mine, 10)
    expect(flipped).toEqual(['prod_afx-fcu-600', 'prod_tru-pg-100'])
  })

  when()('refuses to delete another user’s saved search', async () => {
    const saved = await activity.saveSearch({
      userId: mine,
      title: 'Test',
      query: 'test',
      intent: null,
      alertsEnabled: false,
      lastResultCount: 0,
    })

    await activity.deleteSavedSearch(theirs, saved.id)
    expect(await activity.listSavedSearches(mine)).toHaveLength(1)

    await activity.deleteSavedSearch(mine, saved.id)
    expect(await activity.listSavedSearches(mine)).toHaveLength(0)
  })

  when()('creates an RFQ with a readable reference and scopes reads', async () => {
    const rfq = await activity.createRfq({
      userId: mine,
      status: 'submitted',
      contact: {
        name: 'Mine',
        company: 'Mine Ltd',
        email: 'mine@x.in',
        phone: '',
        city: 'Pune',
        gstin: null,
      },
      items: [
        {
          productId: 'prod_vtk-bv2s-050',
          quantity: 10,
          note: null,
          quotedUnitPrice: null,
          quotedLeadTimeDays: null,
        },
      ],
      requirements: 'Integration test requirement.',
      deliveryPincode: '411001',
      requiredByDate: null,
      sourceConversationId: null,
      quotedTotal: null,
      validUntil: null,
    })

    expect(rfq.reference).toMatch(/^RFQ-\d{4}-\d{4}$/)
    expect(await activity.findRfq(mine, rfq.id)).not.toBeNull()
    expect(await activity.findRfq(theirs, rfq.id)).toBeNull()
  })

  when()('derives the quoted total from line items', async () => {
    const admin = new PrismaAdminRepository()
    const rfqs = await activity.listRfqs(mine)
    const target = rfqs[0]
    expect(target).toBeDefined()

    const updated = await admin.updateRfq(target!.id, {
      status: 'quoted',
      quotes: { 'prod_vtk-bv2s-050': { unitPrice: 3000, leadTimeDays: 4 } },
    })

    // 10 units at ₹3,000. A header total that disagrees with its own lines is
    // the fastest way to lose a buyer's trust in the whole quotation.
    expect(updated?.quotedTotal).toBe(30_000)
  })
})

describe('PostgreSQL audit trail', () => {
  const audit = new PrismaAuditRepository()

  when()('appends an entry and reads it back newest first', async () => {
    const before = await audit.count({ targetType: 'test' })

    await audit.record({
      actorId: null,
      actorEmail: 'vitest@example.in',
      actorRole: 'admin',
      action: 'product_update',
      targetType: 'test',
      targetId: `t-${Date.now()}`,
      summary: 'Integration test entry',
      changes: { price: { from: 100, to: 200 } },
      ipHash: null,
      userAgent: 'vitest',
    })

    expect(await audit.count({ targetType: 'test' })).toBe(before + 1)

    const entries = await audit.list({ targetType: 'test', limit: 1 })
    expect(entries[0]?.summary).toBe('Integration test entry')
    expect(entries[0]?.changes?.price).toEqual({ from: 100, to: 200 })
  })

  when()('filters by action', async () => {
    const entries = await audit.list({ action: 'product_update', limit: 5 })
    expect(entries.every((entry) => entry.action === 'product_update')).toBe(true)
  })
})

describe('PostgreSQL search infrastructure', () => {
  when()('created the generated tsvector column and its GIN index', async () => {
    const { prisma } = await import('@/server/db/prisma')

    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'searchVector'
    `
    expect(columns).toHaveLength(1)

    const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'products' AND indexname = 'products_search_vector_idx'
    `
    expect(indexes).toHaveLength(1)
  })

  when()('populated the embedding table with 256-dimension vectors', async () => {
    const { prisma } = await import('@/server/db/prisma')

    const rows = await prisma.$queryRaw<{ dims: number; count: bigint }[]>`
      SELECT vector_dims("vector") AS dims, COUNT(*) AS count
      FROM "product_embeddings"
      GROUP BY 1
    `

    expect(rows).toHaveLength(1)
    expect(rows[0]?.dims).toBe(256)
    expect(Number(rows[0]?.count)).toBeGreaterThan(50)
  })

  when()('answers a cosine similarity query through pgvector', async () => {
    const { prisma } = await import('@/server/db/prisma')

    // The nearest neighbour of a product's own embedding is itself.
    const rows = await prisma.$queryRaw<{ productId: string; distance: number }[]>`
      SELECT e2."productId", (e1."vector" <=> e2."vector") AS distance
      FROM "product_embeddings" e1, "product_embeddings" e2
      WHERE e1."productId" = 'prod_vtk-bv2s-050'
      ORDER BY distance ASC
      LIMIT 3
    `

    expect(rows[0]?.productId).toBe('prod_vtk-bv2s-050')
    expect(Number(rows[0]?.distance)).toBeLessThan(0.0001)
  })

  when()('ranks full-text search through the generated column', async () => {
    const { prisma } = await import('@/server/db/prisma')

    const rows = await prisma.$queryRaw<{ sku: string }[]>`
      SELECT "sku" FROM "products"
      WHERE "searchVector" @@ plainto_tsquery('english', 'mccb breaker')
      ORDER BY ts_rank_cd("searchVector", plainto_tsquery('english', 'mccb breaker')) DESC
      LIMIT 3
    `

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((row) => row.sku.includes('MCCB'))).toBe(true)
  })
})
