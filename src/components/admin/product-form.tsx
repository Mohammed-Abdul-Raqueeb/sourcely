'use client'

import { useActionState, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Product, ProductImage } from '@/lib/domain/catalog'
import { ImageUpload } from './image-upload'
import { IDLE_FORM_STATE } from '@/lib/validation/auth'
import { saveProductAction } from '@/server/actions/admin'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { ButtonLink } from '@/components/ui/button'
import { FormBanner, SubmitButton } from '@/components/auth/form-shell'
import { SectionCard } from '@/components/account/ui'

/**
 * Product create / edit form.
 *
 * The specification fields are driven by the selected category: choosing
 * "Valves" produces valve fields, choosing "Electrical" produces current and
 * breaking capacity. That is the whole point of the spec registry — the
 * catalogue's shape is data, so this form does not hardcode a single field.
 *
 * The registry is passed in from the server rather than imported, so the
 * admin bundle does not carry the synonym lists the offline parser needs.
 */

export interface SpecFieldOption {
  value: string
  label: string
}

export interface SpecField {
  key: string
  label: string
  dataType: 'enum' | 'text' | 'number' | 'boolean'
  unit?: string
  options?: SpecFieldOption[]
  critical: boolean
  hint?: string
}

export interface TaxonomyOption {
  key: string
  name: string
  /** Present on subcategories. */
  parentKey?: string
}

export interface ProductFormProps {
  product: Product | null
  categories: TaxonomyOption[]
  subcategories: TaxonomyOption[]
  brands: TaxonomyOption[]
  sellers: TaxonomyOption[]
  applications: TaxonomyOption[]
  industries: TaxonomyOption[]
  /** Spec fields keyed by category key. */
  specsByCategory: Record<string, SpecField[]>
  artworkKeys: string[]
  /** Category key the product already has, for the initial render. */
  initialCategoryKey: string
}

const AVAILABILITY_OPTIONS = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'made_to_order', label: 'Made to order' },
  { value: 'out_of_stock', label: 'Out of stock' },
] as const

