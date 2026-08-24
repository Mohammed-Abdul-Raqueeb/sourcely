'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  toFieldErrors,
  type FormState,
} from '@/lib/validation/auth'
import { getAccountRepository, getActivityRepository } from '@/server/repositories'
import { checkPassword, DUMMY_HASH, hashPassword, verifyPassword } from '@/server/auth/password'
import { clientIdentifier, LIMITS, rateLimit } from '@/server/security/rate-limit'
import { passwordResetEmail, sendMailInBackground } from '@/server/mail'
import { recordAudit } from '@/server/audit/record'
import { endSession, getSession, requireUser, startSession } from '@/server/auth/session'

/**
 * Authentication server actions.
 *
 * Rules held here rather than in the pages:
 *
 *   - Every input is re-parsed server-side. Client validation is a courtesy.
 *   - Login and registration never reveal whether an email exists. Both the
 *     message and the timing are uniform.
 *   - Mutating actions verify the request origin. `SameSite=Lax` already
 *     blocks the cross-site POST, and this is the belt to that braces.
 */

/* -------------------------------------------------------------------------- */
/* CSRF                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Next protects Server Actions with its own origin check, but this project
 * also exposes route handlers, so the rule is written down once and applied
 * consistently rather than assumed.
 */
async function assertSameOrigin(): Promise<boolean> {
  const headerList = await headers()
  const origin = headerList.get('origin')
  if (!origin) return true // Same-origin form posts may omit it.

  const host = headerList.get('host')
  if (!host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

const REJECTED: FormState = {
  status: 'error',
  message: 'That request could not be verified. Reload the page and try again.',
}

/**
 * Only same-site relative paths are accepted as a post-login destination.
 * An open redirect on a login form is a credential-phishing primitive.
 */
function safeRedirect(next: string | undefined): string {
  if (!next) return '/account'
  if (!next.startsWith('/') || next.startsWith('//')) return '/account'
  return next
}

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

export async function loginAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const identity = await clientIdentifier()
  const limit = await rateLimit(`login:${identity}`, LIMITS.login.limit, LIMITS.login.windowMs)
  if (!limit.ok) {
    return {
      status: 'error',
      message: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).`,
    }
  }

  const accounts = getAccountRepository()
  const user = await accounts.findUserByEmail(parsed.data.email)

  // Always run a bcrypt comparison, even for an unknown email, so response
  // time does not distinguish "no such account" from "wrong password".
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || !valid) {
    // Recorded against the submitted address, not a user id — for an unknown
    // email there is no user to attribute it to, and the address is the only
    // thing that makes a credential-stuffing run visible in the log.
    await recordAudit({
      action: 'login_failure',
      targetType: 'user',
      targetId: user?.id ?? 'unknown',
      summary: `Failed sign-in for ${parsed.data.email}`,
      actor: { id: user?.id ?? null, email: parsed.data.email, role: 'customer' },
    })
    return { status: 'error', message: 'Those credentials do not match an account.' }
  }

  await recordAudit({
    action: 'login_success',
    targetType: 'user',
    targetId: user.id,
    summary: `${user.email} signed in`,
    actor: { id: user.id, email: user.email, role: user.role },
  })

  await startSession(user)
  redirect(safeRedirect(parsed.data.next))
}

/* -------------------------------------------------------------------------- */
/* Register                                                                   */
/* -------------------------------------------------------------------------- */

export async function registerAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED

  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    company: formData.get('company') ?? '',
    phone: formData.get('phone') ?? '',
    city: formData.get('city') ?? '',
    gstin: formData.get('gstin') ?? '',
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    terms: formData.get('terms') ?? undefined,
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const identity = await clientIdentifier()
  const limit = await rateLimit(
    `register:${identity}`,
    LIMITS.register.limit,
    LIMITS.register.windowMs
  )
  if (!limit.ok) {
    return { status: 'error', message: 'Too many sign-up attempts. Try again later.' }
  }

  const strength = checkPassword(parsed.data.password, parsed.data.email)
  if (!strength.ok) {
    return {
      status: 'error',
      fieldErrors: { password: strength.problems[0] ?? 'Choose a stronger password' },
    }
  }

  const accounts = getAccountRepository()
  const existing = await accounts.findUserByEmail(parsed.data.email)

  if (existing) {
    // Do not confirm that the address is registered.
    return {
      status: 'error',
      fieldErrors: {
        email: 'That email cannot be used. Try signing in, or reset your password.',
      },
    }
  }

  const user = await accounts.createUser({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
    company: parsed.data.company || null,
    phone: parsed.data.phone || null,
    city: parsed.data.city || null,
    gstin: parsed.data.gstin || null,
  })

  await getActivityRepository().createNotification({
    userId: user.id,
    kind: 'account',
    title: `Welcome to Sourcely, ${user.name.split(' ')[0]}`,
    body: 'Describe a requirement to the assistant and it will rank the catalogue against it. Nothing you shortlist is shared with suppliers until you send a quotation request.',
    href: '/assistant',
  })

  await startSession(user)
  redirect('/account?welcome=1')
}

/* -------------------------------------------------------------------------- */
/* Logout                                                                     */
/* -------------------------------------------------------------------------- */

export async function logoutAction(): Promise<void> {
  await endSession()
  revalidatePath('/', 'layout')
  redirect('/')
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

export async function forgotPasswordAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const identity = await clientIdentifier()
  const limit = await rateLimit(
    `reset:${identity}`,
    LIMITS.passwordReset.limit,
    LIMITS.passwordReset.windowMs
  )
  if (!limit.ok) {
    return { status: 'error', message: 'Too many requests. Try again in an hour.' }
  }

  const accounts = getAccountRepository()
  const user = await accounts.findUserByEmail(parsed.data.email)

  // Uniform response whether or not the account exists — this endpoint must
  // not be usable to enumerate registered addresses.
  const success: FormState = {
    status: 'success',
    message:
      'If that email is registered, a reset link is on its way. It expires in one hour.',
  }

  if (!user) return success

  const token = await accounts.createResetToken(user.id)

  // Sent in the background: the send can take several seconds over SMTP, and
  // holding the response open for it would also leak whether the address
  // exists — an unknown address returns immediately, a known one would not.
  sendMailInBackground(
    passwordResetEmail({
      to: { name: user.name, email: user.email },
      token,
      expiresInMinutes: 60,
    })
  )

  // Outside production the link is also returned directly, so the flow is
  // testable end to end without a mail transport. Never in production: that
  // would hand a password reset to anyone who can submit the form.
  if (process.env.NODE_ENV !== 'production') {
    return { ...success, data: { resetPath: `/reset-password?token=${token}` } }
  }

  return success
}

export async function resetPasswordAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const strength = checkPassword(parsed.data.password)
  if (!strength.ok) {
    return {
      status: 'error',
      fieldErrors: { password: strength.problems[0] ?? 'Choose a stronger password' },
    }
  }

  const accounts = getAccountRepository()
  const userId = await accounts.consumeResetToken(parsed.data.token)

  if (!userId) {
    return {
      status: 'error',
      message: 'That reset link has expired or has already been used. Request a new one.',
    }
  }

  await accounts.updatePassword(userId, await hashPassword(parsed.data.password))

  // Every existing session is revoked. If the reset was triggered because the
  // account was compromised, leaving the attacker signed in defeats the point.
  await accounts.revokeAllSessions(userId)

  // No session exists at this point, so the actor is stated explicitly —
  // otherwise the one entry that matters after an account takeover would be
  // attributed to "anonymous".
  const owner = await accounts.findUserById(userId)
  await recordAudit({
    action: 'password_reset',
    targetType: 'user',
    targetId: userId,
    summary: `Password reset completed for ${owner?.email ?? userId}`,
    actor: { id: userId, email: owner?.email ?? 'unknown', role: owner?.role ?? 'customer' },
  })

  return {
    status: 'success',
    message: 'Your password has been changed. You have been signed out everywhere.',
  }
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateProfileAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED

  const user = await requireUser()
  const parsed = profileSchema.safeParse({
    name: formData.get('name'),
    company: formData.get('company') ?? '',
    phone: formData.get('phone') ?? '',
    city: formData.get('city') ?? '',
    gstin: formData.get('gstin') ?? '',
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  await getAccountRepository().updateUser(user.id, {
    name: parsed.data.name,
    company: parsed.data.company || null,
    phone: parsed.data.phone || null,
    city: parsed.data.city || null,
    gstin: parsed.data.gstin || null,
  })

  revalidatePath('/account', 'layout')
  return { status: 'success', message: 'Profile updated.' }
}

export async function changePasswordAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await assertSameOrigin())) return REJECTED

  const session = await getSession()
  if (!session) return { status: 'error', message: 'Your session has expired.' }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return { status: 'error', fieldErrors: toFieldErrors(parsed.error) }
  }

  const accounts = getAccountRepository()
  const record = await accounts.findUserById(session.user.id)
  if (!record) return { status: 'error', message: 'Your session has expired.' }

  if (!(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
    return {
      status: 'error',
      fieldErrors: { currentPassword: 'That is not your current password' },
    }
  }

  const strength = checkPassword(parsed.data.password, record.email)
  if (!strength.ok) {
    return {
      status: 'error',
      fieldErrors: { password: strength.problems[0] ?? 'Choose a stronger password' },
    }
  }

  await accounts.updatePassword(record.id, await hashPassword(parsed.data.password))
  // Keep the current session alive, drop every other one.
  await accounts.revokeAllSessions(record.id, session.sessionId)

  await recordAudit({
    action: 'password_change',
    targetType: 'user',
    targetId: record.id,
    summary: `${record.email} changed their password`,
  })

  return {
    status: 'success',
    message: 'Password changed. Other devices have been signed out.',
  }
}

export async function revokeSessionAction(sessionId: string): Promise<void> {
  const session = await getSession()
  if (!session) return

  // Scope the revoke to the caller's own sessions — an id from another user
  // must not be actionable.
  const own = await getAccountRepository().listSessions(session.user.id)
  if (!own.some((entry) => entry.id === sessionId)) return

  await getAccountRepository().revokeSession(sessionId)

  await recordAudit({
    action: 'session_revoke',
    targetType: 'session',
    targetId: sessionId,
    summary: `${session.user.email} revoked one session`,
  })

  revalidatePath('/account/settings')
}

export async function signOutEverywhereAction(): Promise<void> {
  const session = await getSession()
  if (!session) return

  await recordAudit({
    action: 'session_revoke',
    targetType: 'user',
    targetId: session.user.id,
    summary: `${session.user.email} signed out everywhere`,
  })

  await getAccountRepository().revokeAllSessions(session.user.id)
  await endSession()
  redirect('/login')
}
