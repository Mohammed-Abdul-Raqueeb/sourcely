import 'server-only'
import type { Prisma } from '@prisma/client'
import type { Brand, Category, Product, ProductView, Seller } from '@/lib/domain/catalog'
import type { CatalogQuery, Page, RankedPage, RankedProduct, SearchIntent } from '@/lib/domain/search'
import { CatalogIndex, documentText } from '@/server/catalog/search-engine'
import { CorpusStatsCache, computeCorpusStats } from '@/server/catalog/corpus-stats'
import { prisma } from '@/server/db/prisma'
import type { CatalogRepository, CatalogStats } from '../types'
import {
  productInclude,
  specTypeToPrisma,
  toBrand,
  toCategory,
  toProduct,
  toProductView,
  toSeller,
} from './mappers'

/**
 * PostgreSQL catalogue driver.
 *
 * Retrieval happens in the database, ranking happens in the application, and
 * that split is deliberate. Postgres is very good at the constrain step —
 * indexed filters over category, status, price and typed spec values cut ten
 * thousand products to a few hundred. It is a poor place to express an
 * eight-component weighted scoring model that has to stay byte-identical to
 * the memory driver's.
 *
 * So the hard filters run as SQL, and the survivors go through the *same*
 * `CatalogIndex` the memory driver uses. One ranking implementation, no
 * possibility of the two drivers disagreeing about what a 94% match means.
 *
 * At the scale where building a transient index per query stops being free,
 * the next step is the `product_embeddings` table and its ivfflat index —
 * already in the schema, populated by `npm run db:seed`.
 */

/** Upper bound on candidates pulled into memory for ranking. */
const RANK_CANDIDATE_CAP = 600

/* -------------------------------------------------------------------------- */
/* Corpus statistics                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The scoring model needs catalogue-wide numbers — document frequencies, mean
 * document length, peak demand — and this driver only ever holds a slice of
 * the catalogue in memory at once. So the statistics are computed from a full
 * pass and cached, rather than derived from whatever the constrain step
 * returned. See `CorpusStats` for what goes wrong without this.
 *
 * The projection deliberately mirrors `documentText()` field for field: a
 * column added there and forgotten here would shift every IDF.
 */
const corpusStats = new CorpusStatsCache(async () => {
  const rows = await prisma.product.findMany({
    where: { status: 'active' },
    select: {
      name: true,
      sku: true,
      tags: true,
      shortDescription: true,
      description: true,
      certifications: true,
      applications: true,
      viewCount: true,
      rfqCount: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      specs: { select: { displayValue: true } },
    },
  })

  return computeCorpusStats(
    rows.map((row) => ({
      // `documentText` wants a ProductView; this projection carries exactly
      // the fields it reads, so the cast is narrowing rather than a lie.
      text: documentText({
        ...row,
        specs: row.specs.map((spec) => ({ key: '', displayValue: spec.displayValue })),
      } as unknown as ProductView),
      views: row.viewCount,
      rfqs: row.rfqCount,
    }))
  )
})

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Translates a `CatalogQuery` into a Prisma `where`.
 *
 * Spec constraints become `AND`-ed `some` clauses over the typed EAV table —
 * one `some` per constraint, because a single `some` with several conditions
 * would match a product whose *different* spec rows each satisfied one of them.
 */
