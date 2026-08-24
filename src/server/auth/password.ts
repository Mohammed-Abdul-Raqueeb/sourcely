import 'server-only'
import bcrypt from 'bcryptjs'

/**
 * Password hashing.
 *
 * bcrypt at cost 12 — roughly 250ms per hash on commodity hardware, which is
 * the point: it makes an offline dictionary attack against a stolen dump
 * expensive, and it is imperceptible on a login form.
 *
 * Argon2id would be the stronger choice, but it needs a native module and this
 * project has to `npm install` cleanly on Windows without a build toolchain.
 * Recorded here so the trade-off is deliberate rather than forgotten.
 */

const COST = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    // A malformed hash in the store must read as "wrong password", never as
    // an exception that a caller might interpret as success.
    return false
  }
}

/**
 * A dummy hash with the same cost as a real one.
 *
 * Login compares against this when the email does not exist, so a missing
 * account and a wrong password take the same time. Without it, response
 * latency is a user-enumeration oracle.
 */
export const DUMMY_HASH = '$2b$12$Q8kMEHHY2S9M0mVJcnGVDeE9y0y7lJKlgNJhWQFqBqNjXNtHwGZBe'

/* -------------------------------------------------------------------------- */
/* Strength                                                                   */
/* -------------------------------------------------------------------------- */

export interface PasswordCheck {
  ok: boolean
  score: 0 | 1 | 2 | 3 | 4
  label: string
  problems: string[]
}

/**
 * A handful of common passwords rejected outright. Not a substitute for a
 * breach corpus — phase 6 should check against one — but it stops the
 * passwords that actually get chosen.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', 'qwerty123',
  'admin123', 'welcome1', 'letmein1', 'iloveyou', 'sourcely', 'sourcely1',
  'abc12345', 'changeme', 'passw0rd', '11111111', 'qwertyui',
])

export function checkPassword(password: string, email = ''): PasswordCheck {
  const problems: string[] = []

  if (password.length < 8) problems.push('Use at least 8 characters')
  if (password.length > 200) problems.push('Use fewer than 200 characters')
  if (!/[a-z]/.test(password)) problems.push('Include a lowercase letter')
  if (!/[A-Z0-9]/.test(password)) problems.push('Include a capital letter or a number')
  if (COMMON.has(password.toLowerCase())) problems.push('This password is too common')

  const localPart = email.split('@')[0]?.toLowerCase()
  if (localPart && localPart.length > 2 && password.toLowerCase().includes(localPart)) {
    problems.push('Do not use your email address in your password')
  }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^\w\s]/.test(password)) score++

  const bounded = Math.min(4, score) as PasswordCheck['score']
  const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const

  return {
    ok: problems.length === 0,
    score: bounded,
    label: LABELS[bounded],
    problems,
  }
}
