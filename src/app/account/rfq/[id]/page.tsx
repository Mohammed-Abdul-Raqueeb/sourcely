import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, CalendarClock, MapPin, MessageSquare } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { RFQ_STATUS_LABELS, RFQ_STATUSES } from '@/lib/domain/account'
import {
  formatDate,
  formatDateTime,
  formatPrice,
  formatPricePrecise,
  pluralize,
  RFQ_TONE,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { SectionCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Quotation' }

/** Statuses shown on the progress rail, in order. Terminal states are separate. */
const PIPELINE = ['submitted', 'under_review', 'quoted', 'accepted'] as const

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser(`/account/rfq/${id}`)

  const rfq = await getActivityRepository().findRfq(user.id, id)
  if (!rfq) notFound()

  const catalog = getCatalogRepository()
  const products = await catalog.findManyByIds(rfq.items.map((item) => item.productId))
  const byId = new Map(products.map((product) => [product.id, product]))

  const lines = rfq.items.map((item) => ({
    item,
    product: byId.get(item.productId) ?? null,
  }))

  const listTotal = lines.reduce(
    (sum, line) => sum + (line.product?.price ?? 0) * line.item.quantity,
    0
  )
  const quotedTotal = rfq.items.reduce(
    (sum, item) => sum + (item.quotedUnitPrice ?? 0) * item.quantity,
    0
  )
  const hasQuote = rfq.items.some((item) => item.quotedUnitPrice != null)
  const saving = hasQuote && listTotal > quotedTotal ? listTotal - quotedTotal : 0

  const currentStage = PIPELINE.indexOf(rfq.status as (typeof PIPELINE)[number])
  const terminal = ['declined', 'expired'].includes(rfq.status)

  return (
    <>
      <Link
        href="/account/rfq"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All quotations
      </Link>

      {/* Header ------------------------------------------------------------ */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-text tnum">
            {rfq.reference}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Raised {formatDate(rfq.createdAt)} · {pluralize(rfq.items.length, 'line')}
            {rfq.requiredByDate && ` · required by ${formatDate(rfq.requiredByDate)}`}
          </p>
        </div>

        <Badge tone={RFQ_TONE[rfq.status]} size="md" dot>
          {RFQ_STATUS_LABELS[rfq.status]}
        </Badge>
      </div>

      {/* Progress rail ----------------------------------------------------- */}
      {!terminal && (
        <ol className="mb-6 flex items-center gap-1 rounded-xl border border-border bg-surface p-1.5">
          {PIPELINE.map((stage, index) => {
            const done = currentStage >= index
            const active = currentStage === index
            return (
              <li key={stage} className="flex-1">
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 text-center text-[12px] font-medium transition-colors',
                    active
                      ? 'bg-accent-soft text-accent-text'
                      : done
                        ? 'text-success'
                        : 'text-faint'
                  )}
                >
                  <span
                    className={cn(
                      'mx-auto mb-1.5 block h-0.5 w-full rounded-full',
                      done ? 'bg-accent' : 'bg-border'
                    )}
                    aria-hidden
                  />
                  {RFQ_STATUS_LABELS[stage]}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Lines --------------------------------------------------------- */}
          <SectionCard
            title="Requested lines"
            description={hasQuote ? 'Supplier rates shown against your quantities.' : undefined}
            padded={false}
          >
            <div className="overflow-x-auto scrollbar-slim">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                    <th scope="col" className="px-5 py-3 font-semibold">Product</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Qty</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">List</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Quoted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map(({ item, product }) => (
                    <tr key={item.productId}>
                      <td className="px-5 py-3">
                        {product ? (
                          <Link
                            href={`/products/${product.slug}`}
                            className="text-[13.5px] font-medium text-text hover:text-accent-text"
                          >
                            {product.name}
                          </Link>
                        ) : (
                          <span className="text-[13.5px] text-muted">Product unavailable</span>
                        )}
                        {item.note && (
                          <p className="mt-1 text-[12px] leading-relaxed text-faint">{item.note}</p>
                        )}
                        {product && (
                          <p className="mt-1 font-mono text-[11px] text-faint tnum">
                            {product.sku} · {product.seller.name}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] text-text-2 tnum">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] text-faint tnum">
                        {product ? formatPrice(product.price) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[13px] font-medium tnum">
                        {item.quotedUnitPrice != null ? (
                          <span className="text-accent-text">
                            {formatPrice(item.quotedUnitPrice)}
                          </span>
                        ) : (
                          <span className="text-faint">pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {hasQuote && (
                  <tfoot className="border-t border-border">
                    <tr>
                      <td colSpan={3} className="px-5 py-3 text-right text-[13px] text-muted">
                        Quoted total (excl. GST)
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-[15px] font-semibold text-text tnum">
                        {formatPricePrecise(quotedTotal)}
                      </td>
                    </tr>
                    {saving > 0 && (
                      <tr>
                        <td colSpan={3} className="px-5 pb-3 text-right text-[12px] text-muted">
                          Against list price
                        </td>
                        <td className="px-5 pb-3 text-right font-mono text-[12px] text-success tnum">
                          −{formatPrice(saving)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                )}
              </table>
            </div>
          </SectionCard>

          {/* Requirements -------------------------------------------------- */}
          <SectionCard title="Your requirements">
            <p className="text-[14px] leading-relaxed text-text-2">{rfq.requirements}</p>
          </SectionCard>

          {/* Messages ------------------------------------------------------ */}
          <SectionCard
            title="Messages"
            description={
              rfq.messages.length === 0 ? 'No messages yet.' : undefined
            }
            padded={rfq.messages.length === 0}
          >
            {rfq.messages.length === 0 ? (
              <p className="text-[13px] text-muted">
                When the supplier responds, the thread appears here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rfq.messages.map((message) => (
                  <li key={message.id} className="flex gap-3 px-5 py-4">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted"
                      aria-hidden
                    >
                      <MessageSquare className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-faint">
                        <span className="font-medium text-muted capitalize">
                          {message.authorRole}
                        </span>{' '}
                        · {formatDateTime(message.createdAt)}
                      </p>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">
                        {message.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Sidebar ---------------------------------------------------------- */}
        <div className="space-y-6">
          {rfq.status === 'quoted' && (
            <div className="rounded-xl border border-accent-line bg-accent-soft/50 p-5">
              <p className="text-[11px] font-semibold tracking-wide text-accent-text uppercase">
                Awaiting your decision
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-text tnum">
                {formatPrice(rfq.quotedTotal ?? quotedTotal)}
              </p>
              {rfq.validUntil && (
                <p className="mt-1 text-[12px] text-muted">
                  Valid until {formatDate(rfq.validUntil)}
                </p>
              )}
              <div className="mt-4 grid gap-2">
                <Button fullWidth disabled title="Order placement arrives in phase 4">
                  Accept quotation
                </Button>
                <Button variant="secondary" fullWidth disabled>
                  Negotiate
                </Button>
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-faint">
                Acceptance and negotiation are wired up in the next phase — see
                the README roadmap.
              </p>
            </div>
          )}

          <SectionCard title="Delivery & contact">
            <dl className="space-y-3 text-[13px]">
              <div className="flex gap-2.5">
                <Building2 className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                <div>
                  <dt className="sr-only">Company</dt>
                  <dd className="text-text-2">{rfq.contact.company}</dd>
                  <dd className="mt-0.5 text-[12px] text-faint">{rfq.contact.name}</dd>
                </div>
              </div>

              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                <div>
                  <dt className="sr-only">Delivery</dt>
                  <dd className="text-text-2">
                    {rfq.contact.city}
                    {rfq.deliveryPincode && ` — ${rfq.deliveryPincode}`}
                  </dd>
                </div>
              </div>

              {rfq.requiredByDate && (
                <div className="flex gap-2.5">
                  <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                  <div>
                    <dt className="sr-only">Required by</dt>
                    <dd className="text-text-2">{formatDate(rfq.requiredByDate)}</dd>
                  </div>
                </div>
              )}
            </dl>

            {rfq.contact.gstin && (
              <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-faint tnum">
                GSTIN {rfq.contact.gstin}
              </p>
            )}
          </SectionCard>

          <SectionCard title="Status history">
            <ol className="space-y-2.5 text-[13px]">
              {RFQ_STATUSES.filter(
                (status) => PIPELINE.includes(status as (typeof PIPELINE)[number])
              ).map((status, index) => (
                <li key={status} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      currentStage >= index ? 'bg-accent' : 'bg-border'
                    )}
                    aria-hidden
                  />
                  <span className={currentStage >= index ? 'text-text-2' : 'text-faint'}>
                    {RFQ_STATUS_LABELS[status]}
                  </span>
                </li>
              ))}
            </ol>
          </SectionCard>

          <ButtonLink href="/account/saved" variant="secondary" fullWidth size="sm">
            Start another request
          </ButtonLink>
        </div>
      </div>
    </>
  )
}
