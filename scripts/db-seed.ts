/**
 * Loads the demo catalogue and accounts into PostgreSQL.
 *
 * Run: npm run db:seed   (after `docker compose up -d && npm run db:migrate`)
 *
 * Idempotent — every write is an upsert keyed on the stable seed ids, so it can
 * be re-run against an existing database without duplicating anything.
 *
 * It also computes and stores the product embeddings. In production that is a
 * background job triggered on product write; doing it inline here is fine
 * because it runs once against a known-size catalogue.
 */

import { PrismaClient } from '@prisma/client'
import type { Product } from '../src/lib/domain/catalog'
import { SEED_BRANDS, SEED_CATEGORIES, SEED_PRODUCTS, SEED_SELLERS } from '../src/server/seed'
import { SPEC_BY_KEY } from '../src/server/catalog/spec-registry'
import { embed } from '../src/server/catalog/vector'
import { tokenize } from '../src/server/catalog/text'
import { hashPassword } from '../src/server/auth/password'
import { DEMO_ACCOUNTS } from '../src/server/repositories/memory/store'

const prisma = new PrismaClient()

function specDataType(key: string): 'enumeration' | 'text' | 'number' | 'boolean' {
  const dataType = SPEC_BY_KEY.get(key)?.dataType ?? 'text'
  return dataType === 'enum' ? 'enumeration' : dataType
}

