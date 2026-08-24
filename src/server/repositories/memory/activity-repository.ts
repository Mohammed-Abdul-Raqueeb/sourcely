import 'server-only'
import type {
  Notification,
  Rfq,
  SavedProduct,
  SavedSearch,
  SearchEvent,
} from '@/lib/domain/account'
import type { AssistantMessage, Conversation } from '@/lib/domain/search'
import type { ActivityRepository } from '../types'
import { getStore, newId, persist } from './store'

/**
 * Buyer activity persistence.
 *
 * Every read is scoped by `userId` inside the repository rather than trusting
 * the caller to filter. That is the second half of the rule in
 * ARCHITECTURE.md §7 — middleware guards routes, the data layer guards data —
 * and it means a missing `where userId = ?` cannot leak another buyer's
 * shortlist even if a page forgets to check.
 */

const VIEW_HISTORY_CAP = 60
const SEARCH_HISTORY_CAP = 200
const CONVERSATION_CAP = 40

export class MemoryActivityRepository implements ActivityRepository {
  /* --------------------------------------------------------- saved products */

  async listSavedProducts(userId: string): Promise<SavedProduct[]> {
    const store = await getStore()
    // Same stable-tiebreak reasoning as recentlyViewed: equal timestamps keep
    // reverse insertion order, so the newest save leads.
    return [...store.savedProducts]
      .filter((entry) => entry.userId === userId)
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async isSaved(userId: string, productId: string): Promise<boolean> {
    const store = await getStore()
    return store.savedProducts.some(
      (entry) => entry.userId === userId && entry.productId === productId
    )
  }

  async saveProduct(
    userId: string,
    productId: string,
    note: string | null = null
  ): Promise<SavedProduct> {
    const store = await getStore()

    const existing = store.savedProducts.find(
      (entry) => entry.userId === userId && entry.productId === productId
    )
    if (existing) {
      if (note !== null) existing.note = note
      persist()
      return existing
    }

    const saved: SavedProduct = {
      id: newId('sav'),
      userId,
      productId,
      note,
      createdAt: new Date().toISOString(),
    }
    store.savedProducts.push(saved)
    persist()
    return saved
  }

  async unsaveProduct(userId: string, productId: string): Promise<void> {
    const store = await getStore()
    store.savedProducts = store.savedProducts.filter(
      (entry) => !(entry.userId === userId && entry.productId === productId)
    )
    persist()
  }

  async setSavedNote(userId: string, productId: string, note: string | null): Promise<void> {
    const store = await getStore()
    const entry = store.savedProducts.find(
      (record) => record.userId === userId && record.productId === productId
    )
    if (!entry) return
    entry.note = note?.trim() || null
    persist()
  }

  /* --------------------------------------------------------- saved searches */

  async listSavedSearches(userId: string): Promise<SavedSearch[]> {
    const store = await getStore()
    return store.savedSearches
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async saveSearch(input: Omit<SavedSearch, 'id' | 'createdAt'>): Promise<SavedSearch> {
    const store = await getStore()
    const saved: SavedSearch = {
      ...input,
      id: newId('ss'),
      createdAt: new Date().toISOString(),
    }
    store.savedSearches.push(saved)
    persist()
    return saved
  }

  async deleteSavedSearch(userId: string, id: string): Promise<void> {
    const store = await getStore()
    store.savedSearches = store.savedSearches.filter(
      (entry) => !(entry.id === id && entry.userId === userId)
    )
    persist()
  }

  async setSearchAlerts(userId: string, id: string, enabled: boolean): Promise<void> {
    const store = await getStore()
    const entry = store.savedSearches.find(
      (record) => record.id === id && record.userId === userId
    )
    if (!entry) return
    entry.alertsEnabled = enabled
    persist()
  }

  /* ----------------------------------------------------------------- views */

  async recordView(
    userId: string | null,
    visitorId: string,
    productId: string
  ): Promise<void> {
    const store = await getStore()

    // One row per product per identity — a recently-viewed list that repeats
    // the same product six times is noise, not history.
    store.views = store.views.filter(
      (entry) =>
        entry.productId !== productId ||
        (userId ? entry.userId !== userId : entry.visitorId !== visitorId)
    )

    store.views.push({
      id: newId('view'),
      userId,
      visitorId,
      productId,
      viewedAt: new Date().toISOString(),
    })

    if (store.views.length > VIEW_HISTORY_CAP * 4) {
      store.views = store.views
        .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
        .slice(0, VIEW_HISTORY_CAP * 2)
    }

    persist()
  }

  async recentlyViewed(userId: string, limit = 8): Promise<string[]> {
    const store = await getStore()

    // Two views inside the same millisecond carry identical ISO timestamps, so
    // the timestamp alone cannot order them. Reversing first puts the most
    // recently appended row ahead, and `sort` is stable, so ties keep that
    // insertion order. A "recently viewed" list that shows the wrong product
    // first is a small bug that reads as a broken feature.
    return [...store.views]
      .filter((entry) => entry.userId === userId)
      .reverse()
      .sort((a, b) => b.viewedAt.localeCompare(a.viewedAt))
      .slice(0, limit)
      .map((entry) => entry.productId)
  }

  /* --------------------------------------------------------- search events */

  async recordSearch(event: Omit<SearchEvent, 'id' | 'createdAt'>): Promise<SearchEvent> {
    const store = await getStore()
    const record: SearchEvent = {
      ...event,
      id: newId('evt'),
      createdAt: new Date().toISOString(),
    }
    store.searchEvents.push(record)

    if (store.searchEvents.length > SEARCH_HISTORY_CAP * 2) {
      store.searchEvents = store.searchEvents
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, SEARCH_HISTORY_CAP)
    }

    persist()
    return record
  }

  async listSearchHistory(userId: string, limit = 40): Promise<SearchEvent[]> {
    const store = await getStore()
    return store.searchEvents
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  async clearSearchHistory(userId: string): Promise<void> {
    const store = await getStore()
    store.searchEvents = store.searchEvents.filter((entry) => entry.userId !== userId)
    persist()
  }

  /* --------------------------------------------------------- notifications */

  async listNotifications(userId: string, limit = 30): Promise<Notification[]> {
    const store = await getStore()
    return store.notifications
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  async unreadCount(userId: string): Promise<number> {
    const store = await getStore()
    return store.notifications.filter((entry) => entry.userId === userId && !entry.read).length
  }

  async markNotificationRead(userId: string, id: string): Promise<void> {
    const store = await getStore()
    const entry = store.notifications.find(
      (record) => record.id === id && record.userId === userId
    )
    if (!entry) return
    entry.read = true
    persist()
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const store = await getStore()
    for (const entry of store.notifications) {
      if (entry.userId === userId) entry.read = true
    }
    persist()
  }

  async createNotification(
    input: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Notification> {
    const store = await getStore()
    const notification: Notification = {
      ...input,
      id: newId('ntf'),
      read: false,
      createdAt: new Date().toISOString(),
    }
    store.notifications.push(notification)
    persist()
    return notification
  }

  /* ------------------------------------------------------------------- RFQ */

  async listRfqs(userId: string): Promise<Rfq[]> {
    const store = await getStore()
    return store.rfqs
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async findRfq(userId: string, id: string): Promise<Rfq | null> {
    const store = await getStore()
    return store.rfqs.find((entry) => entry.id === id && entry.userId === userId) ?? null
  }

  async createRfq(
    input: Omit<Rfq, 'id' | 'reference' | 'createdAt' | 'updatedAt' | 'messages'>
  ): Promise<Rfq> {
    const store = await getStore()
    const now = new Date()

    // Human-quotable reference: RFQ-YYMM-NNNN. Buyers read these out on the
    // phone, so it has to be short and unambiguous.
    const sequence = String(store.rfqs.length + 101).padStart(4, '0')
    const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`

    const rfq: Rfq = {
      ...input,
      id: newId('rfq'),
      reference: `RFQ-${stamp}-${sequence}`,
      messages: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    store.rfqs.push(rfq)
    persist()
    return rfq
  }

  /* --------------------------------------------------------- conversations */

  async listConversations(userId: string, limit = 25): Promise<Conversation[]> {
    const store = await getStore()
    return store.conversations
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
  }

  async findConversation(userId: string | null, id: string): Promise<Conversation | null> {
    const store = await getStore()
    const conversation = store.conversations.find((entry) => entry.id === id)
    if (!conversation) return null
    // An anonymous conversation is readable by anyone holding its id; an owned
    // one is readable only by its owner.
    if (conversation.userId && conversation.userId !== userId) return null
    return conversation
  }

  async createConversation(userId: string | null, title: string): Promise<Conversation> {
    const store = await getStore()
    const now = new Date().toISOString()

    const conversation: Conversation = {
      id: newId('conv'),
      userId,
      title: title.slice(0, 120),
      messages: [],
      createdAt: now,
      updatedAt: now,
    }

    store.conversations.push(conversation)

    if (store.conversations.length > CONVERSATION_CAP * 3) {
      store.conversations = store.conversations
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, CONVERSATION_CAP * 2)
    }

    persist()
    return conversation
  }

  async appendMessages(
    conversationId: string,
    messages: AssistantMessage[]
  ): Promise<Conversation | null> {
    const store = await getStore()
    const conversation = store.conversations.find((entry) => entry.id === conversationId)
    if (!conversation) return null

    conversation.messages.push(...messages)
    conversation.updatedAt = new Date().toISOString()

    // Title the conversation from its first real question, so the history
    // sidebar is scannable without opening anything.
    if (conversation.title === 'New conversation') {
      const firstUser = conversation.messages.find((message) => message.role === 'user')
      if (firstUser) conversation.title = firstUser.content.slice(0, 90)
    }

    persist()
    return conversation
  }

  async renameConversation(userId: string, id: string, title: string): Promise<void> {
    const store = await getStore()
    const conversation = store.conversations.find(
      (entry) => entry.id === id && entry.userId === userId
    )
    if (!conversation) return
    conversation.title = title.trim().slice(0, 120) || 'Untitled conversation'
    persist()
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const store = await getStore()
    store.conversations = store.conversations.filter(
      (entry) => !(entry.id === id && entry.userId === userId)
    )
    persist()
  }
}
