/**
 * Admin and comparison smoke test.
 *
 * Run: npm run smoke:admin
 *
 * Covers the write paths, which are the risky part of Phase 5: a product edit
 * has to rebuild the search index, an archive has to leave the catalogue but
 * stay recoverable, and a quoted total has to be derived from its own line
 * items rather than trusted from the form.
 */

process.env.SOURCELY_DATA_DIR ??= '.data-test'

import { rm } from 'node:fs/promises'
import type { Product } from '../src/lib/domain/catalog'
import {
  getAdminRepository,
  getCatalogRepository,
} from '../src/server/repositories'
import { flush } from '../src/server/repositories/memory/store'
import { buildComparisonRows } from '../src/server/catalog/comparison'
import { parseIntentOffline } from '../src/server/ai/intent-offline'
import { buildOverview } from '../src/server/admin/analytics'

let failures = 0
let checks = 0

function check(label: string, condition: boolean, detail = ''): void {
  checks++
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
  if (!condition) failures++
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(74)}\n${title}\n${'─'.repeat(74)}`)
}

async function main() {
  await rm('.data-test', { recursive: true, force: true }).catch(() => {})

  const catalog = getCatalogRepository()
  const admin = getAdminRepository()

  /* ------------------------------------------------------------ comparison */
  section('COMPARISON GRID')

  const products = await catalog.findManyByIds([
    'prod_vtk-bv2s-050',
    'prod_dor-bv-050t',
    'prod_vtk-bv3s-050',
  ])

  check('three products resolve', products.length === 3, `${products.length} found`)

  const rows = buildComparisonRows(products)
  check('rows are produced', rows.length > 10, `${rows.length} rows`)

  const priceRow = rows.find((row) => row.key === 'price')
  check('price row exists with all three values', priceRow?.values.length === 3)
  check(
    'cheapest product is marked as best on price',
    priceRow?.bestIndex ===
      products.indexOf(products.reduce((min, p) => (p.price < min.price ? p : min))),
    `bestIndex=${priceRow?.bestIndex}`
  )

  const identical = rows.filter((row) => row.identical)
  const differing = rows.filter((row) => !row.identical)
  check('some rows are identical and some differ', identical.length > 0 && differing.length > 0, `${identical.length} same, ${differing.length} differ`)

  const seatRow = rows.find((row) => row.key === 'seat_material')
  check(
    'a genuinely differing spec is flagged as differing',
    seatRow != null && !seatRow.identical,
    seatRow?.values.join(' | ') ?? 'no seat_material row'
  )

  // A numeric spec must not be given a winner — bigger is not better.
  const pressureRow = rows.find((row) => row.key === 'pressure_rating_bar')
  check(
    'numeric specs are not given a "best" marker',
    pressureRow == null || pressureRow.bestIndex === null
  )

  // Ties must not crown a winner.
  const twoSame = await catalog.findManyByIds(['prod_nrv-glv-c5-l', 'prod_nrv-glv-c5-xl'])
  if (twoSame.length === 2) {
    const tieRows = buildComparisonRows(twoSame)
    const tiePrice = tieRows.find((row) => row.key === 'price')
    check(
      'an equal-price pair has no winner marked',
      tiePrice?.bestIndex === null,
      `values ${tiePrice?.values.join(' vs ')}`
    )
  }

  /* --------------------------------------------------------- product write */
  section('PRODUCT WRITES')

  const before = await catalog.stats()
  const beforeSearch = await catalog.search({ categoryKeys: ['valves'], limit: 96 })

  const draft: Product = {
    id: 'prod_test-bv-999',
    slug: 'test-ball-valve-test-bv-999',
    sku: 'TEST-BV-999',
    name: 'Test Ball Valve, SS316, DN80 Threaded',
    shortDescription: 'A test valve written by the admin smoke test.',
    description: 'Created by scripts/smoke-admin.ts to verify the write path.',
    categoryId: 'cat_valves',
    subcategoryId: 'cat_ball-valves',
    brandId: 'brand_vantek',
    sellerId: 'seller_metro-industrial',
    price: 9999,
    listPrice: null,
    currency: 'INR',
    priceUnit: 'per unit',
    taxRatePercent: 18,
    status: 'active',
    availability: {
      state: 'in_stock',
      quantityOnHand: 25,
      leadTimeDays: 1,
      minOrderQuantity: 1,
      unit: 'unit',
    },
    images: [],
    specs: [
      { key: 'material', valueText: 'stainless_steel', displayValue: 'Stainless Steel' },
      { key: 'connection_type', valueText: 'threaded', displayValue: 'Threaded' },
      { key: 'valve_type', valueText: 'ball', displayValue: 'Ball Valve' },
      { key: 'size_dn', valueNumber: 80, unit: 'DN', displayValue: 'DN80' },
    ],
    applications: ['hvac'],
    industries: [],
    tags: ['test', 'ball valve'],
    documents: [],
    warrantyMonths: 24,
    certifications: [],
    relatedProductIds: [],
    rating: null,
    metrics: { views: 0, rfqs: 0, saves: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await catalog.upsertProduct(draft)

  const afterCreate = await catalog.stats()
  check(
    'creating a product increases the catalogue count',
    afterCreate.products === before.products + 1,
    `${before.products} → ${afterCreate.products}`
  )

  const found = await catalog.findById(draft.id)
  check('the new product is readable', found?.name === draft.name)
  check('taxonomy joined correctly', found?.brand.key === 'vantek' && found.category.key === 'valves')

  // The search index must have been rebuilt, not served stale.
  const afterSearch = await catalog.search({ categoryKeys: ['valves'], limit: 96 })
  check(
    'the search index rebuilt after the write',
    afterSearch.total === beforeSearch.total + 1,
    `${beforeSearch.total} → ${afterSearch.total}`
  )

  const bySlug = await catalog.findBySlug(draft.slug)
  check('slug lookup resolves the new product', bySlug?.id === draft.id)

  // It must also be reachable by the ranking engine.
  const ranked = await catalog.rankByIntent(
    parseIntentOffline('stainless steel threaded ball valve DN80'),
    24
  )
  check(
    'the new product is reachable through intent ranking',
    ranked.results.some((result) => result.product.id === draft.id),
    `${ranked.total} results`
  )

  /* --- Edit -------------------------------------------------------------- */

  await catalog.upsertProduct({ ...draft, price: 4444, updatedAt: new Date().toISOString() })
  const edited = await catalog.findById(draft.id)
  check('an edit is reflected immediately', edited?.price === 4444, `₹${edited?.price}`)

  const statsAfterEdit = await catalog.stats()
  check(
    'editing does not duplicate the product',
    statsAfterEdit.products === afterCreate.products,
    `${statsAfterEdit.products}`
  )

  /* --- Archive ------------------------------------------------------------ */

  await catalog.setProductStatus(draft.id, 'archived')

  check('archived product leaves the public catalogue', (await catalog.findById(draft.id)) === null)
  check(
    'archived product is still recoverable for the editor',
    (await catalog.findAnyById(draft.id))?.status === 'archived'
  )
  check(
    'archived product is excluded from search',
    !(await catalog.search({ categoryKeys: ['valves'], limit: 96 })).items.some(
      (item) => item.id === draft.id
    )
  )
  check(
    'listAll still includes archived records for the admin table',
    (await catalog.listAll()).some((product) => product.id === draft.id)
  )

  await catalog.setProductStatus(draft.id, 'active')
  check('restoring brings it back', (await catalog.findById(draft.id))?.id === draft.id)

  /* --------------------------------------------------------------- category */
  section('DENORMALISED COUNTS')

  const categories = await catalog.categories()
  const valves = categories.find((category) => category.key === 'valves')
  const actualValves = (await catalog.listAll()).filter(
    (product) => product.categoryId === 'cat_valves' && product.status !== 'archived'
  ).length

  check(
    'category product count matches the real catalogue after a write',
    valves?.productCount === actualValves,
    `stored ${valves?.productCount} vs actual ${actualValves}`
  )

  /* -------------------------------------------------------------------- RFQ */
  section('QUOTATION WRITES')

  const rfqs = await admin.listAllRfqs(50)
  check('seeded quotations are visible to admin', rfqs.length >= 2, `${rfqs.length} found`)

  const target = rfqs.find((rfq) => rfq.reference.endsWith('0163')) ?? rfqs[1]
  if (!target) throw new Error('no RFQ to test against')

  const firstItem = target.items[0]
  if (!firstItem) throw new Error('RFQ has no items')

  const updated = await admin.updateRfq(target.id, {
    status: 'quoted',
    quotes: { [firstItem.productId]: { unitPrice: 1000, leadTimeDays: 5 } },
    validUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  })

  check('status updates', updated?.status === 'quoted')
  check(
    'quoted total is DERIVED from line items, not trusted',
    updated?.quotedTotal === 1000 * firstItem.quantity,
    `${updated?.quotedTotal} for ${firstItem.quantity} × ₹1000`
  )
  check('line unit price is stored', updated?.items[0]?.quotedUnitPrice === 1000)
  check('lead time is stored', updated?.items[0]?.quotedLeadTimeDays === 5)
  check('validity date is stored', updated?.validUntil != null)

  const withMessage = await admin.addRfqMessage(
    target.id,
    { id: 'user_demo_admin', role: 'admin' },
    'Test reply from the smoke suite.'
  )
  check('a message appends to the thread', (withMessage?.messages.length ?? 0) > 0)
  check(
    'the message records its author role',
    withMessage?.messages[withMessage.messages.length - 1]?.authorRole === 'admin'
  )
  check(
    'updatedAt moves when the thread changes',
    (withMessage?.updatedAt ?? '') >= (updated?.updatedAt ?? '')
  )

  /* ------------------------------------------------------------- privileges */
  section('PRIVILEGE BOUNDARY')

  const users = await admin.listUsers(50)
  check('admin can list every user', users.length >= 2, `${users.length} users`)
  check(
    'password hashes never leave the repository',
    users.every((user) => !('passwordHash' in user)),
    'checked every returned record'
  )

  const anyRfq = await admin.findAnyRfq(target.id)
  check('admin can read any quotation regardless of owner', anyRfq?.id === target.id)

  /* -------------------------------------------------------------- analytics */
  section('ANALYTICS')

  const overview = await buildOverview()
  check('overview builds', overview.catalogue.total > 0, `${overview.catalogue.total} products`)
  check(
    'zero-result rate is a fraction, not a percentage',
    overview.search.zeroResultRate >= 0 && overview.search.zeroResultRate <= 1,
    String(overview.search.zeroResultRate)
  )
  check('daily series covers 14 days', overview.daily.length === 14)
  check(
    'active count never exceeds total',
    overview.catalogue.active <= overview.catalogue.total
  )
  check(
    'quoted value matches the quotations',
    overview.rfq.quotedValue >= (updated?.quotedTotal ?? 0),
    `₹${overview.rfq.quotedValue}`
  )
  check(
    'people counts are internally consistent',
    overview.people.activeThisWeek <= overview.people.users &&
      overview.people.newThisWeek <= overview.people.users
  )

  await flush()
  await rm('.data-test', { recursive: true, force: true }).catch(() => {})

  console.log(`\n${'='.repeat(74)}`)
  console.log(failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} CHECK(S) FAILED`)
  console.log('='.repeat(74))

  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nSMOKE RUN CRASHED\n', error)
  process.exit(1)
})
