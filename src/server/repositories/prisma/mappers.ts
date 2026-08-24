import 'server-only'
import type { Prisma } from '@prisma/client'
import type {
  Brand,
  Category,
  Product,
  ProductSpec,
  ProductView,
  Seller,
  SpecDataType,
} from '@/lib/domain/catalog'
import type { AssistantMessage, Conversation, SearchIntent } from '@/lib/domain/search'
import type {
  Notification,
  Rfq,
  SavedProduct,
  SavedSearch,
  SearchEvent,
  User,
} from '@/lib/domain/account'
import type { UserRecord } from '../types'

/**
 * Row → domain mappers.
 *
 * All conversion lives here rather than being scattered through the
 * repositories, so the two drivers stay observably identical. Two rules the
 * mappers exist to hold:
 *
 *   1. Dates become ISO strings. The domain types are serialisable across the
 *      RSC boundary; a `Date` is not, and a page that works in the memory
 *      driver would break under Postgres.
 *   2. `passwordHash` is only ever present on `UserRecord`, never on `User`.
 */

/* -------------------------------------------------------------------------- */
/* Selection shapes                                                           */
/* -------------------------------------------------------------------------- */

export const productInclude = {
  category: true,
  subcategory: true,
  brand: true,
  seller: true,
  specs: true,
  images: { orderBy: { position: 'asc' } },
  documents: true,
  relatedTo: { orderBy: { position: 'asc' } },
} satisfies Prisma.ProductInclude

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>

/* -------------------------------------------------------------------------- */
/* Taxonomy                                                                   */
/* -------------------------------------------------------------------------- */

export function toCategory(row: Prisma.CategoryGetPayload<object>): Category {
  return {
    id: row.id,
    key: row.key,
    slug: row.slug,
    name: row.name,
    parentId: row.parentId,
    description: row.description,
    icon: row.icon,
    productCount: row.productCount,
    featured: row.featured,
    sortOrder: row.sortOrder,
  }
}

export function toBrand(row: Prisma.BrandGetPayload<object>): Brand {
  return {
    id: row.id,
    key: row.key,
    slug: row.slug,
    name: row.name,
    country: row.country,
    description: row.description,
    productCount: row.productCount,
  }
}

export function toSeller(row: Prisma.SellerGetPayload<object>): Seller {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    city: row.city,
    state: row.state,
    gstin: row.gstin,
    verified: row.verified,
    fulfilmentRate: row.fulfilmentRate,
    responseHours: row.responseHours,
    since: row.since,
  }
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/** Prisma reserves `enum` as a member name, so the enum case is `enumeration`. */
const SPEC_TYPE_TO_DOMAIN: Record<string, SpecDataType> = {
  enumeration: 'enum',
  text: 'text',
  number: 'number',
  boolean: 'boolean',
}

export function specTypeToPrisma(dataType: SpecDataType): 'enumeration' | 'text' | 'number' | 'boolean' {
  return dataType === 'enum' ? 'enumeration' : dataType
}

export function specTypeToDomain(value: string): SpecDataType {
  return SPEC_TYPE_TO_DOMAIN[value] ?? 'text'
}

function toSpec(row: Prisma.ProductSpecGetPayload<object>): ProductSpec {
  return {
    key: row.key,
    ...(row.valueText != null && { valueText: row.valueText }),
    ...(row.valueNumber != null && { valueNumber: row.valueNumber }),
    ...(row.valueBool != null && { valueBool: row.valueBool }),
    ...(row.unit != null && { unit: row.unit }),
    displayValue: row.displayValue,
  }
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,

    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    brandId: row.brandId,
    sellerId: row.sellerId,

    price: row.price,
    listPrice: row.listPrice,
    currency: 'INR',
    priceUnit: row.priceUnit,
    taxRatePercent: row.taxRatePercent,

    status: row.status,
    availability: {
      state: row.availabilityState,
      quantityOnHand: row.quantityOnHand,
      leadTimeDays: row.leadTimeDays,
      minOrderQuantity: row.minOrderQuantity,
      unit: row.unit,
    },

    images: row.images.map((image) => ({
      url: image.url,
      alt: image.alt,
      width: image.width,
      height: image.height,
      blurDataUrl: image.blurDataUrl,
    })),
    specs: row.specs.map(toSpec),

    applications: row.applications,
    industries: row.industries,
    tags: row.tags,

    documents: row.documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      title: document.title,
      url: document.url,
      sizeKb: document.sizeKb,
      format: document.format,
    })),
    warrantyMonths: row.warrantyMonths,
    certifications: row.certifications,
    relatedProductIds: row.relatedTo.map((relation) => relation.targetId),

    rating:
      row.ratingAverage != null
        ? { average: row.ratingAverage, count: row.ratingCount }
        : null,
    metrics: { views: row.viewCount, rfqs: row.rfqCount, saves: row.saveCount },

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toProductView(row: ProductRow): ProductView {
  return {
    ...toProduct(row),
    category: toCategory(row.category),
    subcategory: row.subcategory ? toCategory(row.subcategory) : null,
    brand: toBrand(row.brand),
    seller: toSeller(row.seller),
  }
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

type UserRow = Prisma.UserGetPayload<object>

/** Domain user — never carries the password hash. */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    company: row.company,
    phone: row.phone,
    city: row.city,
    gstin: row.gstin,
    avatarUrl: row.avatarUrl,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: row.lastActiveAt.toISOString(),
  }
}

