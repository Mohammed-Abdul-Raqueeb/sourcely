import 'server-only'
import type { Conversation } from '@/lib/domain/search'
import type { Rfq, Role, SearchEvent, User } from '@/lib/domain/account'
import type { AdminRepository, RfqUpdate } from '../types'
import { getStore, newId, persist } from './store'

/**
 * Cross-tenant persistence for the admin area.
 *
 * Every method here reads across users, which is exactly why it is a separate
 * class behind `requireRole('staff')` rather than extra methods on the
 * user-scoped `ActivityRepository`.
 *
 * `passwordHash` is stripped on the way out. Nothing in the admin UI needs it,
 * and a hash that never leaves this file cannot be leaked by a careless
 * `JSON.stringify` in a component three layers up.
 */

function withoutSecret(record: User & { passwordHash?: string }): User {
  const { passwordHash: _passwordHash, ...user } = record
  return user
}

export class MemoryAdminRepository implements AdminRepository {
  /* ------------------------------------------------------------------ users */

  async listUsers(limit = 200): Promise<User[]> {
    const store = await getStore()
    return store.users
      .slice()
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
      .slice(0, limit)
      .map(withoutSecret)
  }

  async findUser(id: string): Promise<User | null> {
    const store = await getStore()
    const user = store.users.find((entry) => entry.id === id)
    return user ? withoutSecret(user) : null
  }

  async countUsers(): Promise<number> {
    return (await getStore()).users.length
  }

  /* -------------------------------------------------------------------- RFQ */

  async listAllRfqs(limit = 200): Promise<Rfq[]> {
    const store = await getStore()
    return store.rfqs
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
  }

  async findAnyRfq(id: string): Promise<Rfq | null> {
    const store = await getStore()
    return store.rfqs.find((entry) => entry.id === id) ?? null
  }

  async updateRfq(id: string, patch: RfqUpdate): Promise<Rfq | null> {
    const store = await getStore()
    const rfq = store.rfqs.find((entry) => entry.id === id)
    if (!rfq) return null

    if (patch.status) rfq.status = patch.status

    if (patch.quotes) {
      for (const item of rfq.items) {
        const quote = patch.quotes[item.productId]
        if (!quote) continue
        item.quotedUnitPrice = quote.unitPrice
        item.quotedLeadTimeDays = quote.leadTimeDays
      }

      // The header total is derived, never entered — a quoted total that
      // disagrees with its own line items is the fastest way to lose a buyer's
      // trust in the whole quotation.
      const priced = rfq.items.filter((item) => item.quotedUnitPrice != null)
      rfq.quotedTotal =
        priced.length > 0
          ? priced.reduce(
              (sum, item) => sum + (item.quotedUnitPrice ?? 0) * item.quantity,
              0
            )
          : null
    }

    if (patch.validUntil !== undefined) rfq.validUntil = patch.validUntil

    rfq.updatedAt = new Date().toISOString()
    persist()
    return rfq
  }

  async addRfqMessage(
    id: string,
    author: { id: string; role: Role },
    body: string
  ): Promise<Rfq | null> {
    const store = await getStore()
    const rfq = store.rfqs.find((entry) => entry.id === id)
    if (!rfq) return null

    rfq.messages.push({
      id: newId('msg'),
      rfqId: rfq.id,
      authorId: author.id,
      authorRole: author.role,
      body: body.trim().slice(0, 4000),
      createdAt: new Date().toISOString(),
    })

    rfq.updatedAt = new Date().toISOString()
    persist()
    return rfq
  }

  /* -------------------------------------------------------------- analytics */

  async listAllSearchEvents(limit = 500): Promise<SearchEvent[]> {
    const store = await getStore()
    return store.searchEvents
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  async listAllConversations(limit = 100): Promise<Conversation[]> {
    const store = await getStore()
    return store.conversations
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
  }

  async countSavedForProduct(productId: string): Promise<number> {
    const store = await getStore()
    return store.savedProducts.filter((entry) => entry.productId === productId).length
  }
}