export function ProductForm({
  product,
  categories,
  subcategories,
  brands,
  sellers,
  applications,
  industries,
  specsByCategory,
  artworkKeys,
  initialCategoryKey,
}: ProductFormProps) {
  const [state, formAction] = useActionState(saveProductAction, IDLE_FORM_STATE)
  const [categoryKey, setCategoryKey] = useState(initialCategoryKey)
  const [availability, setAvailability] = useState(
    product?.availability.state ?? 'in_stock'
  )

  const childOptions = useMemo(
    () => subcategories.filter((entry) => entry.parentKey === categoryKey),
    [subcategories, categoryKey]
  )

  const specFields = specsByCategory[categoryKey] ?? []

  const existingSpec = (key: string): string => {
    const spec = product?.specs.find((entry) => entry.key === key)
    if (!spec) return ''
    if (spec.valueText != null) return spec.valueText
    if (spec.valueNumber != null) return String(spec.valueNumber)
    if (spec.valueBool != null) return spec.valueBool ? 'true' : ''
    return ''
  }

  const currentSubcategory = product
    ? subcategories.find((entry) => entry.key === subcategoryKeyOf(product, subcategories))
    : undefined

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {product && <input type="hidden" name="productId" value={product.id} />}

      <FormBanner state={state} />

      {/* Identity ---------------------------------------------------------- */}
      <SectionCard title="Identity" description="How this product is named and found.">
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field
            label="SKU"
            htmlFor="sku"
            error={state.fieldErrors?.sku}
            hint="Letters, numbers and hyphens"
            required
          >
            <Input
              id="sku"
              name="sku"
              defaultValue={product?.sku ?? ''}
              className="font-mono uppercase"
              maxLength={32}
              required
              invalid={Boolean(state.fieldErrors?.sku)}
              placeholder="VTK-BV2S-050"
            />
          </Field>

          <Field label="Product name" htmlFor="name" error={state.fieldErrors?.name} required>
            <Input
              id="name"
              name="name"
              defaultValue={product?.name ?? ''}
              maxLength={160}
              required
              invalid={Boolean(state.fieldErrors?.name)}
              placeholder="Vantek 2-Piece Ball Valve, SS316, DN50 Threaded"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Short description"
            htmlFor="shortDescription"
            error={state.fieldErrors?.shortDescription}
            hint="One sentence. This is what appears on the product card and in search results."
            required
          >
            <Textarea
              id="shortDescription"
              name="shortDescription"
              rows={2}
              defaultValue={product?.shortDescription ?? ''}
              maxLength={300}
              required
              invalid={Boolean(state.fieldErrors?.shortDescription)}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            label="Full description"
            htmlFor="description"
            error={state.fieldErrors?.description}
            hint="What it is for, how it is built, and what an installer needs to know."
            required
          >
            <Textarea
              id="description"
              name="description"
              rows={7}
              defaultValue={product?.description ?? ''}
              maxLength={4000}
              required
              invalid={Boolean(state.fieldErrors?.description)}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Taxonomy ---------------------------------------------------------- */}
      <SectionCard
        title="Classification"
        description="The category decides which specification fields appear below."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="categoryKey" error={state.fieldErrors?.categoryKey} required>
            <Select
              id="categoryKey"
              name="categoryKey"
              value={categoryKey}
              onChange={(event) => setCategoryKey(event.target.value)}
              required
            >
              {categories.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Subcategory"
            htmlFor="subcategoryKey"
            error={state.fieldErrors?.subcategoryKey}
            required
          >
            <Select
              id="subcategoryKey"
              name="subcategoryKey"
              defaultValue={currentSubcategory?.key ?? childOptions[0]?.key ?? ''}
              key={categoryKey}
              required
            >
              {childOptions.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Brand" htmlFor="brandKey" error={state.fieldErrors?.brandKey} required>
            <Select
              id="brandKey"
              name="brandKey"
              defaultValue={brandKeyOf(product, brands)}
              required
            >
              {brands.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Seller" htmlFor="sellerKey" error={state.fieldErrors?.sellerKey} required>
            <Select
              id="sellerKey"
              name="sellerKey"
              defaultValue={sellerKeyOf(product, sellers)}
              required
            >
              {sellers.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      {/* Specifications ---------------------------------------------------- */}
      <SectionCard
        title="Specifications"
        description={`${specFields.length} fields apply to this category. Critical fields drive the assistant's follow-up questions.`}
      >
        {specFields.length === 0 ? (
          <p className="text-[13px] text-muted">
            No specification fields are registered for this category yet. Add
            them in{' '}
            <code className="font-mono text-[12px] text-text-2">
              src/server/catalog/spec-registry.ts
            </code>
            .
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {specFields.map((field) => (
              <Field
                key={field.key}
                label={
                  field.critical ? `${field.label} *` : field.label
                }
                htmlFor={`spec_${field.key}`}
                hint={field.hint}
              >
                {field.dataType === 'enum' ? (
                  <Select
                    id={`spec_${field.key}`}
                    name={`spec_${field.key}`}
                    defaultValue={existingSpec(field.key)}
                  >
                    <option value="">— not specified —</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : field.dataType === 'number' ? (
                  <Input
                    id={`spec_${field.key}`}
                    name={`spec_${field.key}`}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    defaultValue={existingSpec(field.key)}
                    className="font-mono"
                    placeholder={field.unit ? `value in ${field.unit}` : ''}
                  />
                ) : (
                  <Input
                    id={`spec_${field.key}`}
                    name={`spec_${field.key}`}
                    defaultValue={existingSpec(field.key)}
                    maxLength={120}
                  />
                )}
              </Field>
            ))}
          </div>
        )}

        <p className="mt-4 flex gap-2 border-t border-border pt-4 text-[12px] leading-relaxed text-faint">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          Leaving a critical field blank is allowed, but the product will lose
          to competitors on any search that specifies it — an absent
          specification scores zero, not neutral.
        </p>
      </SectionCard>

      {/* Commercial -------------------------------------------------------- */}
      <SectionCard title="Commercial" description="Pricing, stock and terms.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price (₹)" htmlFor="price" error={state.fieldErrors?.price} required>
            <Input
              id="price"
              name="price"
              type="number"
              min={1}
              defaultValue={product?.price ?? ''}
              className="font-mono"
              required
              invalid={Boolean(state.fieldErrors?.price)}
            />
          </Field>

          <Field
            label="List price (₹)"
            htmlFor="listPrice"
            error={state.fieldErrors?.listPrice}
            hint="Optional — shows a discount badge"
          >
            <Input
              id="listPrice"
              name="listPrice"
              type="number"
              min={0}
              defaultValue={product?.listPrice ?? ''}
              className="font-mono"
              invalid={Boolean(state.fieldErrors?.listPrice)}
            />
          </Field>

          <Field label="GST %" htmlFor="taxRatePercent" error={state.fieldErrors?.taxRatePercent} required>
            <Input
              id="taxRatePercent"
              name="taxRatePercent"
              type="number"
              min={0}
              max={50}
              step="0.5"
              defaultValue={product?.taxRatePercent ?? 18}
              className="font-mono"
              required
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Priced per" htmlFor="priceUnit" error={state.fieldErrors?.priceUnit} required>
            <Input
              id="priceUnit"
              name="priceUnit"
              defaultValue={product?.priceUnit ?? 'per unit'}
              required
            />
          </Field>

          <Field label="Sold in" htmlFor="unit" error={state.fieldErrors?.unit} required>
            <Input id="unit" name="unit" defaultValue={product?.availability.unit ?? 'unit'} required />
          </Field>

          <Field
            label="Minimum order"
            htmlFor="minOrderQuantity"
            error={state.fieldErrors?.minOrderQuantity}
            required
          >
            <Input
              id="minOrderQuantity"
              name="minOrderQuantity"
              type="number"
              min={1}
              defaultValue={product?.availability.minOrderQuantity ?? 1}
              className="font-mono"
              required
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Availability" htmlFor="availabilityState" required>
            <Select
              id="availabilityState"
              name="availabilityState"
              value={availability}
              onChange={(event) =>
                setAvailability(event.target.value as typeof availability)
              }
              required
            >
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Quantity on hand"
            htmlFor="quantityOnHand"
            hint={availability === 'made_to_order' ? 'Not applicable — made to order' : undefined}
          >
            <Input
              id="quantityOnHand"
              name="quantityOnHand"
              type="number"
              min={0}
              disabled={availability === 'made_to_order'}
              defaultValue={product?.availability.quantityOnHand ?? 0}
              className="font-mono"
            />
          </Field>

          <Field label="Lead time (days)" htmlFor="leadTimeDays">
            <Input
              id="leadTimeDays"
              name="leadTimeDays"
              type="number"
              min={0}
              max={365}
              defaultValue={product?.availability.leadTimeDays ?? 1}
              className="font-mono"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Warranty (months)" htmlFor="warrantyMonths">
            <Input
              id="warrantyMonths"
              name="warrantyMonths"
              type="number"
              min={0}
              max={600}
              defaultValue={product?.warrantyMonths ?? 12}
              className="font-mono"
            />
          </Field>

          <Field
            label="Certifications"
            htmlFor="certifications"
            hint="Comma separated — IS 554, CE, API 607"
          >
            <Input
              id="certifications"
              name="certifications"
              defaultValue={product?.certifications.join(', ') ?? ''}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Discovery ---------------------------------------------------------- */}
      <SectionCard
        title="Discovery"
        description="How the assistant and the catalogue find this product."
      >
        <Field
          label="Tags"
          htmlFor="tags"
          hint="Comma separated. Trade terms buyers actually type — these feed keyword retrieval."
        >
          <Input id="tags" name="tags" defaultValue={product?.tags.join(', ') ?? ''} />
        </Field>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-text-2">Applications</legend>
            <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-border bg-surface-2 p-2 scrollbar-slim">
              {applications.map((entry) => (
                <label
                  key={entry.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] text-text-2 hover:bg-surface-3"
                >
                  <input
                    type="checkbox"
                    name="applications"
                    value={entry.key}
                    defaultChecked={product?.applications.includes(entry.key)}
                    className="size-3.5 cursor-pointer appearance-none rounded-xs border border-border-strong bg-surface checked:border-accent checked:bg-accent"
                  />
                  {entry.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-text-2">Industries</legend>
            <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-border bg-surface-2 p-2 scrollbar-slim">
              {industries.map((entry) => (
                <label
                  key={entry.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] text-text-2 hover:bg-surface-3"
                >
                  <input
                    type="checkbox"
                    name="industries"
                    value={entry.key}
                    defaultChecked={product?.industries.includes(entry.key)}
                    className="size-3.5 cursor-pointer appearance-none rounded-xs border border-border-strong bg-surface checked:border-accent checked:bg-accent"
                  />
                  {entry.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-4">
          <Field
            label="Photography"
            htmlFor="images"
            hint="Optional. Replaces the technical drawing wherever the product appears."
          >
            <ImageUpload name="images" initial={uploadedImagesOf(product)} />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Artwork"
            htmlFor="artwork"
            hint="Technical drawing used when there is no photography"
          >
            <Select
              id="artwork"
              name="artwork"
              defaultValue={artworkOf(product) ?? artworkKeys[0] ?? 'ball-valve'}
            >
              {artworkKeys.map((key) => (
                <option key={key} value={key}>
                  {key.replace(/-/g, ' ')}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="status" required>
            <Select id="status" name="status" defaultValue={product?.status ?? 'draft'} required>
              <option value="draft">Draft — not visible to buyers</option>
              <option value="active">Active — live in the catalogue</option>
              <option value="archived">Archived — removed from the catalogue</option>
            </Select>
          </Field>
        </div>
      </SectionCard>

      {/* Actions ------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] leading-relaxed text-faint">
          Saving rebuilds the search index and revalidates the public pages this
          product appears on.
        </p>
        <div className="flex shrink-0 gap-2">
          <ButtonLink href="/admin/products" variant="secondary">
            Cancel
          </ButtonLink>
          <div className="w-44">
            <SubmitButton loadingLabel="Saving…">
              {product ? 'Save changes' : 'Create product'}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */

function subcategoryKeyOf(product: Product, subcategories: TaxonomyOption[]): string {
  const match = subcategories.find(
    (entry) => `cat_${entry.key}` === product.subcategoryId
  )
  return match?.key ?? ''
}

function brandKeyOf(product: Product | null, brands: TaxonomyOption[]): string {
  if (!product) return brands[0]?.key ?? ''
  return brands.find((entry) => `brand_${entry.key}` === product.brandId)?.key ?? brands[0]?.key ?? ''
}

function sellerKeyOf(product: Product | null, sellers: TaxonomyOption[]): string {
  if (!product) return sellers[0]?.key ?? ''
  return (
    sellers.find((entry) => `seller_${entry.key}` === product.sellerId)?.key ??
    sellers[0]?.key ??
    ''
  )
}

/** Recovers the artwork key from the stored `artwork:<key>:<view>:<seed>` URL. */
function artworkOf(product: Product | null): string | null {
  const url = product?.images.find((image) => image.url.startsWith('artwork:'))?.url
  if (!url) return null
  return url.split(':')[1] ?? null
}

/**
 * The uploaded photography, as distinct from the generated drawings.
 *
 * Both live in the same `images` array; the `artwork:` prefix is what tells
 * them apart, and only real files belong in the upload control.
 */
function uploadedImagesOf(product: Product | null): ProductImage[] {
  return product?.images.filter((image) => !image.url.startsWith('artwork:')) ?? []
}
