import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/server/auth/session'
import { notFound } from 'next/navigation'
import { getAccountRepository, getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { StateBlock } from '@/components/ui/states'
import { PageHeader } from '@/components/account/ui'
import { RfqForm } from '@/components/account/rfq-form'

export const metadata: Metadata = { title: 'New quotation request' }

/**
 * New quotation request.
 *
 * Products come from `?product=` (one or several comma-separated ids). With no
 * parameter it falls back to the buyer's whole shortlist, which is the common
 * case — the shortlist is what a quotation request is built out of.
 */
export default async function NewRfqPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const [{ product }, session] = await Promise.all([searchParams, getSession()])
  if (!session) notFound()

  const catalog = getCatalogRepository()
  const activity = getActivityRepository()

  const requested = product
    ? product.split(',').map((id) => id.trim()).filter(Boolean)
    : (await activity.listSavedProducts(session.user.id)).map((entry) => entry.productId)

  const products = await catalog.findManyByIds(requested.slice(0, 20))
  const record = await getAccountRepository().findUserById(session.user.id)

  return (
    <>
      <Link
        href="/account/rfq"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All quotations
      </Link>

      <PageHeader
        title="Request a quotation"
        description="One request can cover several products. The supplier quotes against your quantities, not list rates."
      />

      {products.length === 0 ? (
        <StateBlock
          title="No products selected"
          description="Shortlist what you need first, or open a product and use its Request quotation button."
          primaryAction={{ label: 'Browse products', href: '/products' }}
          secondaryAction={{ label: 'Your shortlist', href: '/account/saved' }}
        />
      ) : (
        <RfqForm
          products={products}
          defaults={{
            name: record?.name ?? session.user.name,
            company: record?.company ?? '',
            email: record?.email ?? session.user.email,
            phone: record?.phone ?? '',
            city: record?.city ?? '',
            gstin: record?.gstin ?? '',
          }}
        />
      )}
    </>
  )
}
