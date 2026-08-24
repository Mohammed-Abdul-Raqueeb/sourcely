import type { Metadata } from 'next'
import type { Category } from '@/lib/domain/catalog'
import { getCatalogRepository } from '@/server/repositories'
import { platformStats } from '@/server/metrics/platform-stats'
import {
  assistantDemo,
  comparisonDemo,
  discoveryExamples,
  heroScenarios,
} from '@/server/catalog/demo'
import { Hero } from '@/components/home/hero'
import { AssistantSection } from '@/components/home/assistant-section'
import { HowItWorks } from '@/components/home/how-it-works'
import { Discovery } from '@/components/home/discovery'
import { CategoriesSection } from '@/components/home/categories-section'
import { ComparisonSection } from '@/components/home/comparison-section'
import { WhyAi } from '@/components/home/why-ai'
import { FinalCta } from '@/components/home/final-cta'

export const metadata: Metadata = {
  title: 'Find the right industrial product, faster',
  description:
    'Describe what you need in plain language. Sourcely matches it against verified industrial specifications and explains why each product fits.',
}

/**
 * Homepage.
 *
 * Statically generated. Every demonstration on this page is produced by the
 * live search engine at build time — see server/catalog/demo.ts. If ranking
 * quality regresses, this page shows it rather than hiding it behind
 * hand-written fixtures.
 */
export default async function HomePage() {
  const repository = getCatalogRepository()

  const [scenarios, assistant, discovery, comparison, topLevel, allCategories, stats] =
    await Promise.all([
      heroScenarios(),
      assistantDemo(),
      discoveryExamples(),
      comparisonDemo(),
      repository.topLevelCategories(),
      repository.categories(),
      platformStats(),
    ])

  const subcategoriesByParent = allCategories.reduce<Record<string, Category[]>>(
    (accumulator, category) => {
      if (!category.parentId) return accumulator
      const siblings = accumulator[category.parentId] ?? []
      siblings.push(category)
      accumulator[category.parentId] = siblings
      return accumulator
    },
    {}
  )

  return (
    <>
      <Hero scenarios={scenarios} stats={stats} />
      <AssistantSection demo={assistant} />
      <HowItWorks />
      <Discovery examples={discovery} />
      <CategoriesSection categories={topLevel} subcategoriesByParent={subcategoriesByParent} />
      {comparison && <ComparisonSection demo={comparison} />}
      <WhyAi />
      <FinalCta />
    </>
  )
}