/** Same field weighting the in-memory index uses, so both rank alike. */
function documentText(product: Product): string {
  return [
    product.name,
    product.name,
    product.name,
    product.sku,
    product.tags.join(' '),
    product.tags.join(' '),
    product.shortDescription,
    product.specs.map((spec) => spec.displayValue).join(' '),
    product.certifications.join(' '),
    product.description,
  ].join(' ')
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Start the database with `docker compose up -d`.')
  }

  console.log('Seeding PostgreSQL…\n')

  /* --- Taxonomy --------------------------------------------------------- */
  // Parents first: subcategories carry a foreign key to them.
  const parents = SEED_CATEGORIES.filter((category) => category.parentId === null)
  const children = SEED_CATEGORIES.filter((category) => category.parentId !== null)

  for (const category of [...parents, ...children]) {
    const data = {
      key: category.key,
      slug: category.slug,
      name: category.name,
      description: category.description,
      icon: category.icon,
      featured: category.featured,
      sortOrder: category.sortOrder,
      parentId: category.parentId,
      productCount: category.productCount,
    }
    await prisma.category.upsert({
      where: { id: category.id },
      create: { id: category.id, ...data },
      update: data,
    })
  }
  console.log(`  categories   ${SEED_CATEGORIES.length}`)

  for (const brand of SEED_BRANDS) {
    const data = {
      key: brand.key,
      slug: brand.slug,
      name: brand.name,
      country: brand.country,
      description: brand.description,
      productCount: brand.productCount,
    }
    await prisma.brand.upsert({
      where: { id: brand.id },
      create: { id: brand.id, ...data },
      update: data,
    })
  }
  console.log(`  brands       ${SEED_BRANDS.length}`)

  for (const seller of SEED_SELLERS) {
    const data = {
      key: seller.key,
      name: seller.name,
      city: seller.city,
      state: seller.state,
      gstin: seller.gstin,
      verified: seller.verified,
      fulfilmentRate: seller.fulfilmentRate,
      responseHours: seller.responseHours,
      since: seller.since,
    }
    await prisma.seller.upsert({
      where: { id: seller.id },
      create: { id: seller.id, ...data },
      update: data,
    })
  }
  console.log(`  sellers      ${SEED_SELLERS.length}`)

  /* --- Products ---------------------------------------------------------- */
  for (const product of SEED_PRODUCTS) {
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
      createdAt: new Date(product.createdAt),
    }

    await prisma.product.upsert({
      where: { id: product.id },
      create: { id: product.id, ...scalars },
      update: scalars,
    })

    await prisma.productSpec.deleteMany({ where: { productId: product.id } })
    if (product.specs.length > 0) {
      await prisma.productSpec.createMany({
        data: product.specs.map((spec) => ({
          productId: product.id,
          key: spec.key,
          dataType: specDataType(spec.key),
          valueText: spec.valueText ?? null,
          valueNumber: spec.valueNumber ?? null,
          valueBool: spec.valueBool ?? null,
          unit: spec.unit ?? null,
          displayValue: spec.displayValue,
        })),
      })
    }

    await prisma.productImage.deleteMany({ where: { productId: product.id } })
    if (product.images.length > 0) {
      await prisma.productImage.createMany({
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

    await prisma.productDocument.deleteMany({ where: { productId: product.id } })
    if (product.documents.length > 0) {
      await prisma.productDocument.createMany({
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
  }
  console.log(`  products     ${SEED_PRODUCTS.length}`)

  /* --- Relations --------------------------------------------------------- */
  // A second pass: every product must exist before a relation can reference it.
  const existingIds = new Set(
    (await prisma.product.findMany({ select: { id: true } })).map((row) => row.id)
  )

  await prisma.productRelation.deleteMany({})
  for (const product of SEED_PRODUCTS) {
    const targets = product.relatedProductIds.filter((id) => existingIds.has(id))
    if (targets.length === 0) continue

    await prisma.productRelation.createMany({
      data: targets.map((targetId, position) => ({
        sourceId: product.id,
        targetId,
        position,
      })),
      skipDuplicates: true,
    })
  }
  console.log('  relations    linked')

  /* --- Embeddings -------------------------------------------------------- */
  // pgvector has no Prisma type, so the vector literal goes through raw SQL.
  // In production this is a background job on product write; inline here is
  // fine for a one-time seed of a known-size catalogue.
  for (const product of SEED_PRODUCTS) {
    const vector = embed(tokenize(documentText(product)))
    const literal = `[${Array.from(vector).map((value) => value.toFixed(6)).join(',')}]`

    await prisma.$executeRawUnsafe(
      `INSERT INTO "product_embeddings" ("productId", "vector", "model", "updatedAt")
       VALUES ($1, $2::vector, $3, NOW())
       ON CONFLICT ("productId") DO UPDATE
         SET "vector" = EXCLUDED."vector",
             "model" = EXCLUDED."model",
             "updatedAt" = NOW()`,
      product.id,
      literal,
      'offline-hashed-v1'
    )
  }
  console.log(`  embeddings   ${SEED_PRODUCTS.length}`)

  /* --- Demo accounts ------------------------------------------------------ */
  // Hashed through the same path a real registration uses — a seed that
  // shortcuts the hashing is a seed that hides a broken login.
  const passwordHash = await hashPassword(DEMO_ACCOUNTS.customer.password)

  const accounts = [
    {
      id: 'user_demo_customer',
      email: DEMO_ACCOUNTS.customer.email,
      name: 'Rajesh Kumar',
      role: 'customer' as const,
      company: 'Deccan Projects Pvt. Ltd.',
      phone: '+91 98450 22140',
      city: 'Hyderabad',
      gstin: '36AAGCD1129R1ZP',
    },
    {
      id: 'user_demo_admin',
      email: DEMO_ACCOUNTS.admin.email,
      name: 'Priya Menon',
      role: 'admin' as const,
      company: 'Sourcely Commerce Technologies',
      phone: '+91 22 6814 2200',
      city: 'Mumbai',
      gstin: null,
    },
  ]

  for (const account of accounts) {
    const { id, ...data } = account
    await prisma.user.upsert({
      where: { id },
      create: { id, ...data, passwordHash, emailVerified: true },
      update: { ...data, passwordHash, emailVerified: true },
    })
  }
  console.log(`  users        ${accounts.length}`)

  /* --- Counts ------------------------------------------------------------- */
  // Denormalised counts recomputed from what actually landed, so the numbers
  // shown in the UI are true rather than inherited from the seed constants.
  for (const category of SEED_CATEGORIES) {
    const count = await prisma.product.count({
      where: {
        status: { not: 'archived' },
        OR: [{ categoryId: category.id }, { subcategoryId: category.id }],
      },
    })
    await prisma.category.update({ where: { id: category.id }, data: { productCount: count } })
  }

  for (const brand of SEED_BRANDS) {
    const count = await prisma.product.count({
      where: { brandId: brand.id, status: { not: 'archived' } },
    })
    await prisma.brand.update({ where: { id: brand.id }, data: { productCount: count } })
  }
  console.log('  counts       recomputed')

  console.log('\nSeed complete.')
  console.log(`  Sign in: ${DEMO_ACCOUNTS.customer.email} / ${DEMO_ACCOUNTS.customer.password}`)
}

main()
  .catch((error) => {
    console.error('\nSeed failed:\n', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
