import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db/prisma'
import type { AuditEntry, AuditQuery, AuditRepository } from '../types'
import { toJson } from './mappers'

/**
 * PostgreSQL audit trail.
 *
 * Insert and select only. The table has no update or delete path anywhere in
 * the application — retention is a scheduled database job, so an operator
 * cannot quietly remove a row about themselves.
 */

function toEntry(row: Prisma.AuditLogEntryGetPayload<object>): AuditEntry {
  return {
    id: row.id,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    summary: row.summary,
    changes: (row.changes as AuditEntry['changes']) ?? null,
    ipHash: row.ipHash,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }
}

function toWhere(query: AuditQuery): Prisma.AuditLogEntryWhereInput {
  return {
    ...(query.action && { action: query.action }),
    ...(query.actorId && { actorId: query.actorId }),
    ...(query.targetType && { targetType: query.targetType }),
    ...(query.targetId && { targetId: query.targetId }),
  }
}

export class PrismaAuditRepository implements AuditRepository {
  async record(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<AuditEntry> {
    const row = await prisma.auditLogEntry.create({
      data: {
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        summary: entry.summary,
        changes: toJson(entry.changes),
        ipHash: entry.ipHash,
        userAgent: entry.userAgent,
      },
    })
    return toEntry(row)
  }

  async list(query: AuditQuery = {}): Promise<AuditEntry[]> {
    const rows = await prisma.auditLogEntry.findMany({
      where: toWhere(query),
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 200,
    })
    return rows.map(toEntry)
  }

  async count(query: AuditQuery = {}): Promise<number> {
    return prisma.auditLogEntry.count({ where: toWhere(query) })
  }
}