function buildWhere(query: CatalogQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ status: 'active' }]

  if (query.categoryKeys?.length) {
    and.push({
      OR: [
        { category: { key: { in: query.categoryKeys } } },
        { subcategory: { key: { in: query.categoryKeys } } },
        { category: { parent: { key: { in: query.categoryKeys } } } },
      ],
    })
  }

  if (query.brandKeys?.length) and.push({ brand: { key: { in: query.brandKeys } } })
  if (query.sellerKeys?.length) and.push({ seller: { key: { in: query.sellerKeys } } })
  if (query.availability?.length) and.push({ availabilityState: { in: query.availability } })
  if (query.applications?.length) and.push({ applications: { hasSome: query.applications } })
  if (query.minRating != null) and.push({ ratingAverage: { gte: query.minRating } })

  if (query.price?.min != null || query.price?.max != null) {
    and.push({
      price: {
        ...(query.price.min != null && { gte: query.price.min }),
        ...(query.price.max != null && { lte: query.price.max }),
      },
    })
  }

  for (const constraint of query.specs ?? []) {
    if (constraint.values?.length) {
      and.push({ specs: { some: { key: constraint.key, valueText: { in: constraint.values } } } })
    } else if (constraint.min != null || constraint.max != null) {
      and.push({
        specs: {
          some: {
            key: constraint.key,
            valueNumber: {
              ...(constraint.min != null && { gte: constraint.min }),
              ...(constraint.max != null && { lte: constraint.max }),
            },
          },
        },
      })
    }
  }

  if (query.text?.trim()) {
    // One AND-ed clause per term, each term free to match a different field.
    // Matching the whole phrase as a single substring is the classic bug this
    // replaces: "ball valve ss316" matched nothing because no single column
    // contains that exact run of characters, even though "ball valve" lives in
    // the name and "SS316" in a spec. Terms are capped and passed as Prisma
    // parameters, so a hostile query can neither explode the plan nor inject.
    // The ranking pass below still reorders whatever this returns.
    const terms = query.text.trim().split(/\s+/).filter(Boolean).slice(0, 8)
    for (const term of terms) {
      and.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { tags: { hasSome: [term.toLowerCase()] } },
          { shortDescription: { contains: term, mode: 'insensitive' } },
          { specs: { some: { displayValue: { contains: term, mode: 'insensitive' } } } },
          { brand: { name: { contains: term, mode: 'insensitive' } } },
          { category: { name: { contains: term, mode: 'insensitive' } } },
          { subcategory: { name: { contains: term, mode: 'insensitive' } } },
        ],
      })
    }
  }

  return { AND: and }
}

function buildOrderBy(query: CatalogQuery): Prisma.ProductOrderByWithRelationInput[] {
  switch (query.sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { id: 'asc' }]
    case 'price_desc':
      return [{ price: 'desc' }, { id: 'asc' }]
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'asc' }]
    case 'rating':
      return [{ ratingAverage: 'desc' }, { id: 'asc' }]
    case 'relevance':
    case 'popular':
    default:
      return [{ rfqCount: 'desc' }, { viewCount: 'desc' }, { id: 'asc' }]
  }
}

/* -------------------------------------------------------------------------- */

export class PrismaCatalogRepository implements CatalogRepository {
  /* ---------------------------------------------------------------- search */

