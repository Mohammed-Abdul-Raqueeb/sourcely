import type { Metadata } from 'next'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { highlightSpecs } from '@/server/catalog/highlights'
import { pluralize } from '@/lib/format'
import { ProductCard } from '@/components/catalog/product-card'
import { StateBlock } from '@/components/ui/states'
import { PageHeader } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Recently viewed' }

export default async function RecentPage() {
  const user = await requireUser('/account/recent')

  const ids = await getActivityRepository().recentlyViewed(user.id, 24)
  const products = await getCatalogRepository().findManyByIds(ids)

  return (
    <>
      <PageHeader
        title="Recently viewed"
        description={
          products.length > 0
            ? `The last ${pluralize(products.length, 'product')} you opened, newest first.`
            : 'Products you open appear here so you can find your way back to them.'
        }
      />

      {products.length === 0 ? (
        <StateBlock
          title="Nothing viewed yet"
          description="Open a product and it will be waiting here next time. Nothing is shared with suppliers."
          primaryAction={{ label: 'Browse products', href: '/products' }}
          secondaryAction={{ label: 'Ask the assistant', href: '/assistant' }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} highlights={highlightSpecs(product, 3)} />
          ))}
        </div>
      )}
    </>
  )
}
