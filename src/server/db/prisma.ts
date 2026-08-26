import 'server-only'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma client singleton.
 *
 * Held on `globalThis` because Next re-evaluates modules on every hot reload in
 * development. Without this, a few minutes of editing opens dozens of
 * connection pools and Postgres starts refusing connections — a failure that
 * looks like a database problem and is not.
 *
 * Every find query defaults to `relationLoadStrategy: 'join'` (the
 * `relationJoins` preview feature): a product read with its eight relations is
 * one SQL statement instead of nine. Against a same-host database the default
 * per-relation strategy is only noise, but production runs a serverless
 * function talking to managed Postgres over a real network hop, where a
 * catalogue page was measured at 46 sequential statements — the difference
 * between ~200ms and ~7s. Results are identical either way; only the SQL
 * shape changes. Write operations are not wrapped: Prisma does not accept the
 * option there.
 */

function withJoinStrategy(): unknown {
  const join = <A, R>({ args, query }: { args: A; query: (args: A) => R }): R =>
    query({ relationLoadStrategy: 'join', ...args } as A)

  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  }).$extends({
    query: {
      $allModels: {
        findMany: join,
        findFirst: join,
        findUnique: join,
        findFirstOrThrow: join,
        findUniqueOrThrow: join,
      },
    },
  })
}

/**
 * The extended client's structural type is unwieldy; every call site uses the
 * ordinary model API, which the extension preserves, so it is presented as a
 * plain `PrismaClient`.
 */
function create(): PrismaClient {
  return withJoinStrategy() as PrismaClient
}

declare global {
  var __sourcelyPrisma: PrismaClient | undefined
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
