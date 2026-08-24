'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Minus, Plus, X } from 'lucide-react'
import type { ProductView } from '@/lib/domain/catalog'
import { IDLE_FORM_STATE } from '@/lib/validation/auth'
import { formatPrice, pluralize } from '@/lib/format'
import { createRfqAction } from '@/server/actions/rfq'
import { Field, Input, Textarea } from '@/components/ui/input'
import { IconButton } from '@/components/ui/button'
import { FormBanner, SubmitButton } from '@/components/auth/form-shell'
import { SectionCard } from './ui'

/**
 * Quotation request form.
 *
 * Quantities default to each product's minimum order rather than 1, because a
 * request below MOQ is one the supplier has to bounce, and bouncing it costs
 * the buyer a day. Lines can be removed here so a shortlist does not have to
 * be pruned first.
 */

interface Line {
  product: ProductView
  quantity: number
}

export function RfqForm({
  products,
  defaults,
}: {
  products: ProductView[]
  defaults: {
    name: string
    company: string
    email: string
    phone: string
    city: string
    gstin: string
  }
}) {
  const [state, formAction] = useActionState(createRfqAction, IDLE_FORM_STATE)

  const [lines, setLines] = useState<Line[]>(() =>
    products.map((product) => ({
      product,
      quantity: product.availability.minOrderQuantity,
    }))
  )

  function setQuantity(productId: string, next: number) {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId
          ? {
              ...line,
              quantity: Math.max(line.product.availability.minOrderQuantity, next),
            }
          : line
      )
    )
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.product.id !== productId))
  }

  const indicative = lines.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0
  )

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormBanner state={state} />

      {/* Lines -------------------------------------------------------------- */}
      <SectionCard
        title="What you need"
        description={`${pluralize(lines.length, 'line')} · ${formatPrice(indicative)} at list rates`}
        padded={lines.length === 0}
      >
        {lines.length === 0 ? (
          <p className="text-[13px] text-muted">
            No products selected.{' '}
            <Link href="/account/saved" className="text-accent-text hover:underline">
              Pick from your shortlist
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lines.map(({ product, quantity }) => (
              <li key={product.id} className="px-5 py-4">
                <input type="hidden" name="productId" value={product.id} />
                <input type="hidden" name={`quantity:${product.id}`} value={quantity} />

                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${product.slug}`}
                      className="text-[14px] font-medium text-text hover:text-accent-text"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-faint tnum">
                      {product.sku} · {product.brand.name} · {formatPrice(product.price)}{' '}
                      {product.priceUnit}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconButton
                      label={`Decrease quantity of ${product.name}`}
                      size="xs"
                      variant="secondary"
                      onClick={() => setQuantity(product.id, quantity - 1)}
                      disabled={quantity <= product.availability.minOrderQuantity}
                    >
                      <Minus className="size-3" aria-hidden />
                    </IconButton>

                    <input
                      type="number"
                      aria-label={`Quantity of ${product.name}`}
                      value={quantity}
                      min={product.availability.minOrderQuantity}
                      onChange={(event) =>
                        setQuantity(product.id, Number.parseInt(event.target.value, 10) || 1)
                      }
                      className="h-8 w-16 rounded-md border border-border bg-surface-2 text-center font-mono text-[13px] text-text tnum focus:border-accent focus:outline-none"
                    />

                    <IconButton
                      label={`Increase quantity of ${product.name}`}
                      size="xs"
                      variant="secondary"
                      onClick={() => setQuantity(product.id, quantity + 1)}
                    >
                      <Plus className="size-3" aria-hidden />
                    </IconButton>

                    <IconButton
                      label={`Remove ${product.name}`}
                      size="xs"
                      onClick={() => removeLine(product.id)}
                      className="hover:text-danger"
                    >
                      <X className="size-3.5" aria-hidden />
                    </IconButton>
                  </div>
                </div>

                <input
                  type="text"
                  name={`note:${product.id}`}
                  placeholder="Line note — size alternatives, finish, anything the supplier should know"
                  maxLength={300}
                  className="mt-2.5 h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
                />

                {product.availability.minOrderQuantity > 1 && (
                  <p className="mt-1.5 text-[11px] text-faint">
                    Minimum order {product.availability.minOrderQuantity}{' '}
                    {product.availability.unit}s
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Requirements -------------------------------------------------------- */}
      <SectionCard title="Requirements">
        <Field
          htmlFor="requirements"
          error={state.fieldErrors?.requirements}
          hint="Where it is going, what it connects to, any standards you have to satisfy."
          required
        >
          <Textarea
            id="requirements"
            name="requirements"
            rows={4}
            required
            invalid={Boolean(state.fieldErrors?.requirements)}
            placeholder="Chilled water risers for a 9-storey commercial block. Delivery in two tranches. Test certificates required with despatch."
          />
        </Field>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Delivery pincode" htmlFor="pincode" error={state.fieldErrors?.pincode}>
            <Input
              id="pincode"
              name="pincode"
              inputMode="numeric"
              maxLength={6}
              className="font-mono"
              placeholder="500032"
            />
          </Field>

          <Field label="Required by" htmlFor="requiredBy" error={state.fieldErrors?.requiredBy}>
            <Input id="requiredBy" name="requiredBy" type="date" />
          </Field>
        </div>
      </SectionCard>

      {/* Contact ------------------------------------------------------------- */}
      <SectionCard
        title="Contact"
        description="Pre-filled from your profile. Suppliers see only this."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="rfq-name" error={state.fieldErrors?.name} required>
            <Input id="rfq-name" name="name" defaultValue={defaults.name} required />
          </Field>

          <Field label="Company" htmlFor="rfq-company" error={state.fieldErrors?.company} required>
            <Input id="rfq-company" name="company" defaultValue={defaults.company} required />
          </Field>

          <Field label="Email" htmlFor="rfq-email" error={state.fieldErrors?.email} required>
            <Input
              id="rfq-email"
              name="email"
              type="email"
              defaultValue={defaults.email}
              required
            />
          </Field>

          <Field label="Phone" htmlFor="rfq-phone" error={state.fieldErrors?.phone}>
            <Input id="rfq-phone" name="phone" type="tel" defaultValue={defaults.phone} />
          </Field>

          <Field label="City" htmlFor="rfq-city" error={state.fieldErrors?.city} required>
            <Input id="rfq-city" name="city" defaultValue={defaults.city} required />
          </Field>

          <Field label="GSTIN" htmlFor="rfq-gstin" error={state.fieldErrors?.gstin}>
            <Input
              id="rfq-gstin"
              name="gstin"
              defaultValue={defaults.gstin}
              className="font-mono uppercase"
              maxLength={15}
            />
          </Field>
        </div>
      </SectionCard>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] leading-relaxed text-faint">
          Nothing is shared until you send this. Prices above are list rates —
          the supplier quotes against your quantities.
        </p>
        <div className="shrink-0 sm:w-56">
          <SubmitButton loadingLabel="Sending…">Send quotation request</SubmitButton>
        </div>
      </div>
    </form>
  )
}
