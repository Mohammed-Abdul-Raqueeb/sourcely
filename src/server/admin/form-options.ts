import 'server-only'
import type { SpecField, TaxonomyOption } from '@/components/admin/product-form'
import {
  APPLICATIONS,
  INDUSTRIES,
  specsForCategory,
} from '@/server/catalog/spec-registry'
import { CATEGORIES, BRANDS, SELLERS, TOP_LEVEL_CATEGORIES } from '@/server/seed/taxonomy'

/**
 * Serialises the taxonomy and spec registry for the product form.
 *
 * The form needs this data on the client, but importing `spec-registry`
 * directly would ship every synonym list to the browser — that table exists
 * for the offline parser and is by far the largest part of the module. This
 * projects out only what a form field needs: key, label, type, unit, enum
 * options.
 */

export const ARTWORK_KEYS = [
  'ball-valve',
  'butterfly-valve',
  'gate-valve',
  'check-valve',
  'strainer',
  'control-valve',
  'pump',
  'pump-submersible',
  'pump-dosing',
  'booster-set',
  'ahu',
  'fcu',
  'fan',
  'filter',
  'breaker',
  'breaker-mcb',
  'contactor',
  'distribution-board',
  'cable-tray',
  'sprinkler',
  'hydrant',
  'hose',
  'flow-switch',
  'gauge',
  'thermometer',
  'transmitter',
  'flow-meter',
  'pipe',
  'insulation',
  'clamp',
  'compressor',
  'motor',
  'vfd',
  'hoist',
  'torque-wrench',
  'wrench',
  'clamp-meter',
  'gloves',
  'helmet',
  'goggles',
  'harness',
] as const

export interface ProductFormOptions {
  categories: TaxonomyOption[]
  subcategories: TaxonomyOption[]
  brands: TaxonomyOption[]
  sellers: TaxonomyOption[]
  applications: TaxonomyOption[]
  industries: TaxonomyOption[]
  specsByCategory: Record<string, SpecField[]>
  artworkKeys: string[]
}

export function buildProductFormOptions(): ProductFormOptions {
  const categories: TaxonomyOption[] = TOP_LEVEL_CATEGORIES.map((category) => ({
    key: category.key,
    name: category.name,
  }))

  const parentKeyById = new Map(TOP_LEVEL_CATEGORIES.map((c) => [c.id, c.key]))

  const subcategories: TaxonomyOption[] = CATEGORIES.filter(
    (category) => category.parentId !== null
  ).map((category) => ({
    key: category.key,
    name: category.name,
    parentKey: category.parentId ? (parentKeyById.get(category.parentId) ?? '') : '',
  }))

  const specsByCategory: Record<string, SpecField[]> = {}
  for (const category of TOP_LEVEL_CATEGORIES) {
    specsByCategory[category.key] = specsForCategory(category.key).map((definition) => ({
      key: definition.key,
      label: definition.label,
      dataType: definition.dataType,
      unit: definition.unit,
      critical: definition.isCritical,
      hint: definition.hint,
      options: definition.enumValues?.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    }))
  }

  return {
    categories,
    subcategories,
    brands: BRANDS.map((brand) => ({ key: brand.key, name: brand.name })),
    sellers: SELLERS.map((seller) => ({ key: seller.key, name: `${seller.name} — ${seller.city}` })),
    applications: APPLICATIONS.map((entry) => ({ key: entry.key, name: entry.label })),
    industries: INDUSTRIES.map((entry) => ({ key: entry.key, name: entry.label })),
    specsByCategory,
    artworkKeys: [...ARTWORK_KEYS],
  }
}
