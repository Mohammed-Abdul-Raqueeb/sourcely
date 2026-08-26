'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { CATALOG_TAG } from '@/server/catalog/cached-search'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Product, ProductImage, ProductSpec } from '@/lib/domain/catalog'
import { toFieldErrors, type FormState } from '@/lib/validation/auth'
import { productSchema, rfqMessageSchema, rfqUpdateSchema } from '@/lib/validation/admin'
import {
  getAdminRepository,
  getCatalogRepository,
  getActivityRepository,
} from '@/server/repositories'
import { requireRole, getSession } from '@/server/auth/session'
import { SPEC_BY_KEY, specsForCategory } from '@/server/catalog/spec-registry'
import { BRAND_BY_KEY, CATEGORY_BY_KEY, SELLER_BY_KEY } from '@/server/seed/taxonomy'
import { RFQ_STATUS_LABELS } from '@/lib/domain/account'
import { recordAudit, diffFields } from '@/server/audit/record'
import { keyFromUrl } from '@/server/uploads/storage'
import { rfqQuotedEmail, sendMailInBackground } from '@/server/mail'

/**
 * Admin server actions.
 *
 * Every one starts with `requireRole('staff')`. That call is not decoration:
 * a Server Action is a public POST endpoint whose id is discoverable in the
 * client bundle, so an action that only *renders* inside an admin page is
 * still reachable by anyone. The check has to be in the action itself.
 */

async function assertSameOrigin(): Promise<boolean> {
  const headerList = await headers()
  const origin = headerList.get('origin')
  if (!origin) return true
  const host = headerList.get('host')
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

const REJECTED: FormState = {
  status: 'error',
  message: 'That request could not be verified. Reload the page and try again.',
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

function slugify(name: string, sku: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 68)
  return `${base}-${sku.toLowerCase()}`
}

function splitList(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 40)
}

/**
 * Reads the dynamic spec fields.
 *
 * Only specs the registry says apply to the chosen category are accepted, and
 * enum values are checked against the registry. A spec key posted from a
 * crafted form that the category does not own would otherwise become an
 * unfilterable, uncomparable orphan attribute on a live product.
 */
function readSpecs(formData: FormData, categoryKey: string, sku: string): ProductSpec[] {
  const allowed = specsForCategory(categoryKey)
  const specs: ProductSpec[] = []

  for (const definition of allowed) {
    const raw = formData.get(`spec_${definition.key}`)
    if (raw == null) continue
    const value = String(raw).trim()
    if (value === '') continue

    if (definition.dataType === 'enum') {
      const option = definition.enumValues?.find((entry) => entry.value === value)
      if (!option) continue
      specs.push({ key: definition.key, valueText: value, displayValue: option.label })
      continue
    }

    if (definition.dataType === 'number') {
      const parsed = Number.parseFloat(value)
      if (!Number.isFinite(parsed)) continue
      const displayValue =
        definition.key === 'size_dn'
          ? `DN${parsed}`
          : definition.unit
            ? `${parsed} ${definition.unit}`
            : String(parsed)
      specs.push({
        key: definition.key,
        valueNumber: parsed,
        unit: definition.unit,
        displayValue,
      })
      continue
    }

    if (definition.dataType === 'boolean') {
      const truthy = value === 'on' || value === 'true' || value === 'yes'
      specs.push({ key: definition.key, valueBool: truthy, displayValue: truthy ? 'Yes' : 'No' })
      continue
    }

    specs.push({ key: definition.key, valueText: value.slice(0, 120), displayValue: value.slice(0, 120) })
  }

  void sku
  return specs
}

function buildArtwork(artwork: string, name: string): ProductImage[] {
  return (['front', 'section', 'detail', 'scale'] as const).map((view) => ({
    url: `artwork:${artwork}:${view}:0`,
    alt: `${name} — ${view} view`,
    width: 1200,
    height: 900,
    blurDataUrl: null,
  }))
}

/**
 * Re-reads the uploaded images the form posted back as hidden JSON fields.
 *
 * Every field is re-validated here rather than trusted. The values originate
 * from our own upload endpoint, but they make a round trip through the browser
 * on the way, and anything that has been in the client's hands is input again
 * by the time it returns. `keyFromUrl` rejects any URL that is not one this
 * system's storage layer produced, which is what stops an arbitrary remote URL
 * — or a `javascript:` one — being written into the catalogue.
 */
