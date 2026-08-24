import 'server-only'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton.
 *
 * Held on `globalThis` because Next re-evaluates modules on every hot reload in
 * development. Without this, a few minutes of editing opens dozens of
 * connection pools and Postgres starts refusing connections — a failure that
 * looks like a database problem and is not.
 */

declare global {
  var __sourcelyPrisma: PrismaClient | undefined
}

function create(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  })
}

export const prisma: PrismaClient = globalThis.__sourcelyPrisma ?? create()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__sourcelyPrisma = prisma
}

/**
 * Fails fast with an actionable message.
 *
 * A missing `DATABASE_URL` with `DATA_DRIVER=postgres` otherwise surfaces as a
 * generic Prisma initialisation error on the first request, several layers
 * away from the thing that is actually wrong.
 */
export function assertDatabaseConfigured(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATA_DRIVER=postgres requires DATABASE_URL. ' +
        'Start the bundled database with `docker compose up -d`, then run ' +
        '`npm run db:migrate && npm run db:seed`.'
    )
  }
}
