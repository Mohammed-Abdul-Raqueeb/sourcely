/**
 * Identity, RFQ and notification contracts.
 *
 * Note there is no `passwordHash` on `User`. That field exists only on the
 * persistence record inside `src/server/repositories/` and is never present
 * on a type that can reach a React component.
 */

import type { ProductView } from './catalog'
import type { SearchIntent } from './search'

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const ROLES = ['customer', 'staff', 'admin'] as const
export type Role = (typeof ROLES)[number]

/** Coarse capability checks. Enforced in services, not only in middleware. */
export const ROLE_RANK: Record<Role, number> = { customer: 0, staff: 1, admin: 2 }

export interface User {
  id: string
  email: string
  name: string
  role: Role
  company: string | null
  phone: string | null
  city: string | null
  gstin: string | null
  avatarUrl: string | null
  emailVerified: boolean
  createdAt: string
  lastActiveAt: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl: string | null
}

/* -------------------------------------------------------------------------- */
/* Buyer activity                                                             */
/* -------------------------------------------------------------------------- */

export interface SavedProduct {
  id: string
  userId: string
  productId: string
  note: string | null
  createdAt: string
}

export interface SavedSearch {
  id: string
  userId: string
  title: string
  query: string
  /** null when saved from a keyword search, which has no parsed intent. */
  intent: SearchIntent | null
  /** Notify when new products match. */
  alertsEnabled: boolean
  lastResultCount: number
  createdAt: string
}

export interface SearchEvent {
  id: string
  userId: string | null
  sessionId: string
  query: string
  mode: 'traditional' | 'ai'
  intent: SearchIntent | null
  resultCount: number
  /** Product ids the buyer opened from this search. */
  clickedProductIds: string[]
  convertedToRfq: boolean
  tookMs: number
  createdAt: string
}

export interface RecentlyViewed {
  productId: string
  viewedAt: string
}

export interface ComparisonSet {
  id: string
  userId: string | null
  title: string
  productIds: string[]
  createdAt: string
}

/* -------------------------------------------------------------------------- */
/* RFQ                                                                        */
/* -------------------------------------------------------------------------- */

export const RFQ_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'quoted',
  'negotiating',
  'accepted',
  'declined',
  'expired',
] as const

export type RfqStatus = (typeof RFQ_STATUSES)[number]

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  quoted: 'Quoted',
  negotiating: 'Negotiating',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
}

export interface RfqItem {
  productId: string
  quantity: number
  /** Buyer note scoped to this line, e.g. "DN65 if DN50 unavailable". */
  note: string | null
  /** Seller response, populated once quoted. */
  quotedUnitPrice: number | null
  quotedLeadTimeDays: number | null
}

export interface RfqContact {
  name: string
  company: string
  email: string
  phone: string
  city: string
  gstin: string | null
}

export interface RfqMessage {
  id: string
  rfqId: string
  authorId: string
  authorRole: Role
  body: string
  createdAt: string
}

export interface Rfq {
  id: string
  reference: string
  userId: string | null
  status: RfqStatus
  contact: RfqContact
  items: RfqItem[]
  requirements: string
  deliveryPincode: string | null
  requiredByDate: string | null
  /** Set when the RFQ was created straight from an assistant conversation. */
  sourceConversationId: string | null
  messages: RfqMessage[]
  quotedTotal: number | null
  validUntil: string | null
  createdAt: string
  updatedAt: string
}

/** RFQ with products joined, for rendering. */
export interface RfqView extends Omit<Rfq, 'items'> {
  items: Array<RfqItem & { product: ProductView }>
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export const NOTIFICATION_KINDS = [
  'rfq_status',
  'rfq_message',
  'price_drop',
  'back_in_stock',
  'saved_search_hit',
  'account',
  'system',
] as const

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export interface Notification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string
  href: string | null
  read: boolean
  createdAt: string
}
