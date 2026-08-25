/**
 * Vercel build entry — wired via `buildCommand` in vercel.json.
 *
 * Two steps, deliberately in this order:
 *
 *   1. `prisma migrate deploy` — applies any pending migrations and nothing
 *      else. It never generates, never resets, never seeds; on an up-to-date
 *      database it is a no-op. It runs BEFORE `next build` because the build
 *      prerenders the marketing catalogue from the live database, so the
 *      schema must already be current when those queries run.
 *   2. `npm run build` — the application's ordinary Next.js build, unchanged.
 *
 * Seeding is intentionally absent. `npm run db:seed` is a one-time,
 * operator-run step (see DEPLOY-VERCEL.md); a deploy pipeline that rewrites
 * catalogue rows on every push would fight the admin console's edits.
 *
 * The environment checks fail the build with the actual problem named,
 * because the alternative is a Prisma stack trace from four layers down.
 */
import { spawnSync } from 'node:child_process'

function fail(message) {
  console.error(`\n[vercel-build] ${message}\n`)
  process.exit(1)
}

function run(command, args) {
  console.log(`\n[vercel-build] ${command} ${args.join(' ')}\n`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.env.DATA_DRIVER?.toLowerCase() !== 'postgres') {
  fail(
    'DATA_DRIVER must be "postgres" on Vercel — the memory driver persists to a ' +
      'filesystem that does not survive a function invocation. Set DATA_DRIVER=postgres ' +
      'in the Vercel project environment variables (all environments that build).'
  )
}

if (!process.env.DATABASE_URL) {
  fail(
    'DATABASE_URL is not set. Add your PostgreSQL connection string to the Vercel ' +
      'project environment variables. The database must have the pgvector extension ' +
      'available and must be migrated and seeded before the first deploy — see ' +
      'DEPLOY-VERCEL.md.'
  )
}

run('npx', ['prisma', 'migrate', 'deploy'])
run('npm', ['run', 'build'])