  async search(query: CatalogQuery): Promise<Page<ProductView>> {
    const started = performance.now()
    const where = buildWhere(query)
    // `Number.isFinite`, not `??`: NaN is not nullish, so it passes a nullish
    // check and then poisons every comparison it touches. That is not
    // hypothetical — a page-size constant imported from a `'use client'`
    // module arrives as a client reference, `Math.max` of it is NaN, and
    // Prisma rejects `take: NaN` with an error naming neither the page nor the
    // constant. The in-memory driver silently returned an empty slice instead.
    const requested = query.limit
    const limit = Number.isFinite(requested)
      ? Math.min(96, Math.max(1, requested as number))
      : 24

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: buildOrderBy(query),
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
    ])

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    let items = page.map(toProductView)

    // Relevance sorting has no SQL equivalent that matches the memory driver,
    // so a text query is reordered through the shared ranking engine.
    if (query.text?.trim() && (query.sort ?? 'relevance') === 'relevance' && items.length > 1) {
      const index = new CatalogIndex(items, await corpusStats.get())
      items = index.search({ text: query.text, limit: items.length }).items
    }

    return {
      items,
      total,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      facets: await this.buildFacets(query),
      tookMs: Math.round((performance.now() - started) * 100) / 100,
    }
  }

  /**
   * Facet counts, each excluding its own filter.
   *
   * Without that exclusion, selecting one material drops every other material
   * to zero and a second value can never be added — the single most common
   * faceted-search bug, and the one that makes a filter panel feel broken.
   */
  private async buildFacets(query: CatalogQuery): Promise<Page<ProductView>['facets']> {
    const withoutCategory = buildWhere({ ...query, categoryKeys: undefined })
    const withoutBrand = buildWhere({ ...query, brandKeys: undefined })
    const withoutAvailability = buildWhere({ ...query, availability: undefined })
    const withoutPrice = buildWhere({ ...query, price: undefined })

    const [categories, brands, availability, priceRange] = await Promise.all([
      prisma.product.groupBy({
        by: ['categoryId'],
        where: withoutCategory,
        _count: { _all: true },
      }),
      prisma.product.groupBy({
        by: ['brandId'],
        where: withoutBrand,
        _count: { _all: true },
      }),
      prisma.product.groupBy({
        by: ['availabilityState'],
        where: withoutAvailability,
        _count: { _all: true },
      }),
      prisma.product.aggregate({
        where: withoutPrice,
        _min: { price: true },
        _max: { price: true },
      }),
    ])

    const [categoryRows, brandRows] = await Promise.all([
      prisma.category.findMany({ where: { id: { in: categories.map((c) => c.categoryId) } } }),
      prisma.brand.findMany({ where: { id: { in: brands.map((b) => b.brandId) } } }),
    ])

    const categoryById = new Map(categoryRows.map((row) => [row.id, row]))
    const brandById = new Map(brandRows.map((row) => [row.id, row]))
    const selectedCategories = new Set(query.categoryKeys ?? [])
    const selectedBrands = new Set(query.brandKeys ?? [])
    const selectedAvailability = new Set<string>(query.availability ?? [])

    const facets: Page<ProductView>['facets'] = []

    const categoryBuckets = categories
      .map((row) => {
        const category = categoryById.get(row.categoryId)
        return category
          ? {
              value: category.key,
              label: category.name,
              count: row._count._all,
              selected: selectedCategories.has(category.key),
            }
          : null
      })
      .filter((bucket): bucket is NonNullable<typeof bucket> => bucket != null)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

    if (categoryBuckets.length > 1) {
      facets.push({
        key: 'category',
        label: 'Category',
        kind: 'enum',
        group: 'Catalogue',
        buckets: categoryBuckets,
        collapseAfter: 8,
      })
    }

    const brandBuckets = brands
      .map((row) => {
        const brand = brandById.get(row.brandId)
        return brand
          ? {
              value: brand.key,
              label: brand.name,
              count: row._count._all,
              selected: selectedBrands.has(brand.key),
            }
          : null
      })
      .filter((bucket): bucket is NonNullable<typeof bucket> => bucket != null)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

    if (brandBuckets.length > 1) {
      facets.push({
        key: 'brand',
        label: 'Brand',
        kind: 'enum',
        group: 'Catalogue',
        buckets: brandBuckets,
        collapseAfter: 6,
      })
    }

    const AVAILABILITY_LABELS: Record<string, string> = {
      in_stock: 'In stock',
      low_stock: 'Low stock',
      made_to_order: 'Made to order',
      out_of_stock: 'Out of stock',
    }

    if (availability.length > 1) {
      facets.push({
        key: 'availability',
        label: 'Availability',
        kind: 'enum',
        group: 'Catalogue',
        buckets: availability
          .map((row) => ({
            value: row.availabilityState,
            label: AVAILABILITY_LABELS[row.availabilityState] ?? row.availabilityState,
            count: row._count._all,
            selected: selectedAvailability.has(row.availabilityState),
          }))
          .sort((a, b) => b.count - a.count),
      })
    }

    if (priceRange._min.price != null && priceRange._max.price != null) {
      facets.push({
        key: 'price',
        label: 'Price',
        kind: 'range',
        group: 'Commercial',
        range: {
          min: priceRange._min.price,
          max: priceRange._max.price,
          selectedMin: query.price?.min ?? null,
          selectedMax: query.price?.max ?? null,
        },
      })
    }

    // Spec facets need the enum/range shape per key. Grouping on the EAV table
    // gives the counts; the registry supplies labels on the render side.
    //
    // Each spec facet is counted with its *own* constraint lifted, exactly as
    // category and brand are above. Counting them all under one `where` is the
    // easy mistake: picking Stainless Steel drops every other material to
    // zero, the facet falls below the two-value threshold and disappears, and
    // a multi-select filter has silently become single-choice.
    //
    // Unconstrained keys share one query; each constrained key costs one more.
    // That is at most a handful — the filter panel is not a hundred facets deep.
    const constrainedKeys = (query.specs ?? []).map((entry) => entry.key)

    const specGroups = (
      await Promise.all([
        prisma.productSpec.groupBy({
          by: ['key', 'valueText'],
          where: {
            valueText: { not: null },
            key: { notIn: constrainedKeys },
            product: buildWhere(query),
          },
          _count: { _all: true },
        }),
        ...constrainedKeys.map((key) =>
          prisma.productSpec.groupBy({
            by: ['key', 'valueText'],
            where: {
              valueText: { not: null },
              key,
              product: buildWhere({
                ...query,
                specs: query.specs?.filter((entry) => entry.key !== key),
              }),
            },
            _count: { _all: true },
          })
        ),
      ])
    ).flat()

    const byKey = new Map<string, { value: string; count: number }[]>()
    for (const row of specGroups) {
      if (!row.valueText) continue
      const list = byKey.get(row.key) ?? []
      list.push({ value: row.valueText, count: row._count._all })
      byKey.set(row.key, list)
    }

    const { SPEC_BY_KEY, specEnumLabel } = await import('@/server/catalog/spec-registry')

    for (const [key, values] of byKey) {
      const definition = SPEC_BY_KEY.get(key)
      if (!definition?.isFilterable || values.length < 2) continue

      const constraint = query.specs?.find((entry) => entry.key === key)
      const selected = new Set(constraint?.values ?? [])

      facets.push({
        key,
        label: definition.label,
        kind: 'enum',
        group: 'Specification',
        collapseAfter: 6,
        buckets: values
          .map((entry) => ({
            value: entry.value,
            label: specEnumLabel(key, entry.value),
            count: entry.count,
            selected: selected.has(entry.value),
          }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      })
    }

    return facets
  }

  /* ------------------------------------------------------------------ rank */

  async rankByIntent(intent: SearchIntent, limit = 12): Promise<RankedPage> {
    // Only a stated ceiling and an explicit stock requirement filter in SQL.
    // Everything else is scored, so a near-miss stays visible and labelled.
    const where = buildWhere({
      categoryKeys: intent.categoryKeys.length > 0 ? intent.categoryKeys : undefined,
      brandKeys: intent.brandKeys.length > 0 ? intent.brandKeys : undefined,
      price: intent.price.max != null ? { max: Math.round(intent.price.max * 1.15) } : undefined,
      availability: intent.requiresInStock ? ['in_stock', 'low_stock'] : undefined,
    })

    let rows = await prisma.product.findMany({
      where,
      include: productInclude,
      take: RANK_CANDIDATE_CAP,
      orderBy: [{ rfqCount: 'desc' }, { id: 'asc' }],
    })

    // A category constraint that eliminated everything usually means the parse
    // was wrong about the category, not that nothing exists.
    if (rows.length === 0 && intent.categoryKeys.length > 0) {
      rows = await prisma.product.findMany({
        where: buildWhere({
          price: intent.price.max != null ? { max: Math.round(intent.price.max * 1.15) } : undefined,
          availability: intent.requiresInStock ? ['in_stock', 'low_stock'] : undefined,
        }),
        include: productInclude,
        take: RANK_CANDIDATE_CAP,
        orderBy: [{ rfqCount: 'desc' }, { id: 'asc' }],
      })
    }

    if (rows.length === 0) return { results: [], total: 0 }

    // Same engine as the memory driver — the two must never disagree.
    return new CatalogIndex(rows.map(toProductView), await corpusStats.get()).rank(intent, limit)
  }

  async explain(productId: string, intent: SearchIntent): Promise<RankedProduct | null> {
    const row = await prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    })
    if (!row) return null

    const product = toProductView(row)
    // A one-document index has no usable corpus of its own — every IDF would
    // collapse to the same value. The shared snapshot supplies them.
    return new CatalogIndex([product], await corpusStats.get()).explain(product, intent)
  }

  /* ----------------------------------------------------------------- reads */

  async findBySlug(slug: string): Promise<ProductView | null> {
    const row = await prisma.product.findFirst({
      where: { slug, status: { not: 'archived' } },
      include: productInclude,
    })
    return row ? toProductView(row) : null
  }

  async findById(id: string): Promise<ProductView | null> {
    const row = await prisma.product.findFirst({
      where: { id, status: { not: 'archived' } },
      include: productInclude,
    })
    return row ? toProductView(row) : null
  }

  async findManyByIds(ids: string[]): Promise<ProductView[]> {
    if (ids.length === 0) return []

    const rows = await prisma.product.findMany({
      where: { id: { in: ids }, status: { not: 'archived' } },
      include: productInclude,
    })

    // Preserve the caller's order — a comparison or shortlist is ordered by the
    // buyer, and `IN` returns rows in whatever order the planner chose.
    const byId = new Map(rows.map((row) => [row.id, toProductView(row)]))
    return ids
      .map((id) => byId.get(id))
      .filter((product): product is ProductView => product != null)
  }

  async related(productId: string, limit = 4): Promise<ProductView[]> {
    const explicit = await prisma.productRelation.findMany({
      where: { sourceId: productId },
      orderBy: { position: 'asc' },
      take: limit,
      include: { target: { include: productInclude } },
    })

    const results = explicit
      .filter((relation) => relation.target.status === 'active')
      .map((relation) => toProductView(relation.target))

    if (results.length >= limit) return results

    // Top up from the same subcategory so a related row is never short.
    const source = await prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, subcategoryId: true },
    })
    if (!source) return results

    const taken = new Set([productId, ...results.map((product) => product.id)])
    const fill = await prisma.product.findMany({
      where: {
        status: 'active',
        id: { notIn: [...taken] },
        OR: [
          ...(source.subcategoryId ? [{ subcategoryId: source.subcategoryId }] : []),
          { categoryId: source.categoryId },
        ],
      },
      include: productInclude,
      take: limit - results.length,
      orderBy: [{ rfqCount: 'desc' }],
    })

    return [...results, ...fill.map(toProductView)]
  }

  async featured(limit = 8): Promise<ProductView[]> {
    const rows = await prisma.product.findMany({
      where: { status: 'active' },
      include: productInclude,
      orderBy: [{ rfqCount: 'desc' }, { viewCount: 'desc' }],
      take: limit,
    })
    return rows.map(toProductView)
  }

  async allSlugs(): Promise<string[]> {
    const rows = await prisma.product.findMany({
      where: { status: 'active' },
      select: { slug: true },
    })
    return rows.map((row) => row.slug)
  }

  /* -------------------------------------------------------------- taxonomy */

  async categories(): Promise<Category[]> {
    const rows = await prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }] })
    return rows.map(toCategory)
  }

  async topLevelCategories(): Promise<Category[]> {
    const rows = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
    })
    return rows.map(toCategory)
  }

  async categoryBySlug(slug: string): Promise<Category | null> {
    const row = await prisma.category.findUnique({ where: { slug } })
    return row ? toCategory(row) : null
  }

  async childrenOf(categoryId: string): Promise<Category[]> {
    const rows = await prisma.category.findMany({
      where: { parentId: categoryId },
      orderBy: { sortOrder: 'asc' },
    })
    return rows.map(toCategory)
  }

  async brands(): Promise<Brand[]> {
    const rows = await prisma.brand.findMany({ orderBy: { name: 'asc' } })
    return rows.map(toBrand)
  }

  async brandBySlug(slug: string): Promise<Brand | null> {
    const row = await prisma.brand.findUnique({ where: { slug } })
    return row ? toBrand(row) : null
  }

  async sellers(): Promise<Seller[]> {
    const rows = await prisma.seller.findMany({ orderBy: { name: 'asc' } })
    return rows.map(toSeller)
  }

  /* ------------------------------------------------------------ aggregates */

  async count(query: CatalogQuery = {}): Promise<number> {
    return prisma.product.count({ where: buildWhere(query) })
  }

  async stats(): Promise<CatalogStats> {
    const [products, categories, brands, sellers, inStock, average] = await Promise.all([
      prisma.product.count({ where: { status: 'active' } }),
      prisma.category.count({ where: { parentId: null } }),
      prisma.brand.count(),
      prisma.seller.count(),
      prisma.product.count({ where: { status: 'active', availabilityState: 'in_stock' } }),
      prisma.product.aggregate({ where: { status: 'active' }, _avg: { price: true } }),
    ])

    return {
      products,
      categories,
      brands,
      sellers,
      inStock,
      averagePrice: Math.round(average._avg.price ?? 0),
    }
  }

  /* ---------------------------------------------------------------- writes */

  async findAnyById(id: string): Promise<Product | null> {
    const row = await prisma.product.findUnique({ where: { id }, include: productInclude })
    return row ? toProduct(row) : null
  }

  async listAll(): Promise<Product[]> {
    const rows = await prisma.product.findMany({
      include: productInclude,
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map(toProduct)
  }

  /**
   * Creates or replaces a product and its child rows in one transaction.
   *
   * Specs, images, documents and relations are deleted and rewritten rather
   * than diffed. For a record this size the diff is more code and more ways to
   * be subtly wrong than the rewrite is expensive.
   */
  async upsertProduct(product: Product): Promise<Product> {
    const { SPEC_BY_KEY } = await import('@/server/catalog/spec-registry')

    const scalars = {
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      brandId: product.brandId,
      sellerId: product.sellerId,
      price: product.price,
      listPrice: product.listPrice,
      priceUnit: product.priceUnit,
      taxRatePercent: product.taxRatePercent,
      status: product.status,
      availabilityState: product.availability.state,
      quantityOnHand: product.availability.quantityOnHand,
      leadTimeDays: product.availability.leadTimeDays,
      minOrderQuantity: product.availability.minOrderQuantity,
      unit: product.availability.unit,
      applications: product.applications,
      industries: product.industries,
      tags: product.tags,
      certifications: product.certifications,
      warrantyMonths: product.warrantyMonths,
      ratingAverage: product.rating?.average ?? null,
      ratingCount: product.rating?.count ?? 0,
      viewCount: product.metrics.views,
      rfqCount: product.metrics.rfqs,
      saveCount: product.metrics.saves,
    } satisfies Prisma.ProductUncheckedCreateInput extends infer T
      ? Omit<T, 'id'>
      : never

    await prisma.$transaction(async (tx) => {
      await tx.product.upsert({
        where: { id: product.id },
        create: { id: product.id, ...scalars },
        update: scalars,
      })

      await tx.productSpec.deleteMany({ where: { productId: product.id } })
      if (product.specs.length > 0) {
        await tx.productSpec.createMany({
          data: product.specs.map((spec) => ({
            productId: product.id,
            key: spec.key,
            dataType: specTypeToPrisma(SPEC_BY_KEY.get(spec.key)?.dataType ?? 'text'),
            valueText: spec.valueText ?? null,
            valueNumber: spec.valueNumber ?? null,
            valueBool: spec.valueBool ?? null,
            unit: spec.unit ?? null,
            displayValue: spec.displayValue,
          })),
        })
      }

      await tx.productImage.deleteMany({ where: { productId: product.id } })
      if (product.images.length > 0) {
        await tx.productImage.createMany({
          data: product.images.map((image, position) => ({
            productId: product.id,
            url: image.url,
            alt: image.alt,
            width: image.width,
            height: image.height,
            blurDataUrl: image.blurDataUrl ?? null,
            position,
          })),
        })
      }

      await tx.productDocument.deleteMany({ where: { productId: product.id } })
      if (product.documents.length > 0) {
        await tx.productDocument.createMany({
          data: product.documents.map((document) => ({
            id: document.id,
            productId: product.id,
            kind: document.kind,
            title: document.title,
            url: document.url,
            sizeKb: document.sizeKb,
            format: document.format,
          })),
        })
      }

      await tx.productRelation.deleteMany({ where: { sourceId: product.id } })
      if (product.relatedProductIds.length > 0) {
        // Only relate to products that exist; a dangling id would violate the
        // foreign key and fail the whole save.
        const existing = await tx.product.findMany({
          where: { id: { in: product.relatedProductIds } },
          select: { id: true },
        })
        const valid = new Set(existing.map((row) => row.id))

        await tx.productRelation.createMany({
          data: product.relatedProductIds
            .filter((id) => valid.has(id))
            .map((targetId, position) => ({ sourceId: product.id, targetId, position })),
          skipDuplicates: true,
        })
      }

      await refreshCounts(tx, product)
    })

    // The edit changed the text and the counts the snapshot was built from, so
    // an admin sees their own change reflected on the next query rather than
    // when the TTL happens to lapse.
    corpusStats.invalidate()

    return product
  }

  async setProductStatus(id: string, status: Product['status']): Promise<Product | null> {
    const existing = await prisma.product.findUnique({ where: { id }, include: productInclude })
    if (!existing) return null

    const updated = await prisma.product.update({
      where: { id },
      data: { status },
      include: productInclude,
    })

    await prisma.$transaction(async (tx) => {
      await refreshCounts(tx, toProduct(updated))
    })

    // Archiving removes a document from the corpus; restoring adds one back.
    corpusStats.invalidate()

    return toProduct(updated)
  }
}

/**
 * Recomputes the denormalised counts touched by a write.
 *
 * Only the affected category, subcategory and brand — a full recount on every
 * product save would scan the whole catalogue for no benefit.
 */
async function refreshCounts(
  tx: Prisma.TransactionClient,
  product: Product
): Promise<void> {
  const ids = [product.categoryId, product.subcategoryId].filter(
    (id): id is string => id != null
  )

  for (const categoryId of ids) {
    const count = await tx.product.count({
      where: {
        status: { not: 'archived' },
        OR: [{ categoryId }, { subcategoryId: categoryId }],
      },
    })
    await tx.category.update({ where: { id: categoryId }, data: { productCount: count } })
  }

  const brandCount = await tx.product.count({
    where: { brandId: product.brandId, status: { not: 'archived' } },
  })
  await tx.brand.update({ where: { id: product.brandId }, data: { productCount: brandCount } })
}
