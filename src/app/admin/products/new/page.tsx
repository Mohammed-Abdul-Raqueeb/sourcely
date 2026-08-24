import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { buildProductFormOptions } from '@/server/admin/form-options'
import { PageHeader } from '@/components/account/ui'
import { ProductForm } from '@/components/admin/product-form'

export const metadata: Metadata = { title: 'Add product' }

export default async function NewProductPage() {
  await requireRole('staff', '/admin/products/new')
  const options = buildProductFormOptions()

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All products
      </Link>

      <PageHeader
        title="Add a product"
        description="The category you pick decides which specification fields appear — that is the spec registry driving the form, not a hardcoded template."
      />

      <ProductForm
        product={null}
        initialCategoryKey={options.categories[0]?.key ?? 'valves'}
        {...options}
      />
    </>
  )
}
