/**
 * Authentication and account-store smoke test.
 *
 * Run: npm run smoke:auth
 *
 * Exercises the pieces that are genuinely dangerous to get wrong — password
 * hashing, token verification, session revocation, reset-token single-use, and
 * per-user scoping in the activity repository. Runs against a scratch data
 * directory so it never touches the development store.
 */

process.env.SOURCELY_DATA_DIR ??= '.data-test'
process.env.AUTH_SECRET ??= 'test-secret-key-that-is-at-least-32-characters-long'

import { rm } from 'node:fs/promises'
import { checkPassword, DUMMY_HASH, hashPassword, verifyPassword } from '../src/server/auth/password'
import { signSessionToken, verifySessionToken } from '../src/server/auth/tokens'
import { rateLimit, rateLimitBackend } from '../src/server/security/rate-limit'
import { MemoryAccountRepository } from '../src/server/repositories/memory/account-repository'
import { MemoryActivityRepository } from '../src/server/repositories/memory/activity-repository'
import { DEMO_ACCOUNTS, flush } from '../src/server/repositories/memory/store'

let failures = 0
let checks = 0

function check(label: string, condition: boolean, detail = ''): void {
  checks++
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
  if (!condition) failures++
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(74)}\n${title}\n${'─'.repeat(74)}`)
}

async function main() {
  // Start from a clean slate so results do not depend on a previous run.
  await rm('.data-test', { recursive: true, force: true }).catch(() => {})

  const accounts = new MemoryAccountRepository()
  const activity = new MemoryActivityRepository()

  /* ---------------------------------------------------------------- passwords */
  section('PASSWORDS')

  const hash = await hashPassword('Sourcely2026')
  check('hash is a bcrypt digest', /^\$2[aby]\$\d{2}\$/.test(hash), hash.slice(0, 7))
  check('hash cost is 12', hash.startsWith('$2b$12$') || hash.startsWith('$2a$12$'))
  check('correct password verifies', await verifyPassword('Sourcely2026', hash))
  check('wrong password rejects', !(await verifyPassword('Sourcely2027', hash)))
  check('empty password rejects', !(await verifyPassword('', hash)))
  check('malformed hash rejects rather than throws', !(await verifyPassword('x', 'not-a-hash')))
  check(
    'the dummy hash is a real bcrypt digest (timing defence works)',
    /^\$2[aby]\$12\$/.test(DUMMY_HASH)
  )
  check(
    'two hashes of the same password differ (salted)',
    (await hashPassword('Sourcely2026')) !== hash
  )

  check('rejects a short password', !checkPassword('Abc123').ok)
  check('rejects a common password', !checkPassword('password123').ok)
  check(
    'rejects a password containing the email local part',
    !checkPassword('rajeshkumar99', 'rajesh@deccan.in').ok,
    checkPassword('rajeshkumar99', 'rajesh@deccan.in').problems[0] ?? ''
  )
  check('accepts a reasonable password', checkPassword('Sourcely2026', 'a@b.in').ok)

  /* ------------------------------------------------------------------ tokens */
  section('SESSION TOKENS')

  const token = await signSessionToken({
    sid: 'sess_test',
    sub: 'user_test',
    role: 'customer',
    name: 'Test Buyer',
    email: 'test@example.in',
  })

  const claims = await verifySessionToken(token)
  check('valid token verifies', claims !== null)
  check('subject round-trips', claims?.sub === 'user_test')
  check('session id round-trips', claims?.sid === 'sess_test')
  check('role round-trips', claims?.role === 'customer')

  check('tampered payload rejects', (await verifySessionToken(`${token}x`)) === null)
  check('garbage rejects', (await verifySessionToken('not.a.token')) === null)
  check('empty string rejects', (await verifySessionToken('')) === null)

  const parts = token.split('.')
  const forged = `${parts[0]}.${parts[1]}.${'A'.repeat((parts[2] ?? '').length)}`
  check('forged signature rejects', (await verifySessionToken(forged)) === null)

  /* --------------------------------------------------------------- accounts */
  section('ACCOUNTS')

  const demo = await accounts.findUserByEmail(DEMO_ACCOUNTS.customer.email)
  check('demo customer is seeded', demo !== null, demo?.name ?? 'missing')
  check(
    'demo password works through the real verify path',
    demo != null && (await verifyPassword(DEMO_ACCOUNTS.customer.password, demo.passwordHash))
  )

  const admin = await accounts.findUserByEmail(DEMO_ACCOUNTS.admin.email)
  check('demo admin is seeded with the admin role', admin?.role === 'admin')

  check(
    'email lookup is case-insensitive',
    (await accounts.findUserByEmail(DEMO_ACCOUNTS.customer.email.toUpperCase())) !== null
  )
  check(
    'email lookup trims whitespace',
    (await accounts.findUserByEmail(`  ${DEMO_ACCOUNTS.customer.email}  `)) !== null
  )
  check('unknown email returns null', (await accounts.findUserByEmail('nobody@nowhere.in')) === null)

  const created = await accounts.createUser({
    email: '  New.Buyer@Example.IN ',
    name: '  Neha Sharma  ',
    passwordHash: await hashPassword('Sourcely2026'),
    company: ' Sharma Engineering ',
    gstin: '29aabcs1234a1z5',
  })

  check('new user email is normalised', created.email === 'new.buyer@example.in', created.email)
  check('new user name is trimmed', created.name === 'Neha Sharma', `"${created.name}"`)
  check('new user GSTIN is upper-cased', created.gstin === '29AABCS1234A1Z5', created.gstin ?? '')
  check('new user defaults to the customer role', created.role === 'customer')
  check('new user is not email-verified', created.emailVerified === false)

  /* --------------------------------------------------------------- sessions */
  section('SESSIONS')

  const sessionA = await accounts.createSession(created.id, 'Mozilla/5.0 (Windows NT 10.0) Chrome/120')
  const sessionB = await accounts.createSession(created.id, 'Mozilla/5.0 (iPhone) Safari/17')

  check('session is active immediately', (await accounts.findActiveSession(sessionA.id)) !== null)
  check('two sessions are listed', (await accounts.listSessions(created.id)).length === 2)
  check(
    'user agent is truncated to 180 chars',
    (await accounts.createSession(created.id, 'x'.repeat(500))).userAgent.length === 180
  )

  await accounts.revokeSession(sessionA.id)
  check('revoked session no longer resolves', (await accounts.findActiveSession(sessionA.id)) === null)
  check('the other session survives', (await accounts.findActiveSession(sessionB.id)) !== null)

  await accounts.revokeAllSessions(created.id, sessionB.id)
  check(
    'revoke-all spares the excepted session',
    (await accounts.findActiveSession(sessionB.id)) !== null
  )

  await accounts.revokeAllSessions(created.id)
  check('revoke-all with no exception clears everything', (await accounts.listSessions(created.id)).length === 0)
  check('unknown session id resolves to null', (await accounts.findActiveSession('sess_nope')) === null)

  /* ---------------------------------------------------------- reset tokens */
  section('PASSWORD RESET')

  const resetToken = await accounts.createResetToken(created.id)
  check('reset token is long enough to be unguessable', resetToken.length >= 40, `${resetToken.length} chars`)

  const consumedFor = await accounts.consumeResetToken(resetToken)
  check('valid token resolves to its user', consumedFor === created.id)
  check('the same token cannot be used twice', (await accounts.consumeResetToken(resetToken)) === null)
  check('an unknown token rejects', (await accounts.consumeResetToken('made-up-token')) === null)

  const firstToken = await accounts.createResetToken(created.id)
  const secondToken = await accounts.createResetToken(created.id)
  check(
    'issuing a new reset token invalidates the previous one',
    (await accounts.consumeResetToken(firstToken)) === null
  )
  check('the newest reset token still works', (await accounts.consumeResetToken(secondToken)) === created.id)

  /* -------------------------------------------------------------- activity */
  section('ACTIVITY SCOPING')

  const other = await accounts.createUser({
    email: 'other@example.in',
    name: 'Other Buyer',
    passwordHash: await hashPassword('Sourcely2026'),
  })

  await activity.saveProduct(created.id, 'prod_vtk-bv2s-050', 'mine')
  await activity.saveProduct(other.id, 'prod_dor-drv-050', 'theirs')

  const mine = await activity.listSavedProducts(created.id)
  check('shortlist returns only the caller rows', mine.length === 1, `${mine.length} rows`)
  check('shortlist row is the right product', mine[0]?.productId === 'prod_vtk-bv2s-050')
  check(
    "another user's product is not visible",
    !mine.some((entry) => entry.productId === 'prod_dor-drv-050')
  )

  await activity.saveProduct(created.id, 'prod_vtk-bv2s-050', 'updated note')
  check(
    'saving the same product twice does not duplicate it',
    (await activity.listSavedProducts(created.id)).length === 1
  )

  await activity.unsaveProduct(created.id, 'prod_vtk-bv2s-050')
  check('unsave removes it', (await activity.listSavedProducts(created.id)).length === 0)
  check("unsave did not touch the other user", (await activity.listSavedProducts(other.id)).length === 1)

  // Views de-duplicate per product.
  await activity.recordView(created.id, 'v1', 'prod_tru-pg-100')
  await activity.recordView(created.id, 'v1', 'prod_afx-fcu-600')
  await activity.recordView(created.id, 'v1', 'prod_tru-pg-100')
  const recent = await activity.recentlyViewed(created.id, 10)
  check('recently viewed de-duplicates', recent.length === 2, recent.join(', '))
  check('most recent view is first', recent[0] === 'prod_tru-pg-100')

  // Notifications.
  await activity.createNotification({
    userId: created.id,
    kind: 'system',
    title: 'Test notification',
    body: 'Body',
    href: null,
  })
  check('notification starts unread', (await activity.unreadCount(created.id)) === 1)
  await activity.markAllNotificationsRead(created.id)
  check('mark-all-read clears the count', (await activity.unreadCount(created.id)) === 0)
  check(
    "another user's unread count is unaffected",
    (await activity.unreadCount(other.id)) === 0
  )

  // RFQ reference format.
  const rfq = await activity.createRfq({
    userId: created.id,
    status: 'submitted',
    contact: {
      name: 'Neha Sharma',
      company: 'Sharma Engineering',
      email: 'new.buyer@example.in',
      phone: '',
      city: 'Pune',
      gstin: null,
    },
    items: [
      {
        productId: 'prod_vtk-bv2s-050',
        quantity: 12,
        note: null,
        quotedUnitPrice: null,
        quotedLeadTimeDays: null,
      },
    ],
    requirements: 'Test requirement',
    deliveryPincode: '411001',
    requiredByDate: null,
    sourceConversationId: null,
    quotedTotal: null,
    validUntil: null,
  })

  check('RFQ reference matches RFQ-YYMM-NNNN', /^RFQ-\d{4}-\d{4}$/.test(rfq.reference), rfq.reference)
  check('RFQ is readable by its owner', (await activity.findRfq(created.id, rfq.id)) !== null)
  check("RFQ is NOT readable by another user", (await activity.findRfq(other.id, rfq.id)) === null)

  // Conversations.
  const conversation = await activity.createConversation(created.id, 'New conversation')
  check('conversation belongs to its creator', conversation.userId === created.id)
  check(
    'conversation is not readable by another user',
    (await activity.findConversation(other.id, conversation.id)) === null
  )

  await activity.appendMessages(conversation.id, [
    {
      id: 'm1',
      role: 'user',
      content: 'I need a stainless steel threaded valve for an HVAC riser',
      createdAt: new Date().toISOString(),
    },
  ])
  const titled = await activity.findConversation(created.id, conversation.id)
  check(
    'conversation auto-titles from the first question',
    titled?.title.startsWith('I need a stainless steel') ?? false,
    titled?.title ?? ''
  )

  /* ------------------------------------------------------------ rate limit */
  section('RATE LIMITING')

  const key = `test:${Date.now()}`
  let allowed = 0
  for (let i = 0; i < 12; i++) {
    if ((await rateLimit(key, 10, 60_000)).ok) allowed++
  }
  check('token bucket caps at the limit', allowed === 10, `${allowed} of 12 allowed`)

  const blocked = await rateLimit(key, 10, 60_000)
  check('a blocked call reports retry-after', !blocked.ok && blocked.retryAfter > 0, `${blocked.retryAfter}s`)
  check('a different key has its own bucket', (await rateLimit(`${key}:other`, 10, 60_000)).ok)
  check('the backend is reported', blocked.backend === rateLimitBackend(), blocked.backend)

  /* ----------------------------------------------------------- persistence */
  section('PERSISTENCE')

  await flush()
  check('store flushed to disk without throwing', true)

  await rm('.data-test', { recursive: true, force: true }).catch(() => {})

  console.log(`\n${'='.repeat(74)}`)
  console.log(failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} CHECK(S) FAILED`)
  console.log('='.repeat(74))

  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nSMOKE RUN CRASHED\n', error)
  process.exit(1)
})
