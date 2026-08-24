import 'server-only'
import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import type { AuditAction, AuditEntry } from '@/server/repositories'
import { getAuditRepository } from '@/server/repositories'
import { getSession } from '@/server/auth/session'
import { clientIdentifier } from '@/server/security/rate-limit'

/**
 * Audit recording.
 *
 * Every privileged action goes through here. Three decisions worth naming:
 *
 * **The IP is hashed, never stored raw.** An audit trail needs to answer "was
 * this the same origin as last time", which a salted hash answers. Storing the
 * address itself turns the log into personal data with a retention obligation
 * and no extra investigative value.
 *
 * **Recording never fails the action.** A write that succeeded but whose audit
 * row failed must not be rolled back and reported as an error — the operator
 * would retry and do it twice. Failures are logged loudly instead.
 *
 * **`changes` carries only the fields that moved.** Snapshotting whole records
 * turns the log into a second copy of the database and buries the one line
 * that matters.
 */

const AUDIT_SALT = process.env.AUDIT_IP_SALT ?? 'sourcely-audit-salt'

function hashIp(address: string): string | null {
  if (!address || address === 'local' || address === 'unknown') return null
  return createHash('sha256').update(`${AUDIT_SALT}:${address}`).digest('hex').slice(0, 32)
}

export interface AuditInput {
  action: AuditAction
  targetType: string
  targetId: string
  summary: string
  changes?: Record<string, { from: unknown; to: unknown }> | null
  /** Overrides the session actor — used by login failure, which has no session. */
  actor?: { id: string | null; email: string; role: AuditEntry['actorRole'] }
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    const session = await getSession()

    const actor =
      input.actor ??
      (session
        ? { id: session.user.id, email: session.user.email, role: session.user.role }
        : { id: null, email: 'anonymous', role: 'customer' as const })

    const headerList = await headers()

    await getAuditRepository().record({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary.slice(0, 500),
      changes: input.changes ?? null,
      ipHash: hashIp(await clientIdentifier()),
      userAgent: headerList.get('user-agent')?.slice(0, 180) ?? null,
    })
  } catch (error) {
    // Never let an audit failure take down the action it was recording.
    console.error('[audit] failed to record', input.action, input.targetId, error)
  }
}

/**
 * Diffs two records down to the fields that actually changed.
 *
 * Arrays are compared by value so a reordered tag list does not read as an
 * edit; `undefined` and `null` are treated as the same absence, because a form
 * that omits a field and a form that clears it mean the same thing here.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null,
  after: T,
  fields: (keyof T)[]
): Record<string, { from: unknown; to: unknown }> | null {
  if (!before) return null

  const changes: Record<string, { from: unknown; to: unknown }> = {}

  for (const field of fields) {
    const from = before[field] ?? null
    const to = after[field] ?? null

    const same = Array.isArray(from) && Array.isArray(to)
      ? JSON.stringify(from) === JSON.stringify(to)
      : from === to

    if (!same) changes[String(field)] = { from, to }
  }

  return Object.keys(changes).length > 0 ? changes : null
}

export const AUDIT_LABELS: Record<AuditAction, string> = {
  product_create: 'Product created',
  product_update: 'Product updated',
  product_status_change: 'Product status changed',
  rfq_status_change: 'Quotation status changed',
  rfq_quote: 'Quotation priced',
  rfq_message: 'Quotation message sent',
  user_role_change: 'User role changed',
  session_revoke: 'Session revoked',
  password_change: 'Password changed',
  password_reset: 'Password reset',
  login_success: 'Signed in',
  login_failure: 'Failed sign-in',
  export: 'Data exported',
  upload: 'File uploaded',
}
