import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, CalendarClock, Mail, MapPin, MessageSquare, Phone } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getAdminRepository, getCatalogRepository } from '@/server/repositories'
import { RFQ_STATUS_LABELS } from '@/lib/domain/account'
import { formatDate, formatDateTime, pluralize, RFQ_TONE } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { SectionCard } from '@/components/account/ui'
import { RfqConsole, RfqReplyForm, type QuoteLine } from '@/components/admin/rfq-console'

export const metadata: Metadata = { title: 'Quotation' }

/**
 * Quotation detail — the supplier side of an RFQ thread.
 *
 * Reads through `AdminRepository.findAnyRfq`, which is not user-scoped. That
 * is the whole reason it is a separate repository behind `requireRole`.
 */
export default async function AdminRfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireRole('staff', `/admin/rfq/${id}`)

  const admin = getAdminRepository()
  const rfq = await admin.findAnyRfq(id)
  if (!rfq) notFound()

  const catalog = getCatalogRepository()
  const products = await catalog.findManyByIds(rfq.items.map((item) => item.productId))
  const byId = new Map(products.map((product) => [product.id, product]))

  const lines: QuoteLine[] = rfq.items.map((item) => {
    const product = byId.get(item.productId)
    return {
      productId: item.productId,
      name: product?.name ?? 'Product unavailable',
      sku: product?.sku ?? item.productId,
      quantity: item.quantity,
      listPrice: product?.price ?? 0,
      quotedUnitPrice: item.quotedUnitPrice,
      quotedLeadTimeDays: item.quotedLeadTimeDays,
      note: item.note,
    }
  })

  const buyer = rfq.userId ? await admin.findUser(rfq.userId) : null

  return (
    <>
      <Link
        href="/admin/rfq"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        All quotations
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-text tnum">
            {rfq.reference}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {rfq.contact.company} · {pluralize(rfq.items.length, 'line')} · raised{' '}
            {formatDate(rfq.createdAt)}
          </p>
        </div>
        <Badge tone={RFQ_TONE[rfq.status]} size="md" dot>
          {RFQ_STATUS_LABELS[rfq.status]}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <RfqConsole rfq={rfq} lines={lines} />

          <SectionCard title="What the buyer asked for">
            <p className="text-[14px] leading-relaxed text-text-2">{rfq.requirements}</p>
          </SectionCard>

          <SectionCard
            title="Thread"
            description={
              rfq.messages.length === 0
                ? 'Nothing sent yet. A reply reaches the buyer immediately.'
                : `${pluralize(rfq.messages.length, 'message')}`
            }
            padded={false}
          >
            {rfq.messages.length > 0 && (
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

            <div className="border-t border-border p-5">
              <RfqReplyForm rfqId={rfq.id} />
            </div>
          </SectionCard>
        </div>

        {/* Sidebar --------------------------------------------------------- */}
        <div className="space-y-6">
          <SectionCard title="Buyer">
            <dl className="space-y-3 text-[13px]">
              <div className="flex gap-2.5">
                <Building2 className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                <div className="min-w-0">
                  <dt className="sr-only">Company</dt>
                  <dd className="text-text-2">{rfq.contact.company}</dd>
                  <dd className="mt-0.5 text-[12px] text-faint">{rfq.contact.name}</dd>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Mail className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                <dd className="min-w-0 truncate">
                  <a
                    href={`mailto:${rfq.contact.email}`}
                    className="text-text-2 hover:text-accent-text"
                  >
                    {rfq.contact.email}
                  </a>
                </dd>
              </div>

              {rfq.contact.phone && (
                <div className="flex gap-2.5">
                  <Phone className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                  <dd>
                    <a href={`tel:${rfq.contact.phone}`} className="text-text-2 hover:text-accent-text">
                      {rfq.contact.phone}
                    </a>
                  </dd>
                </div>
              )}

              <div className="flex gap-2.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                <dd className="text-text-2">
                  {rfq.contact.city}
                  {rfq.deliveryPincode && ` — ${rfq.deliveryPincode}`}
                </dd>
              </div>

              {rfq.requiredByDate && (
                <div className="flex gap-2.5">
                  <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
                  <dd className="text-text-2">Needed by {formatDate(rfq.requiredByDate)}</dd>
                </div>
              )}
            </dl>

            {rfq.contact.gstin && (
              <p className="mt-4 border-t border-border pt-3 font-mono text-[11px] text-faint tnum">
                GSTIN {rfq.contact.gstin}
              </p>
            )}

            {buyer && (
              <Link
                href={`/admin/customers?q=${encodeURIComponent(buyer.email)}`}
                className="mt-3 inline-block text-[12px] font-medium text-accent-text hover:underline"
              >
                View customer record
              </Link>
            )}
          </SectionCard>

          <SectionCard title="Guidance">
            <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-muted">
              <li>
                Price against the buyer&apos;s quantities, not list rates — that is
                the whole reason they sent a request.
              </li>
              <li>
                Set a validity date. A quotation with no expiry gets chased three
                weeks later at a price that no longer holds.
              </li>
              <li>
                Marking this <span className="text-text-2">Quoted</span> notifies
                the buyer immediately and shows the total on their dashboard.
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
