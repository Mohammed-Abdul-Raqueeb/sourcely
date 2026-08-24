/**
 * Presentation formatting.
 *
 * All of it is locale-pinned to `en-IN` so server and client render byte
 * identical strings — a mismatch here is a hydration error, not a cosmetic
 * bug. Nothing in this file reads the ambient locale.
 */

import type { AvailabilityState } from './domain/catalog'
import { AVAILABILITY_STATES } from './domain/catalog'
import type { RfqStatus } from './domain/account'

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const INR_PRECISE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const COMPACT = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const PLAIN = new Intl.NumberFormat('en-IN')

/** `₹4,250` — the default everywhere a price is shown. */
export function formatPrice(value: number): string {
  return INR.format(value)
}

/** `₹4,250.00` — used on quotations and RFQ totals only. */
export function formatPricePrecise(value: number): string {
  return INR_PRECISE.format(value)
}

/**
 * Indian numbering compaction: `12.5L`, `3.4Cr`. `Intl` compact notation
 * produces `T` for thousand in en-IN, which reads wrong in a B2B context,
 * so thousands are spelled out and lakh/crore are handled explicitly.
 */
export function formatCompactINR(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(value % 10_000_000 === 0 ? 0 : 1)}Cr`
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(value % 100_000 === 0 ? 0 : 1)}L`
  if (value >= 1_000) return `₹${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`
  return `₹${value}`
}

export function formatNumber(value: number): string {
  return PLAIN.format(value)
}

export function formatCompact(value: number): string {
  return COMPACT.format(value)
}

/** `₹3,000 – ₹5,000`, `Under ₹5,000`, `Over ₹3,000`. */
export function formatPriceBand(min?: number, max?: number): string {
  if (min != null && max != null) return `${formatPrice(min)} – ${formatPrice(max)}`
  if (max != null) return `Under ${formatPrice(max)}`
  if (min != null) return `Over ${formatPrice(min)}`
  return 'Any price'
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso))
}

/**
 * `4h ago`, `3d ago`. Takes an explicit `now` so server-rendered output is
 * deterministic and callers in tests can pin it.
 */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

/* -------------------------------------------------------------------------- */
/* Catalogue vocabulary                                                       */
/* -------------------------------------------------------------------------- */

export const AVAILABILITY_LABELS: Record<AvailabilityState, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  made_to_order: 'Made to order',
  out_of_stock: 'Out of stock',
}

/** Maps to a semantic token, not a raw colour. */
export const AVAILABILITY_TONE: Record<AvailabilityState, 'success' | 'warning' | 'info' | 'danger'> = {
  in_stock: 'success',
  low_stock: 'warning',
  made_to_order: 'info',
  out_of_stock: 'danger',
}

/**
 * Availability ordered worst to best, so "readiest stock" has a defined
 * meaning in the comparison grid. Re-exported from the domain constant rather
 * than restated, so the two can never drift apart.
 */
export const AVAILABILITY_STATES_ORDER: readonly AvailabilityState[] = AVAILABILITY_STATES

/**
 * Badge tone per RFQ status.
 *
 * `quoted` is the only amber one: it is the single status that requires the
 * buyer to do something, and amber in this design system means "act".
 */
export const RFQ_TONE: Record<
  RfqStatus,
  'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
> = {
  draft: 'neutral',
  submitted: 'info',
  under_review: 'info',
  quoted: 'accent',
  negotiating: 'warning',
  accepted: 'success',
  declined: 'danger',
  expired: 'neutral',
}

export function formatLeadTime(days: number | null): string {
  if (days == null || days <= 0) return 'Ships today'
  if (days === 1) return 'Ships in 1 day'
  if (days <= 7) return `Ships in ${days} days`
  const weeks = Math.round(days / 7)
  return `Ships in ${weeks} week${weeks === 1 ? '' : 's'}`
}

export function formatWarranty(months: number | null): string {
  if (months == null || months === 0) return 'No warranty'
  if (months % 12 === 0) {
    const years = months / 12
    return `${years} year${years === 1 ? '' : 's'}`
  }
  return `${months} months`
}

/**
 * Discount off list price, or null when there is no meaningful saving.
 * Anything under 3% is noise and is not badged.
 */
export function discountPercent(price: number, listPrice: number | null): number | null {
  if (listPrice == null || listPrice <= price) return null
  const pct = Math.round(((listPrice - price) / listPrice) * 100)
  return pct >= 3 ? pct : null
}

/* -------------------------------------------------------------------------- */
/* Match presentation                                                         */
/* -------------------------------------------------------------------------- */

export type MatchBand = 'excellent' | 'strong' | 'fair'

/**
 * Bands the match percentage for colour and copy. Deliberately coarse — a
 * 91% and a 93% are not meaningfully different and should not look different.
 */
export function matchBand(percent: number): MatchBand {
  if (percent >= 85) return 'excellent'
  if (percent >= 70) return 'strong'
  return 'fair'
}

export const MATCH_BAND_LABELS: Record<MatchBand, string> = {
  excellent: 'Excellent match',
  strong: 'Strong match',
  fair: 'Partial match',
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** `2 items`, `1 item`. */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
