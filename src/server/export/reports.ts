import 'server-only'
import type { Rfq, SearchEvent, User } from '@/lib/domain/account'
import type { Brand, Category, Product, Seller } from '@/lib/domain/catalog'
import { RFQ_STATUS_LABELS } from '@/lib/domain/account'
import { specEnumLabel } from '@/server/catalog/spec-registry'
import { toCsv, type CsvColumn } from './csv'

/**
 * Column definitions for each export.
 *
 * Kept apart from the route handler so the shape of an export is reviewable in
 * one place, and so the same definitions can be exercised by tests without
 * standing up a request.
 *
 * Every export is a flat table. A nested structure — line items inside a
 * quotation — is expanded into one row per line with the header fields
 * repeated, because that is the shape a pivot table can consume and the shape
 * every finance team already works in.
 */

export const EXPORT_KINDS = ['products', 'quotations', 'searches', 'customers'] as const
export type ExportKind = (typeof EXPORT_KINDS)[number]

export function isExportKind(value: string): value is ExportKind {
  return (EXPORT_KINDS as readonly string[]).includes(value)
}

export const EXPORT_LABELS: Record<ExportKind, string> = {
  products: 'Catalogue',
  quotations: 'Quotations',
  searches: 'Search events',
  customers: 'Customers',
}

export const EXPORT_DESCRIPTIONS: Record<ExportKind, string> = {
  products: 'Every product with pricing, stock, taxonomy and specifications.',
  quotations: 'One row per quotation line, with contact and status.',
  searches: 'Every search with its result count — the zero-result source data.',
  customers: 'Registered accounts. No password material of any kind.',
}

/* -------------------------------------------------------------------------- */

/**
 * A product joined to its taxonomy names.
 *
 * The export runs over `listAll()`, which returns bare `Product` records —
 * archived ones included, which a reconciliation export must have. So the
 * names are resolved here rather than relying on the joined `ProductView` the
 * public catalogue uses.
 */
interface ProductRow {
  product: Product
  category: string
  subcategory: string
  brand: string
  seller: string
  sellerCity: string
}

const productColumns: CsvColumn<ProductRow>[] = [
  { header: 'SKU', value: (r) => r.product.sku },
  { header: 'Name', value: (r) => r.product.name },
  { header: 'Status', value: (r) => r.product.status },
  { header: 'Category', value: (r) => r.category },
  { header: 'Subcategory', value: (r) => r.subcategory },
  { header: 'Brand', value: (r) => r.brand },
  { header: 'Supplier', value: (r) => r.seller },
  { header: 'Supplier city', value: (r) => r.sellerCity },
  // Unformatted: a spreadsheet needs a number, not "₹3,240".
  { header: 'Price (INR)', value: (r) => r.product.price },
  { header: 'List price (INR)', value: (r) => r.product.listPrice ?? '' },
  { header: 'Price unit', value: (r) => r.product.priceUnit },
  { header: 'GST %', value: (r) => r.product.taxRatePercent },
  { header: 'Availability', value: (r) => r.product.availability.state },
  { header: 'Qty on hand', value: (r) => r.product.availability.quantityOnHand },
  { header: 'Lead time (days)', value: (r) => r.product.availability.leadTimeDays },
  { header: 'MOQ', value: (r) => r.product.availability.minOrderQuantity },
  { header: 'Warranty (months)', value: (r) => r.product.warrantyMonths ?? '' },
  { header: 'Certifications', value: (r) => r.product.certifications.join('; ') },
  {
    header: 'Specifications',
    value: (r) => r.product.specs.map((spec) => `${spec.key}=${spec.displayValue}`).join('; '),
  },
  {
    header: 'Applications',
    value: (r) => r.product.applications.map((key) => specEnumLabel('application', key)).join('; '),
  },
  { header: 'Views', value: (r) => r.product.metrics.views },
  { header: 'RFQs', value: (r) => r.product.metrics.rfqs },
  { header: 'Saves', value: (r) => r.product.metrics.saves },
  { header: 'Created', value: (r) => r.product.createdAt },
  { header: 'Updated', value: (r) => r.product.updatedAt },
]

/** One row per line item, with the quotation's own fields repeated. */
interface QuotationRow {
  rfq: Rfq
  item: Rfq['items'][number]
  productName: string
}

