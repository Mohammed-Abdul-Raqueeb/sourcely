/**
 * Mints a session cookie for the demo buyer and prints it.
 *
 * Development and testing only. It exists so the signed-in surfaces can be
 * exercised over HTTP without driving a browser: it writes a real session
 * record through the same repository the server uses, flushes it to
 * `.data/store.json`, and signs a token the server will accept.
 *
 * Run BEFORE starting the server — the server loads the store once per
 * process, so a session added afterwards is invisible to it.
 *
 *   npx tsx --conditions=react-server scripts/mint-session.ts [admin]
 */

import { getAccountRepository } from '../src/server/repositories'
import { signSessionToken, SESSION_COOKIE } from '../src/server/auth/tokens'
import { DEMO_ACCOUNTS, flush } from '../src/server/repositories/memory/store'

async function main() {
  const wantAdmin = process.argv[2] === 'admin'
  const email = wantAdmin ? DEMO_ACCOUNTS.admin.email : DEMO_ACCOUNTS.customer.email

  const accounts = getAccountRepository()
  const user = await accounts.findUserByEmail(email)
  if (!user) throw new Error(`demo user ${email} not found — delete .data and retry`)

  const session = await accounts.createSession(user.id, 'smoke-test/1.0 (scripted)')
  const token = await signSessionToken({
    sid: session.id,
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  })

  await flush()

  // stderr carries the human-readable part so stdout is pipeable.
  console.error(`minted session for ${user.name} <${user.email}> (${user.role})`)
  process.stdout.write(`${SESSION_COOKIE}=${token}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