/** Repository-only shape. The only place the hash is allowed to travel. */
export function toUserRecord(row: UserRow): UserRecord {
  return { ...toUser(row), passwordHash: row.passwordHash }
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                   */
/* -------------------------------------------------------------------------- */

export function toSavedProduct(row: Prisma.SavedProductGetPayload<object>): SavedProduct {
  return {
    id: row.id,
    userId: row.userId,
    productId: row.productId,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toSavedSearch(row: Prisma.SavedSearchGetPayload<object>): SavedSearch {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    query: row.query,
    intent: (row.intent as SearchIntent | null) ?? null,
    alertsEnabled: row.alertsEnabled,
    lastResultCount: row.lastResultCount,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toSearchEvent(row: Prisma.SearchEventGetPayload<object>): SearchEvent {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    query: row.query,
    mode: row.mode,
    intent: (row.intent as SearchIntent | null) ?? null,
    resultCount: row.resultCount,
    clickedProductIds: row.clickedProductIds,
    convertedToRfq: row.convertedToRfq,
    tookMs: row.tookMs,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toNotification(row: Prisma.NotificationGetPayload<object>): Notification {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }
}

export const rfqInclude = {
  items: true,
  messages: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.RfqInclude

export function toRfq(row: Prisma.RfqGetPayload<{ include: typeof rfqInclude }>): Rfq {
  return {
    id: row.id,
    reference: row.reference,
    userId: row.userId,
    status: row.status,
    contact: {
      name: row.contactName,
      company: row.contactCompany,
      email: row.contactEmail,
      phone: row.contactPhone,
      city: row.contactCity,
      gstin: row.contactGstin,
    },
    items: row.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      note: item.note,
      quotedUnitPrice: item.quotedUnitPrice,
      quotedLeadTimeDays: item.quotedLeadTimeDays,
    })),
    requirements: row.requirements,
    deliveryPincode: row.deliveryPincode,
    requiredByDate: row.requiredByDate?.toISOString() ?? null,
    sourceConversationId: row.sourceConversationId,
    messages: row.messages.map((message) => ({
      id: message.id,
      rfqId: message.rfqId,
      authorId: message.authorId,
      authorRole: message.authorRole,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
    quotedTotal: row.quotedTotal,
    validUntil: row.validUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const conversationInclude = {
  messages: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ConversationInclude

export function toConversation(
  row: Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>
): Conversation {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    messages: row.messages.map(
      (message): AssistantMessage => ({
        id: message.id,
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        ...(message.intent != null && { intent: message.intent as unknown as SearchIntent }),
        ...(message.results != null && {
          results: message.results as unknown as AssistantMessage['results'],
        }),
        ...(message.followUp != null && {
          followUp: message.followUp as unknown as AssistantMessage['followUp'],
        }),
        ...(message.totalMatches != null && { totalMatches: message.totalMatches }),
      })
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/* -------------------------------------------------------------------------- */
/* JSON columns                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Widens a domain object for a Prisma `Json` column.
 *
 * Prisma's `InputJsonValue` requires an index signature, which a TypeScript
 * `interface` never has — so `SearchIntent` and friends are structurally
 * rejected even though they serialise perfectly. Doing the cast once here,
 * with the reason written down, beats an `as never` at nine call sites.
 *
 * Returns `undefined` for null so the column is left at its default rather
 * than being written as JSON `null`, which Prisma treats as a distinct value.
 */
export function toJson<T>(value: T | null | undefined): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined
  return value as unknown as Prisma.InputJsonValue
}
