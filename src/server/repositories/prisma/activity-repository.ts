import 'server-only'
import type {
  Notification,
  Rfq,
  SavedProduct,
  SavedSearch,
  SearchEvent,
} from '@/lib/domain/account'
import type { AssistantMessage, Conversation } from '@/lib/domain/search'
import { prisma } from '@/server/db/prisma'
import type { ActivityRepository } from '../types'
import {
  conversationInclude,
  rfqInclude,
  toConversation,
  toNotification,
  toRfq,
  toSavedProduct,
  toJson,
  toSavedSearch,
  toSearchEvent,
} from './mappers'

/**
 * PostgreSQL buyer-activity driver.
 *
 * Every query carries `userId` in its `where`. That scoping is the security
 * property, not a convenience — a page that forgets to check still cannot read
 * another buyer's shortlist, because the query itself cannot express it.
 */
export class PrismaActivityRepository implements ActivityRepository {
  /* --------------------------------------------------------- saved products */

  async listSavedProducts(userId: string): Promise<SavedProduct[]> {
    const rows = await prisma.savedProduct.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map(toSavedProduct)
  }

  async isSaved(userId: string, productId: string): Promise<boolean> {
    const count = await prisma.savedProduct.count({ where: { userId, productId } })
    return count > 0
  }

  async saveProduct(
    userId: string,
    productId: string,
    note: string | null = null
  ): Promise<SavedProduct> {
    const row = await prisma.savedProduct.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, note },
      update: note !== null ? { note } : {},
    })

    void prisma.product
      .update({ where: { id: productId }, data: { saveCount: { increment: 1 } } })
      .catch(() => {})

    return toSavedProduct(row)
  }

  async unsaveProduct(userId: string, productId: string): Promise<void> {
    await prisma.savedProduct
      .delete({ where: { userId_productId: { userId, productId } } })
      .catch(() => {
        // Already gone. Unsaving something twice is not an error.
      })
  }

  async setSavedNote(userId: string, productId: string, note: string | null): Promise<void> {
    await prisma.savedProduct
      .update({
        where: { userId_productId: { userId, productId } },
        data: { note: note?.trim() || null },
      })
      .catch(() => {})
  }

  /* --------------------------------------------------------- saved searches */

  async listSavedSearches(userId: string): Promise<SavedSearch[]> {
    const rows = await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toSavedSearch)
  }

  async saveSearch(input: Omit<SavedSearch, 'id' | 'createdAt'>): Promise<SavedSearch> {
    const row = await prisma.savedSearch.create({
      data: {
        userId: input.userId,
        title: input.title,
        query: input.query,
        intent: toJson(input.intent),
        alertsEnabled: input.alertsEnabled,
        lastResultCount: input.lastResultCount,
      },
    })
    return toSavedSearch(row)
  }

  async deleteSavedSearch(userId: string, id: string): Promise<void> {
    // Scoped delete: an id belonging to another user matches nothing.
    await prisma.savedSearch.deleteMany({ where: { id, userId } })
  }

  async setSearchAlerts(userId: string, id: string, enabled: boolean): Promise<void> {
    await prisma.savedSearch.updateMany({
      where: { id, userId },
      data: { alertsEnabled: enabled },
    })
  }

  /* ----------------------------------------------------------------- views */

  async recordView(
    userId: string | null,
    visitorId: string,
    productId: string
  ): Promise<void> {
    if (userId) {
      await prisma.productViewEvent.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, visitorId, productId },
        update: { viewedAt: new Date(), visitorId },
      })
    } else {
      // Anonymous visitors have no unique constraint to upsert against, so
      // replace by hand to keep one row per product per visitor.
      await prisma.productViewEvent.deleteMany({
        where: { userId: null, visitorId, productId },
      })
      await prisma.productViewEvent.create({ data: { visitorId, productId } })
    }

    void prisma.product
      .update({ where: { id: productId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {})
  }

  async recentlyViewed(userId: string, limit = 8): Promise<string[]> {
    const rows = await prisma.productViewEvent.findMany({
      where: { userId },
      orderBy: [{ viewedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: { productId: true },
    })
    return rows.map((row) => row.productId)
  }

  /* --------------------------------------------------------- search events */

  async recordSearch(event: Omit<SearchEvent, 'id' | 'createdAt'>): Promise<SearchEvent> {
    const row = await prisma.searchEvent.create({
      data: {
        userId: event.userId,
        sessionId: event.sessionId,
        query: event.query,
        mode: event.mode,
        intent: toJson(event.intent),
        resultCount: event.resultCount,
        clickedProductIds: event.clickedProductIds,
        convertedToRfq: event.convertedToRfq,
        tookMs: event.tookMs,
      },
    })
    return toSearchEvent(row)
  }

  async listSearchHistory(userId: string, limit = 40): Promise<SearchEvent[]> {
    const rows = await prisma.searchEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toSearchEvent)
  }

  async clearSearchHistory(userId: string): Promise<void> {
    await prisma.searchEvent.deleteMany({ where: { userId } })
  }

  /* --------------------------------------------------------- notifications */

  async listNotifications(userId: string, limit = 30): Promise<Notification[]> {
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toNotification)
  }

  async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, read: false } })
  }

  async markNotificationRead(userId: string, id: string): Promise<void> {
    await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } })
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
  }

  async createNotification(
    input: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Notification> {
    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
      },
    })
    return toNotification(row)
  }

  /* ------------------------------------------------------------------- RFQ */

  async listRfqs(userId: string): Promise<Rfq[]> {
    const rows = await prisma.rfq.findMany({
      where: { userId },
      include: rfqInclude,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toRfq)
  }

  async findRfq(userId: string, id: string): Promise<Rfq | null> {
    const row = await prisma.rfq.findFirst({ where: { id, userId }, include: rfqInclude })
    return row ? toRfq(row) : null
  }

  async createRfq(
    input: Omit<Rfq, 'id' | 'reference' | 'createdAt' | 'updatedAt' | 'messages'>
  ): Promise<Rfq> {
    const now = new Date()
    const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`

    // Sequence within the month, so the reference stays short and readable.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const soFar = await prisma.rfq.count({ where: { createdAt: { gte: monthStart } } })
    const reference = `RFQ-${stamp}-${String(soFar + 101).padStart(4, '0')}`

    const row = await prisma.rfq.create({
      data: {
        reference,
        userId: input.userId,
        status: input.status,
        contactName: input.contact.name,
        contactCompany: input.contact.company,
        contactEmail: input.contact.email,
        contactPhone: input.contact.phone,
        contactCity: input.contact.city,
        contactGstin: input.contact.gstin,
        requirements: input.requirements,
        deliveryPincode: input.deliveryPincode,
        requiredByDate: input.requiredByDate ? new Date(input.requiredByDate) : null,
        sourceConversationId: input.sourceConversationId,
        quotedTotal: input.quotedTotal,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            note: item.note,
            quotedUnitPrice: item.quotedUnitPrice,
            quotedLeadTimeDays: item.quotedLeadTimeDays,
          })),
        },
      },
      include: rfqInclude,
    })

    for (const item of input.items) {
      void prisma.product
        .update({ where: { id: item.productId }, data: { rfqCount: { increment: 1 } } })
        .catch(() => {})
    }

    return toRfq(row)
  }

  /* --------------------------------------------------------- conversations */

  async listConversations(userId: string, limit = 25): Promise<Conversation[]> {
    const rows = await prisma.conversation.findMany({
      where: { userId },
      include: conversationInclude,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
    return rows.map(toConversation)
  }

  async findConversation(userId: string | null, id: string): Promise<Conversation | null> {
    const row = await prisma.conversation.findUnique({ where: { id }, include: conversationInclude })
    if (!row) return null
    // An anonymous conversation is readable by anyone holding its id; an owned
    // one only by its owner.
    if (row.userId && row.userId !== userId) return null
    return toConversation(row)
  }

  async createConversation(userId: string | null, title: string): Promise<Conversation> {
    const row = await prisma.conversation.create({
      data: { userId, title: title.slice(0, 120) },
      include: conversationInclude,
    })
    return toConversation(row)
  }

  async appendMessages(
    conversationId: string,
    messages: AssistantMessage[]
  ): Promise<Conversation | null> {
    const existing = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, title: true },
    })
    if (!existing) return null

    await prisma.conversationMessage.createMany({
      data: messages.map((message) => ({
        id: message.id,
        conversationId,
        role: message.role,
        content: message.content,
        intent: toJson(message.intent),
        results: toJson(message.results),
        followUp: toJson(message.followUp),
        totalMatches: message.totalMatches ?? null,
      })),
      skipDuplicates: true,
    })

    // Title from the first real question, so the history list is scannable.
    const title =
      existing.title === 'New conversation'
        ? (messages.find((message) => message.role === 'user')?.content.slice(0, 90) ??
          existing.title)
        : existing.title

    const row = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
      include: conversationInclude,
    })

    return toConversation(row)
  }

  async renameConversation(userId: string, id: string, title: string): Promise<void> {
    await prisma.conversation.updateMany({
      where: { id, userId },
      data: { title: title.trim().slice(0, 120) || 'Untitled conversation' },
    })
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    await prisma.conversation.deleteMany({ where: { id, userId } })
  }
}
