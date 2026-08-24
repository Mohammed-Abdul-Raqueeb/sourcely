import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { User } from '@/lib/domain/account'
import type {
  AccountRepository,
  CreateUserInput,
  SessionRecord,
  UserRecord,
} from '../types'
import { getStore, newId, persist } from './store'
import { sessionTtlHours } from '@/server/auth/tokens'

/**
 * Identity persistence for the memory driver.
 *
 * Two invariants this file exists to hold:
 *
 *   1. Email lookup is case-insensitive and whitespace-trimmed. "Rajesh@X.in"
 *      and "rajesh@x.in " are the same account, and treating them as two is a
 *      support ticket waiting to happen.
 *   2. Reset tokens are stored as a SHA-256 hash. A stolen store file must not
 *      hand the thief a working password-reset link for every user.
 */

const RESET_TTL_MS = 60 * 60 * 1000 // one hour

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time compare so token verification is not a timing oracle. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

export class MemoryAccountRepository implements AccountRepository {
  /* ------------------------------------------------------------------ users */

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const store = await getStore()
    const target = normaliseEmail(email)
    return store.users.find((user) => normaliseEmail(user.email) === target) ?? null
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const store = await getStore()
    return store.users.find((user) => user.id === id) ?? null
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const store = await getStore()
    const now = new Date().toISOString()

    const user: UserRecord = {
      id: newId('user'),
      email: normaliseEmail(input.email),
      name: input.name.trim(),
      role: input.role ?? 'customer',
      company: input.company?.trim() || null,
      phone: input.phone?.trim() || null,
      city: input.city?.trim() || null,
      gstin: input.gstin?.trim().toUpperCase() || null,
      avatarUrl: null,
      // Email verification is a phase 6 concern; the flag exists so the
      // schema does not have to change when the mailer is wired up.
      emailVerified: false,
      passwordHash: input.passwordHash,
      createdAt: now,
      lastActiveAt: now,
    }

    store.users.push(user)
    persist()
    return user
  }

  async updateUser(
    id: string,
    patch: Partial<Omit<User, 'id' | 'role'>>
  ): Promise<UserRecord | null> {
    const store = await getStore()
    const user = store.users.find((entry) => entry.id === id)
    if (!user) return null

    // Role is deliberately absent from the patch type: privilege changes go
    // through an explicit admin path, never a profile form.
    if (patch.name !== undefined) user.name = patch.name.trim()
    if (patch.company !== undefined) user.company = patch.company?.trim() || null
    if (patch.phone !== undefined) user.phone = patch.phone?.trim() || null
    if (patch.city !== undefined) user.city = patch.city?.trim() || null
    if (patch.gstin !== undefined) user.gstin = patch.gstin?.trim().toUpperCase() || null
    if (patch.avatarUrl !== undefined) user.avatarUrl = patch.avatarUrl
    if (patch.email !== undefined) {
      user.email = normaliseEmail(patch.email)
      user.emailVerified = false
    }

    persist()
    return user
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const store = await getStore()
    const user = store.users.find((entry) => entry.id === id)
    if (!user) return
    user.passwordHash = passwordHash
    persist()
  }

  async touchUser(id: string): Promise<void> {
    const store = await getStore()
    const user = store.users.find((entry) => entry.id === id)
    if (!user) return
    user.lastActiveAt = new Date().toISOString()
    // Deliberately not persisted: a last-seen timestamp is not worth a disk
    // write on every page view. It survives in memory for the process.
  }

  /* --------------------------------------------------------------- sessions */

  async createSession(userId: string, userAgent: string): Promise<SessionRecord> {
    const store = await getStore()
    const now = Date.now()

    const session: SessionRecord = {
      id: newId('sess'),
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + sessionTtlHours() * 3_600_000).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      userAgent: userAgent.slice(0, 180),
      revokedAt: null,
    }

    store.sessions.push(session)

    // Opportunistic cleanup — expired rows serve no purpose and this store has
    // no background job to sweep them.
    store.sessions = store.sessions.filter(
      (entry) => new Date(entry.expiresAt).getTime() > now - 7 * 86_400_000
    )

    persist()
    return session
  }

  async findActiveSession(sessionId: string): Promise<SessionRecord | null> {
    const store = await getStore()
    const session = store.sessions.find((entry) => entry.id === sessionId)
    if (!session) return null
    if (session.revokedAt) return null
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null

    session.lastSeenAt = new Date().toISOString()
    return session
  }

  async listSessions(userId: string): Promise<SessionRecord[]> {
    const store = await getStore()
    const now = Date.now()
    return store.sessions
      .filter(
        (entry) =>
          entry.userId === userId &&
          !entry.revokedAt &&
          new Date(entry.expiresAt).getTime() > now
      )
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
  }

  async revokeSession(sessionId: string): Promise<void> {
    const store = await getStore()
    const session = store.sessions.find((entry) => entry.id === sessionId)
    if (!session) return
    session.revokedAt = new Date().toISOString()
    persist()
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const store = await getStore()
    const now = new Date().toISOString()
    for (const session of store.sessions) {
      if (session.userId !== userId) continue
      if (exceptSessionId && session.id === exceptSessionId) continue
      session.revokedAt ??= now
    }
    persist()
  }

  /* ---------------------------------------------------------- reset tokens */

  async createResetToken(userId: string): Promise<string> {
    const store = await getStore()

    // Any outstanding token for this user is invalidated — two live reset
    // links doubles the window an attacker has to work with.
    for (const entry of store.resetTokens) {
      if (entry.userId === userId && !entry.usedAt) {
        entry.usedAt = new Date().toISOString()
      }
    }

    const token = randomBytes(32).toString('base64url')
    store.resetTokens.push({
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
      usedAt: null,
    })

    persist()
    return token
  }

  async consumeResetToken(token: string): Promise<string | null> {
    const store = await getStore()
    const candidate = hashToken(token)

    const entry = store.resetTokens.find(
      (record) => safeEqualHex(record.tokenHash, candidate) && !record.usedAt
    )
    if (!entry) return null
    if (new Date(entry.expiresAt).getTime() <= Date.now()) return null

    entry.usedAt = new Date().toISOString()
    persist()
    return entry.userId
  }
}
