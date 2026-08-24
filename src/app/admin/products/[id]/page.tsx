import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getCatalogRepository, getAdminRepository } from '@/server/repositories'
import { buildProductFormOptions } from '@/server/admin/form-options'
import { formatDateTime, pluralize } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { PageHeader } from '@/components/account/ui'
import { ProductForm } from '@/components/admin/product-form'
import { CATEGORY_BY_ID } from '@/server/seed/taxonomy'

export const metadata: Metadata = { title: 'Edit product' }

/**
 * Product editor.
 *
 * Reads through `findAnyById`, which includes archived records — the public
 * getters filter those out, and an archived product still has to be openable
 * and restorable.
 */
export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams])
  await requireRole('staff', `/admin/products/${id}`)

  const catalog = getCatalogRepository()
  const product = await catalog.findAnyById(id)
  if (!product) notFound()

  const savedCount = await getAdminRepository().countSavedForProduct(product.id)
  const options = buildProductFormOptions()
  const categoryKey = CATEGORY_BY_ID.get(product.categoryId)?.key ?? options.categories[0]?.key ?? 'valves'

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All products
      </Link>

      {saved && (
        <div
          role="status"
          className="mb-5 flex items-center gap-2.5 rounded-lg border border-success/25 bg-success-soft px-4 py-3"
        >
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          <p className="text-[13px] text-text-2">
            Saved. The search index has been rebuilt and the public pages revalidated.
          </p>
        </div>
      )}

      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-[12px] tnum">{product.sku}</span>
            <span>Updated {formatDateTime(product.updatedAt)}</span>
            <span>{pluralize(savedCount, 'buyer')} shortlisted this</span>
          </span>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                product.status === 'active'
                  ? 'success'
                  : product.status === 'draft'
                    ? 'warning'
                    : 'neutral'
              }
              size="md"
              dot
            >
              {product.status}
            </Badge>
            {product.status === 'active' && (
              <ButtonLink
                href={`/products/${product.slug}`}
                variant="secondary"
                size="sm"
                trailingIcon={<ExternalLink className="size-3.5" aria-hidden />}
              >
                View live
              </ButtonLink>
            )}
          </div>
        }
      />

      <ProductForm product={product} initialCategoryKey={categoryKey} {...options} />
    </>
  )
}
