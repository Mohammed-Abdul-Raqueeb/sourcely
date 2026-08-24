import 'server-only'
import type { Conversation } from '@/lib/domain/search'
import type { Rfq, Role, SearchEvent, User } from '@/lib/domain/account'
import { prisma } from '@/server/db/prisma'
import type { AdminRepository, RfqUpdate } from '../types'
import {
  conversationInclude,
  rfqInclude,
  toConversation,
  toRfq,
  toSearchEvent,
  toUser,
} from './mappers'

/**
 * PostgreSQL admin driver.
 *
 * Cross-tenant by definition, which is why it is a separate interface behind
 * `requireRole('staff')`. `toUser` never selects `passwordHash`, so the hash
 * cannot reach a component even by accident.
 */
export class PrismaAdminRepository implements AdminRepository {
  async listUsers(limit = 200): Promise<User[]> {
    const rows = await prisma.user.findMany({
      orderBy: { lastActiveAt: 'desc' },
      take: limit,
    })
    return rows.map(toUser)
  }

  async findUser(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { id } })
    return row ? toUser(row) : null
  }

  async countUsers(): Promise<number> {
    return prisma.user.count()
  }

  /* -------------------------------------------------------------------- RFQ */

  async listAllRfqs(limit = 200): Promise<Rfq[]> {
    const rows = await prisma.rfq.findMany({
      include: rfqInclude,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
    return rows.map(toRfq)
  }

  async findAnyRfq(id: string): Promise<Rfq | null> {
    const row = await prisma.rfq.findUnique({ where: { id }, include: rfqInclude })
    return row ? toRfq(row) : null
  }

  async updateRfq(id: string, patch: RfqUpdate): Promise<Rfq | null> {
    const existing = await prisma.rfq.findUnique({ where: { id }, include: rfqInclude })
    if (!existing) return null

    return prisma.$transaction(async (tx) => {
      if (patch.quotes) {
        for (const [productId, quote] of Object.entries(patch.quotes)) {
          await tx.rfqItem.updateMany({
            where: { rfqId: id, productId },
            data: {
              quotedUnitPrice: quote.unitPrice,
              quotedLeadTimeDays: quote.leadTimeDays,
            },
          })
        }
      }

      // The header total is always recomputed from the line items. A quoted
      // total that disagrees with its own lines is the fastest way to lose a
      // buyer's trust in the whole quotation.
      const items = await tx.rfqItem.findMany({ where: { rfqId: id } })
      const priced = items.filter((item) => item.quotedUnitPrice != null)
      const quotedTotal =
        priced.length > 0
          ? priced.reduce((sum, item) => sum + (item.quotedUnitPrice ?? 0) * item.quantity, 0)
          : null

      const row = await tx.rfq.update({
        where: { id },
        data: {
          ...(patch.status && { status: patch.status }),
          ...(patch.validUntil !== undefined && {
            validUntil: patch.validUntil ? new Date(patch.validUntil) : null,
          }),
          quotedTotal,
        },
        include: rfqInclude,
      })

      return toRfq(row)
    })
  }

  async addRfqMessage(
    id: string,
    author: { id: string; role: Role },
    body: string
  ): Promise<Rfq | null> {
    const existing = await prisma.rfq.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return null

    await prisma.rfqMessage.create({
      data: {
        rfqId: id,
        authorId: author.id,
        authorRole: author.role,
        body: body.trim().slice(0, 4000),
      },
    })

    // Touch the parent so the queue re-sorts and `updatedAt` reflects the
    // thread, not just the status.
    const row = await prisma.rfq.update({
      where: { id },
      data: { updatedAt: new Date() },
      include: rfqInclude,
    })

    return toRfq(row)
  }

  /* -------------------------------------------------------------- analytics */

  async listAllSearchEvents(limit = 500): Promise<SearchEvent[]> {
    const rows = await prisma.searchEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toSearchEvent)
  }

  async listAllConversations(limit = 100): Promise<Conversation[]> {
    const rows = await prisma.conversation.findMany({
      include: conversationInclude,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
    return rows.map(toConversation)
  }

  async countSavedForProduct(productId: string): Promise<number> {
    return prisma.savedProduct.count({ where: { productId } })
  }
}
