import type { Metadata } from 'next'
import { Columns3 } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { highlightSpecs } from '@/server/catalog/highlights'
import { ButtonLink } from '@/components/ui/button'
import { ProductCard } from '@/components/catalog/product-card'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, SectionCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Comparisons' }

/**
 * Comparisons.
 *
 * The active comparison set lives in the browser, not the account — it is a
 * scratchpad, and syncing a scratchpad across devices creates more surprise
 * than value. What this page offers instead is the shortlist as a starting
 * point, since that is where a comparison actually begins.
 */
export default async function ComparisonsPage() {
  const user = await requireUser('/account/comparisons')

  const saved = await getActivityRepository().listSavedProducts(user.id)
  const products = await getCatalogRepository().findManyByIds(
    saved.slice(0, 6).map((entry) => entry.productId)
  )

  return (
    <>
      <PageHeader
        title="Comparisons"
        description="Pick two to four products and their specification sheets line up side by side, with a written summary of where they actually differ."
        action={
          products.length >= 2 && (
            <ButtonLink
              href={`/compare?ids=${products.slice(0, 4).map((p) => p.id).join(',')}`}
              leadingIcon={<Columns3 className="size-4" aria-hidden />}
            >
              Compare shortlist
            </ButtonLink>
          )
        }
      />

      {products.length === 0 ? (
        <StateBlock
          title="Nothing to compare yet"
          description="Save two or more products and you can line their specifications up here."
          primaryAction={{ label: 'Browse products', href: '/products' }}
          secondaryAction={{ label: 'Ask the assistant', href: '/assistant' }}
        />
      ) : (
        <SectionCard
          title="From your shortlist"
          description="Select up to four using the compare control on each card."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                highlights={highlightSpecs(product, 2)}
                dense
              />
            ))}
          </div>
        </SectionCard>
      )}
    </>
  )
}
