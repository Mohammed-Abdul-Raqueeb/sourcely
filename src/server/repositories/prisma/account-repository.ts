import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { User } from '@/lib/domain/account'
import { prisma } from '@/server/db/prisma'
import { sessionTtlHours } from '@/server/auth/tokens'
import type {
  AccountRepository,
  CreateUserInput,
  SessionRecord,
  UserRecord,
} from '../types'
import { toUserRecord } from './mappers'

/**
 * PostgreSQL identity driver.
 *
 * Behaviourally identical to the memory driver, including the two properties
 * that matter most: email lookup is case-insensitive and whitespace-trimmed,
 * and reset tokens are stored only as a SHA-256 hash.
 */

const RESET_TTL_MS = 60 * 60 * 1000

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

function toSessionRecord(row: {
  id: string
  userId: string
  createdAt: Date
  expiresAt: Date
  lastSeenAt: Date
  userAgent: string
  revokedAt: Date | null
}): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    userAgent: row.userAgent,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

export class PrismaAccountRepository implements AccountRepository {
  /* ------------------------------------------------------------------ users */

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    // The column stores the normalised form, so this is an index hit rather
    // than a case-insensitive scan.
    const row = await prisma.user.findUnique({ where: { email: normaliseEmail(email) } })
    return row ? toUserRecord(row) : null
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const row = await prisma.user.findUnique({ where: { id } })
    return row ? toUserRecord(row) : null
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const row = await prisma.user.create({
      data: {
        email: normaliseEmail(input.email),
        name: input.name.trim(),
        role: input.role ?? 'customer',
        passwordHash: input.passwordHash,
        company: input.company?.trim() || null,
        phone: input.phone?.trim() || null,
        city: input.city?.trim() || null,
        gstin: input.gstin?.trim().toUpperCase() || null,
        emailVerified: false,
      },
    })
    return toUserRecord(row)
  }

  async updateUser(
    id: string,
    patch: Partial<Omit<User, 'id' | 'role'>>
  ): Promise<UserRecord | null> {
    // Role is absent from the patch type on purpose: a privilege change goes
    // through an audited admin path, never a profile form.
    const row = await prisma.user.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.company !== undefined && { company: patch.company?.trim() || null }),
        ...(patch.phone !== undefined && { phone: patch.phone?.trim() || null }),
        ...(patch.city !== undefined && { city: patch.city?.trim() || null }),
        ...(patch.gstin !== undefined && { gstin: patch.gstin?.trim().toUpperCase() || null }),
        ...(patch.avatarUrl !== undefined && { avatarUrl: patch.avatarUrl }),
        ...(patch.email !== undefined && {
          email: normaliseEmail(patch.email),
          emailVerified: false,
        }),
      },
    })
    return toUserRecord(row)
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } })
  }

  async touchUser(id: string): Promise<void> {
    // Fire and forget. A last-seen timestamp is not worth failing a page render
    // over, and it is written on every authenticated request.
    void prisma.user
      .update({ where: { id }, data: { lastActiveAt: new Date() } })
      .catch(() => {})
  }

  /* --------------------------------------------------------------- sessions */

  async createSession(userId: string, userAgent: string): Promise<SessionRecord> {
    const row = await prisma.session.create({
      data: {
        userId,
        userAgent: userAgent.slice(0, 180),
        expiresAt: new Date(Date.now() + sessionTtlHours() * 3_600_000),
      },
    })

    // Opportunistic sweep of long-expired rows. Cheap, indexed, and keeps the
    // table from growing without a scheduled job.
    void prisma.session
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } })
      .catch(() => {})

    return toSessionRecord(row)
  }

  async findActiveSession(sessionId: string): Promise<SessionRecord | null> {
    const row = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null

    void prisma.session
      .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
      .catch(() => {})

    return toSessionRecord(row)
  }

  async listSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    })
    return rows.map(toSessionRecord)
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session
      .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
      .catch(() => {})
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    })
  }

  /* ---------------------------------------------------------- reset tokens */

  async createResetToken(userId: string): Promise<string> {
    // Any outstanding token is burned first: two live reset links double the
    // window an attacker has to work with.
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })

    const token = randomBytes(32).toString('base64url')

    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    })

    return token
  }

  async consumeResetToken(token: string): Promise<string | null> {
    const candidate = hashToken(token)
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: candidate } })

    if (!row || row.usedAt) return null
    if (!safeEqualHex(row.tokenHash, candidate)) return null
    if (row.expiresAt.getTime() <= Date.now()) return null

    // Conditional update, so two simultaneous redemptions cannot both succeed.
    const consumed = await prisma.passwordResetToken.updateMany({
      where: { tokenHash: candidate, usedAt: null },
      data: { usedAt: new Date() },
    })

    return consumed.count === 1 ? row.userId : null
  }
}