const quotationColumns: CsvColumn<QuotationRow>[] = [
  { header: 'Reference', value: (r) => r.rfq.reference },
  { header: 'Status', value: (r) => RFQ_STATUS_LABELS[r.rfq.status] },
  { header: 'Raised', value: (r) => r.rfq.createdAt },
  { header: 'Updated', value: (r) => r.rfq.updatedAt },
  { header: 'Contact', value: (r) => r.rfq.contact.name },
  { header: 'Company', value: (r) => r.rfq.contact.company },
  { header: 'Email', value: (r) => r.rfq.contact.email },
  { header: 'Phone', value: (r) => r.rfq.contact.phone },
  { header: 'City', value: (r) => r.rfq.contact.city },
  { header: 'GSTIN', value: (r) => r.rfq.contact.gstin ?? '' },
  { header: 'Delivery pincode', value: (r) => r.rfq.deliveryPincode ?? '' },
  { header: 'Required by', value: (r) => r.rfq.requiredByDate ?? '' },
  { header: 'Product', value: (r) => r.productName },
  { header: 'Quantity', value: (r) => r.item.quantity },
  { header: 'Quoted unit price (INR)', value: (r) => r.item.quotedUnitPrice ?? '' },
  { header: 'Quoted lead time (days)', value: (r) => r.item.quotedLeadTimeDays ?? '' },
  {
    header: 'Line total (INR)',
    value: (r) =>
      r.item.quotedUnitPrice != null ? r.item.quotedUnitPrice * r.item.quantity : '',
  },
  { header: 'Quotation total (INR)', value: (r) => r.rfq.quotedTotal ?? '' },
  { header: 'Valid until', value: (r) => r.rfq.validUntil ?? '' },
  { header: 'Line note', value: (r) => r.item.note ?? '' },
]

const searchColumns: CsvColumn<SearchEvent>[] = [
  { header: 'When', value: (e) => e.createdAt },
  { header: 'Query', value: (e) => e.query },
  { header: 'Mode', value: (e) => e.mode },
  { header: 'Results', value: (e) => e.resultCount },
  // The reason this export exists: filter to TRUE to get the demand the
  // catalogue could not answer.
  { header: 'Zero result', value: (e) => (e.resultCount === 0 ? 'TRUE' : 'FALSE') },
  { header: 'Clicked', value: (e) => e.clickedProductIds.length },
  { header: 'Became a quotation', value: (e) => (e.convertedToRfq ? 'TRUE' : 'FALSE') },
  { header: 'Took (ms)', value: (e) => e.tookMs },
  { header: 'Signed in', value: (e) => (e.userId ? 'TRUE' : 'FALSE') },
]

/**
 * Customer export.
 *
 * `User` carries no password hash — the repository strips it before returning
 * — so there is nothing sensitive to omit here beyond what is already absent.
 * The type does the enforcing rather than a column list someone has to
 * remember to keep in step.
 */
const customerColumns: CsvColumn<User>[] = [
  { header: 'Name', value: (u) => u.name },
  { header: 'Email', value: (u) => u.email },
  { header: 'Role', value: (u) => u.role },
  { header: 'Company', value: (u) => u.company ?? '' },
  { header: 'Phone', value: (u) => u.phone ?? '' },
  { header: 'City', value: (u) => u.city ?? '' },
  { header: 'GSTIN', value: (u) => u.gstin ?? '' },
  { header: 'Email verified', value: (u) => (u.emailVerified ? 'TRUE' : 'FALSE') },
  { header: 'Registered', value: (u) => u.createdAt },
]

/* -------------------------------------------------------------------------- */

export function productsCsv(
  products: readonly Product[],
  taxonomy: { categories: Category[]; brands: Brand[]; sellers: Seller[] }
): string {
  const categoryById = new Map(taxonomy.categories.map((entry) => [entry.id, entry.name]))
  const brandById = new Map(taxonomy.brands.map((entry) => [entry.id, entry.name]))
  const sellerById = new Map(taxonomy.sellers.map((entry) => [entry.id, entry]))

  const rows: ProductRow[] = products.map((product) => {
    const seller = sellerById.get(product.sellerId)
    return {
      product,
      // An unresolved id is written through rather than blanked — a blank cell
      // hides a data fault, an id in a name column announces one.
      category: categoryById.get(product.categoryId) ?? product.categoryId,
      subcategory: product.subcategoryId
        ? (categoryById.get(product.subcategoryId) ?? product.subcategoryId)
        : '',
      brand: brandById.get(product.brandId) ?? product.brandId,
      seller: seller?.name ?? product.sellerId,
      sellerCity: seller?.city ?? '',
    }
  })

  return toCsv(rows, productColumns)
}

export function quotationsCsv(rfqs: readonly Rfq[], productNames: Map<string, string>): string {
  const rows = rfqs.flatMap((rfq) =>
    rfq.items.map((item) => ({
      rfq,
      item,
      productName: productNames.get(item.productId) ?? item.productId,
    }))
  )
  return toCsv(rows, quotationColumns)
}

export function searchesCsv(events: readonly SearchEvent[]): string {
  return toCsv(events, searchColumns)
}

export function customersCsv(users: readonly User[]): string {
  return toCsv(users, customerColumns)
}
