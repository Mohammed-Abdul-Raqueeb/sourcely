'use client'

import { useActionState, useMemo, useState } from 'react'
import { Calculator, Send } from 'lucide-react'
import type { Rfq } from '@/lib/domain/account'
import { RFQ_STATUSES, RFQ_STATUS_LABELS } from '@/lib/domain/account'
import { IDLE_FORM_STATE } from '@/lib/validation/auth'
import { formatPrice, formatPricePrecise } from '@/lib/format'
import { addRfqMessageAction, updateRfqAction } from '@/server/actions/admin'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { FormBanner, SubmitButton } from '@/components/auth/form-shell'
import { SectionCard } from '@/components/account/ui'

/**
 * Quotation console.
 *
 * The running total updates as prices are typed, because the operator is
 * pricing against a number the buyer will see and should not have to compute
 * it in their head. The server recomputes it from the line items regardless —
 * this is a preview, not the source of truth.
 */

export interface QuoteLine {
  productId: string
  name: string
  sku: string
  quantity: number
  listPrice: number
  quotedUnitPrice: number | null
  quotedLeadTimeDays: number | null
  note: string | null
}

export function RfqConsole({ rfq, lines }: { rfq: Rfq; lines: QuoteLine[] }) {
  const [state, formAction] = useActionState(updateRfqAction, IDLE_FORM_STATE)

  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [line.productId, line.quotedUnitPrice?.toString() ?? ''])
    )
  )

  const total = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const value = Number.parseInt(prices[line.productId] ?? '', 10)
        return sum + (Number.isFinite(value) && value > 0 ? value * line.quantity : 0)
      }, 0),
    [lines, prices]
  )

  const listTotal = lines.reduce((sum, line) => sum + line.listPrice * line.quantity, 0)
  const discount = listTotal > 0 && total > 0 ? 1 - total / listTotal : 0

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="rfqId" value={rfq.id} />

      <FormBanner state={state} />

      <SectionCard
        title="Price the lines"
        description="Enter a unit price against the buyer's quantities. The total is derived from these."
        padded={false}
      >
        {/* min-w tuned to fit the desktop card without scrolling — the line
            totals are the point of this table and must not sit off-screen. */}
        <div className="overflow-x-auto scrollbar-slim">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                <th scope="col" className="px-4 py-3 font-semibold">Line</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Qty</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">List</th>
                <th scope="col" className="px-2 py-3 font-semibold">Unit price ₹</th>
                <th scope="col" className="px-2 py-3 font-semibold">Lead days</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Line total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {lines.map((line) => {
                const value = Number.parseInt(prices[line.productId] ?? '', 10)
                const lineTotal =
                  Number.isFinite(value) && value > 0 ? value * line.quantity : 0
                const below = Number.isFinite(value) && value > 0 && value < line.listPrice * 0.5

                return (
                  <tr key={line.productId}>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-text">{line.name}</p>
                      <p className="font-mono text-[11px] text-faint tnum">{line.sku}</p>
                      {line.note && (
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">{line.note}</p>
                      )}
                    </td>

                    <td className="px-2 py-3 text-right font-mono text-[13px] text-text-2 tnum">
                      {line.quantity}
                    </td>

                    <td className="px-2 py-3 text-right font-mono text-[13px] text-faint tnum">
                      {formatPrice(line.listPrice)}
                    </td>

                    <td className="px-2 py-3">
                      <input
                        type="number"
                        name={`price:${line.productId}`}
                        min={0}
                        value={prices[line.productId] ?? ''}
                        onChange={(event) =>
                          setPrices((current) => ({
                            ...current,
                            [line.productId]: event.target.value,
                          }))
                        }
                        aria-label={`Unit price for ${line.name}`}
                        className="h-9 w-24 rounded-md border border-border bg-surface-2 px-2 text-right font-mono text-[13px] text-text tnum focus:border-accent focus:outline-none"
                      />
                      {below && (
                        <p className="mt-1 text-[11px] text-warning">
                          Under half list — check this
                        </p>
                      )}
                    </td>

                    <td className="px-2 py-3">
                      <input
                        type="number"
                        name={`lead:${line.productId}`}
                        min={0}
                        max={365}
                        defaultValue={line.quotedLeadTimeDays ?? ''}
                        aria-label={`Lead time for ${line.name}`}
                        className="h-9 w-16 rounded-md border border-border bg-surface-2 px-2 text-right font-mono text-[13px] text-text tnum focus:border-accent focus:outline-none"
                      />
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-[13px] font-medium text-text tnum">
                      {lineTotal > 0 ? formatPrice(lineTotal) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot className="border-t border-border bg-surface-2/40">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Calculator className="size-3.5 text-faint" aria-hidden />
                    Quoted total (excl. GST)
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-[15px] font-semibold text-text tnum">
                  {total > 0 ? formatPricePrecise(total) : '—'}
                </td>
              </tr>
              {discount > 0.001 && (
                <tr>
                  <td colSpan={5} className="px-4 pb-3 text-right text-[12px] text-muted">
                    Against list
                  </td>
                  <td className="px-4 pb-3 text-right font-mono text-[12px] text-success tnum">
                    −{Math.round(discount * 100)}%
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Status" description="Changing this notifies the buyer.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status" error={state.fieldErrors?.status} required>
            <Select id="status" name="status" defaultValue={rfq.status} required>
              {RFQ_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {RFQ_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Quotation valid until"
            htmlFor="validUntil"
            hint="Optional. Shown to the buyer on the quotation."
          >
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              defaultValue={rfq.validUntil ? rfq.validUntil.slice(0, 10) : ''}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-52">
            <SubmitButton loadingLabel="Saving…">Update quotation</SubmitButton>
          </div>
        </div>
      </SectionCard>
    </form>
  )
}

/* -------------------------------------------------------------------------- */

export function RfqReplyForm({ rfqId }: { rfqId: string }) {
  const [state, formAction] = useActionState(addRfqMessageAction, IDLE_FORM_STATE)

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="rfqId" value={rfqId} />

      <FormBanner state={state} />

      <Field htmlFor="body" error={state.fieldErrors?.body}>
        <Textarea
          id="body"
          name="body"
          rows={3}
          maxLength={4000}
          required
          invalid={Boolean(state.fieldErrors?.body)}
          placeholder="Lead times, substitutions, certificate availability — anything the buyer needs before deciding."
        />
      </Field>

      <div className="flex justify-end">
        <div className="w-40">
          <SubmitButton loadingLabel="Sending…">
            <Send className="size-3.5" aria-hidden />
            Send
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}
