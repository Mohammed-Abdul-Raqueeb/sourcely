import 'server-only'
import { MemoryCatalogRepository } from './memory/catalog-repository'
import { MemoryAccountRepository } from './memory/account-repository'
import { MemoryActivityRepository } from './memory/activity-repository'
import { MemoryAdminRepository } from './memory/admin-repository'
import { PrismaCatalogRepository } from './prisma/catalog-repository'
import { PrismaAccountRepository } from './prisma/account-repository'
import { PrismaActivityRepository } from './prisma/activity-repository'
import { PrismaAdminRepository } from './prisma/admin-repository'
import { PrismaAuditRepository } from './prisma/audit-repository'
import { MemoryAuditRepository } from './memory/audit-repository'
import type {
  AccountRepository,
  ActivityRepository,
  AdminRepository,
  AuditRepository,
  CatalogRepository,
} from './types'

/**
 * Composition root for persistence.
 *
 * `import 'server-only'` makes an accidental client import a build error rather
 * than a runtime surprise — this module reaches the database and must never be
 * bundled for the browser.
 *
 * Two complete drivers sit behind these factories. Nothing above this file
 * knows which one is running, which is the whole point of the seam: the same
 * pages, services and actions run against a JSON file in development and
 * PostgreSQL in production.
 */

export type DataDriver = 'memory' | 'postgres'

export function resolveDriver(): DataDriver {
  return process.env.DATA_DRIVER?.toLowerCase() === 'postgres' ? 'postgres' : 'memory'
}

/**
 * Fails at the composition root rather than on the first query.
 *
 * A missing `DATABASE_URL` otherwise surfaces as a Prisma initialisation error
 * several layers away from the configuration that is actually wrong.
 */
function assertConfigured(driver: DataDriver): void {
  // A Vercel function's filesystem is ephemeral and per-instance: the memory
  // driver would seed itself fresh on every cold start and silently lose every
  // write — registrations, RFQs, sessions. Refusing to boot beats that.
  if (driver === 'memory' && process.env.VERCEL) {
    throw new Error(
      'DATA_DRIVER=memory cannot run on Vercel — the function filesystem is ephemeral, ' +
        'so every write would be lost. Set DATA_DRIVER=postgres and DATABASE_URL in the ' +
        'Vercel project environment (see DEPLOY-VERCEL.md).'
    )
  }
  if (driver === 'postgres' && !process.env.DATABASE_URL) {
    throw new Error(
      'DATA_DRIVER=postgres requires DATABASE_URL. Start the bundled database with ' +
        '`docker compose up -d`, then run `npm run db:migrate && npm run db:seed`.'
    )
  }
}

let catalogRepository: CatalogRepository | null = null
let accountRepository: AccountRepository | null = null
let activityRepository: ActivityRepository | null = null
let adminRepository: AdminRepository | null = null
let auditRepository: AuditRepository | null = null

export function getCatalogRepository(): CatalogRepository {
  if (catalogRepository) return catalogRepository
  const driver = resolveDriver()
  assertConfigured(driver)
  catalogRepository =
    driver === 'postgres' ? new PrismaCatalogRepository() : new MemoryCatalogRepository()
  return catalogRepository
}

export function getAccountRepository(): AccountRepository {
  if (accountRepository) return accountRepository
  const driver = resolveDriver()
  assertConfigured(driver)
  accountRepository =
    driver === 'postgres' ? new PrismaAccountRepository() : new MemoryAccountRepository()
  return accountRepository
}

export function getActivityRepository(): ActivityRepository {
  if (activityRepository) return activityRepository
  const driver = resolveDriver()
  assertConfigured(driver)
  activityRepository =
    driver === 'postgres' ? new PrismaActivityRepository() : new MemoryActivityRepository()
  return activityRepository
}

/**
 * Privileged, cross-tenant reads and writes.
 *
 * Every caller must sit behind `requireRole('staff')`. The separate factory is
 * the reminder — see the note on `AdminRepository` in ./types.
 */
export function getAdminRepository(): AdminRepository {
  if (adminRepository) return adminRepository
  const driver = resolveDriver()
  assertConfigured(driver)
  adminRepository =
    driver === 'postgres' ? new PrismaAdminRepository() : new MemoryAdminRepository()
  return adminRepository
}

/**
 * Append-only audit trail.
 *
 * Deliberately has no update or delete path: an audit log an operator can edit
 * is not an audit log.
 */
export function getAuditRepository(): AuditRepository {
  if (auditRepository) return auditRepository
  const driver = resolveDriver()
  assertConfigured(driver)
  auditRepository =
    driver === 'postgres' ? new PrismaAuditRepository() : new MemoryAuditRepository()
  return auditRepository
}

export type {
  AccountRepository,
  ActivityRepository,
  AdminRepository,
  AuditRepository,
  AuditEntry,
  AuditAction,
  RfqUpdate,
  CatalogRepository,
  CatalogStats,
  CreateUserInput,
  SessionRecord,
  UserRecord,
} from './types'