function parseUploadedImages(formData: FormData, name: string): ProductImage[] {
  const images: ProductImage[] = []

  for (const raw of formData.getAll('images').slice(0, 8)) {
    try {
      const parsed = JSON.parse(String(raw)) as Partial<ProductImage>
      if (typeof parsed.url !== 'string' || !keyFromUrl(parsed.url)) continue

      const width = Number(parsed.width)
      const height = Number(parsed.height)
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        continue
      }

      images.push({
        url: parsed.url,
        alt: String(parsed.alt ?? name).slice(0, 160) || name,
        width: Math.round(width),
        height: Math.round(height),
        // A data: URI is inlined into the HTML, so cap it — an oversized one
        // would bloat every page the product appears on.
        blurDataUrl:
          typeof parsed.blurDataUrl === 'string' &&
          parsed.blurDataUrl.startsWith('data:image/') &&
          parsed.blurDataUrl.length < 4_000
            ? parsed.blurDataUrl
            : null,
      })
    } catch {
      // A malformed field is dropped rather than failing the whole save.
    }
  }

  return images
}

export async function saveProductAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED
  await requireRole('staff', '/admin/products')

  const parsed = productSchema.safeParse({
    sku: formData.get('sku'),
    name: formData.get('name'),
    shortDescription: formData.get('shortDescription'),
    description: formData.get('description'),
    categoryKey: formData.get('categoryKey'),
    subcategoryKey: formData.get('subcategoryKey'),
    brandKey: formData.get('brandKey'),
    sellerKey: formData.get('sellerKey'),
    price: formData.get('price'),
    listPrice: formData.get('listPrice') || undefined,
    priceUnit: formData.get('priceUnit'),
    taxRatePercent: formData.get('taxRatePercent'),
    status: formData.get('status'),
    availabilityState: formData.get('availabilityState'),
    quantityOnHand: formData.get('quantityOnHand') || undefined,
    leadTimeDays: formData.get('leadTimeDays') || undefined,
    minOrderQuantity: formData.get('minOrderQuantity'),
    unit: formData.get('unit'),
    warrantyMonths: formData.get('warrantyMonths') || undefined,
    certifications: formData.get('certifications') || undefined,
    tags: formData.get('tags') || undefined,
    applications: formData.getAll('applications').map(String),
    industries: formData.getAll('industries').map(String),
    artwork: formData.get('artwork') || 'ball-valve',
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const input = parsed.data
  const uploaded = parseUploadedImages(formData, input.name)

  /* --- Taxonomy must resolve ------------------------------------------- */
  const category = CATEGORY_BY_KEY.get(input.categoryKey)
  const subcategory = CATEGORY_BY_KEY.get(input.subcategoryKey)
  const brand = BRAND_BY_KEY.get(input.brandKey)
  const seller = SELLER_BY_KEY.get(input.sellerKey)

  if (!category) return { status: 'error', fieldErrors: { categoryKey: 'Unknown category' } }
  if (!brand) return { status: 'error', fieldErrors: { brandKey: 'Unknown brand' } }
  if (!seller) return { status: 'error', fieldErrors: { sellerKey: 'Unknown seller' } }
  if (!subcategory || subcategory.parentId !== category.id) {
    return {
      status: 'error',
      fieldErrors: { subcategoryKey: 'That subcategory does not belong to the chosen category' },
    }
  }

  if (input.listPrice != null && input.listPrice > 0 && input.listPrice < input.price) {
    return {
      status: 'error',
      fieldErrors: { listPrice: 'List price cannot be below the selling price' },
    }
  }

  const catalog = getCatalogRepository()

  const editingId = String(formData.get('productId') ?? '').trim() || null
  const existing = editingId ? await catalog.findAnyById(editingId) : null

  // A duplicate SKU breaks the one thing buyers use to talk to suppliers.
  const all = await catalog.listAll()
  const clash = all.find(
    (product) => product.sku === input.sku && product.id !== (existing?.id ?? '')
  )
  if (clash) {
    return { status: 'error', fieldErrors: { sku: `SKU ${input.sku} is already used by ${clash.name}` } }
  }

  const now = new Date().toISOString()
  const id = existing?.id ?? `prod_${input.sku.toLowerCase()}`

  const product: Product = {
    id,
    slug: slugify(input.name, input.sku),
    sku: input.sku,
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,

    categoryId: category.id,
    subcategoryId: subcategory.id,
    brandId: brand.id,
    sellerId: seller.id,

    price: input.price,
    listPrice: input.listPrice && input.listPrice > input.price ? input.listPrice : null,
    currency: 'INR',
    priceUnit: input.priceUnit,
    taxRatePercent: input.taxRatePercent,

    status: input.status,
    availability: {
      state: input.availabilityState,
      quantityOnHand:
        input.availabilityState === 'made_to_order' ? null : (input.quantityOnHand ?? 0),
      leadTimeDays: input.leadTimeDays ?? null,
      minOrderQuantity: input.minOrderQuantity,
      unit: input.unit,
    },

    // Photography first, then the generated drawings. The gallery shows the
    // real thing where one exists and still has the technical views to fall
    // back on, which is what a supplier with one product photo actually has.
    images: [...uploaded, ...buildArtwork(input.artwork, input.name)],
    specs: readSpecs(formData, input.categoryKey, input.sku),

    applications: input.applications ?? [],
    industries: input.industries ?? [],
    tags: splitList(input.tags),

    documents: existing?.documents ?? [],
    warrantyMonths: input.warrantyMonths ?? null,
    certifications: splitList(input.certifications),
    relatedProductIds: existing?.relatedProductIds ?? [],

    // Metrics and ratings are earned, not entered. A new product starts empty
    // rather than inheriting a plausible-looking number.
    rating: existing?.rating ?? null,
    metrics: existing?.metrics ?? { views: 0, rfqs: 0, saves: 0 },

    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await catalog.upsertProduct(product)

  await recordAudit({
    action: existing ? 'product_update' : 'product_create',
    targetType: 'product',
    targetId: product.id,
    summary: `${product.sku} — ${product.name}`,
    // Price, stock and status are the fields a dispute is ever actually about.
    changes: diffFields(
      existing
        ? {
            name: existing.name,
            price: existing.price,
            status: existing.status,
            availabilityState: existing.availability.state,
            quantityOnHand: existing.availability.quantityOnHand,
            categoryId: existing.categoryId,
            brandId: existing.brandId,
          }
        : null,
      {
        name: product.name,
        price: product.price,
        status: product.status,
        availabilityState: product.availability.state,
        quantityOnHand: product.availability.quantityOnHand,
        categoryId: product.categoryId,
        brandId: product.brandId,
      },
      ['name', 'price', 'status', 'availabilityState', 'quantityOnHand', 'categoryId', 'brandId']
    ),
  })

  // The catalogue is statically generated, so an edit has to invalidate the
  // pages that render it or the change is invisible until the next deploy.
  // The tag flushes the cached /products search results the same way.
  revalidateTag(CATALOG_TAG)
  revalidatePath('/products')
  revalidatePath(`/products/${product.slug}`)
  revalidatePath('/categories', 'layout')
  revalidatePath('/admin/products')
  revalidatePath('/admin')

  redirect(`/admin/products/${product.id}?saved=1`)
}

export async function setProductStatusAction(
  productId: string,
  status: Product['status']
): Promise<void> {
  await requireRole('staff', '/admin/products')

  const catalog = getCatalogRepository()
  const before = await catalog.findAnyById(productId)

  const updated = await catalog.setProductStatus(productId, status)
  if (!updated) return

  // Archiving removes a product from the public catalogue. That is the closest
  // thing to a delete this system has, so it is the entry most worth keeping.
  await recordAudit({
    action: 'product_status_change',
    targetType: 'product',
    targetId: productId,
    summary: `${updated.sku} → ${status}`,
    changes: before ? { status: { from: before.status, to: status } } : null,
  })

  revalidateTag(CATALOG_TAG)
  revalidatePath('/products')
  revalidatePath(`/products/${updated.slug}`)
  revalidatePath('/admin/products')
  revalidatePath('/admin')
}

/* -------------------------------------------------------------------------- */
/* Quotations                                                                 */
/* -------------------------------------------------------------------------- */

export async function updateRfqAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED
  const staff = await requireRole('staff', '/admin/rfq')

  const parsed = rfqUpdateSchema.safeParse({
    rfqId: formData.get('rfqId'),
    status: formData.get('status'),
    validUntil: formData.get('validUntil') ?? '',
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const admin = getAdminRepository()
  const rfq = await admin.findAnyRfq(parsed.data.rfqId)
  if (!rfq) return { status: 'error', message: 'That quotation no longer exists.' }

  /* --- Per-line quotes --------------------------------------------------- */
  const quotes: Record<string, { unitPrice: number; leadTimeDays: number }> = {}

  for (const item of rfq.items) {
    const price = Number.parseInt(String(formData.get(`price:${item.productId}`) ?? ''), 10)
    const lead = Number.parseInt(String(formData.get(`lead:${item.productId}`) ?? ''), 10)
    if (!Number.isFinite(price) || price <= 0) continue
    if (price > 100_000_000) {
      return { status: 'error', message: 'One of those unit prices looks wrong.' }
    }
    quotes[item.productId] = {
      unitPrice: price,
      leadTimeDays: Number.isFinite(lead) && lead >= 0 ? lead : 0,
    }
  }

  if (parsed.data.status === 'quoted' && Object.keys(quotes).length === 0) {
    return {
      status: 'error',
      message: 'Enter at least one unit price before marking this as quoted.',
    }
  }

  const updated = await admin.updateRfq(rfq.id, {
    status: parsed.data.status,
    quotes: Object.keys(quotes).length > 0 ? quotes : undefined,
    validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil).toISOString() : null,
  })

  // Tell the buyer. A status that changes silently is a status the buyer has
  // to poll for, which is the behaviour this platform exists to remove.
  if (updated?.userId && rfq.status !== parsed.data.status) {
    await getActivityRepository().createNotification({
      userId: updated.userId,
      kind: 'rfq_status',
      title: `${updated.reference} is now ${RFQ_STATUS_LABELS[parsed.data.status].toLowerCase()}`,
      body:
        updated.quotedTotal != null
          ? `The supplier has quoted ₹${updated.quotedTotal.toLocaleString('en-IN')} across ${updated.items.length} line${updated.items.length === 1 ? '' : 's'}.`
          : `Updated by ${staff.name}.`,
      href: `/account/rfq/${updated.id}`,
    })

    // Pricing is the one transition worth an email as well as an in-app
    // notification: a buyer who is not on the site cannot act on a quotation
    // they never learn about, and quotations have an expiry date.
    if (parsed.data.status === 'quoted') {
      const catalog = getCatalogRepository()
      const products = await catalog.findManyByIds(updated.items.map((item) => item.productId))
      const productNames = new Map(products.map((product) => [product.id, product.name]))

      sendMailInBackground(
        rfqQuotedEmail({
          to: { name: updated.contact.name, email: updated.contact.email },
          rfq: updated,
          productNames,
        })
      )
    }
  }

  await recordAudit({
    // Pricing and a plain status move are different events. Conflating them
    // makes "who set this price" unanswerable without reading every entry.
    action: parsed.data.status === 'quoted' ? 'rfq_quote' : 'rfq_status_change',
    targetType: 'rfq',
    targetId: rfq.id,
    summary: `${updated?.reference ?? rfq.reference} → ${RFQ_STATUS_LABELS[parsed.data.status]}`,
    changes: diffFields(
      { status: rfq.status, quotedTotal: rfq.quotedTotal, validUntil: rfq.validUntil },
      {
        status: updated?.status ?? rfq.status,
        quotedTotal: updated?.quotedTotal ?? null,
        validUntil: updated?.validUntil ?? null,
      },
      ['status', 'quotedTotal', 'validUntil']
    ),
  })

  revalidatePath(`/admin/rfq/${rfq.id}`)
  revalidatePath('/admin/rfq')
  revalidatePath('/admin')
  revalidatePath(`/account/rfq/${rfq.id}`)
  revalidatePath('/account/rfq')

  return { status: 'success', message: 'Quotation updated and the buyer notified.' }
}

export async function addRfqMessageAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED
  const session = await getSession()
  const staff = await requireRole('staff', '/admin/rfq')

  const parsed = rfqMessageSchema.safeParse({
    rfqId: formData.get('rfqId'),
    body: formData.get('body'),
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const admin = getAdminRepository()
  const updated = await admin.addRfqMessage(
    parsed.data.rfqId,
    { id: staff.id, role: session?.user.role ?? 'staff' },
    parsed.data.body
  )

  if (!updated) return { status: 'error', message: 'That quotation no longer exists.' }

  if (updated.userId) {
    await getActivityRepository().createNotification({
      userId: updated.userId,
      kind: 'rfq_message',
      title: `New message on ${updated.reference}`,
      body: parsed.data.body.slice(0, 180),
      href: `/account/rfq/${updated.id}`,
    })
  }

  await recordAudit({
    action: 'rfq_message',
    targetType: 'rfq',
    targetId: updated.id,
    // The body is not copied into the entry — it already lives on the thread,
    // and duplicating buyer correspondence into the audit log doubles the
    // amount of personal data under retention for no investigative gain.
    summary: `Message sent on ${updated.reference}`,
  })

  revalidatePath(`/admin/rfq/${updated.id}`)
  revalidatePath(`/account/rfq/${updated.id}`)
  revalidatePath('/account/notifications')

  return { status: 'success', message: 'Message sent.' }
}

/** Exposed so the product form can show which specs a category expects. */
export async function specKeysForCategory(categoryKey: string): Promise<string[]> {
  await requireRole('staff')
  return specsForCategory(categoryKey).map((definition) => definition.key)
}

export async function specLabelFor(key: string): Promise<string> {
  await requireRole('staff')
  return SPEC_BY_KEY.get(key)?.label ?? key
}
