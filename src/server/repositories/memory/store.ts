import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Product } from '@/lib/domain/catalog'
import type {
  Conversation,
  Notification,
  Rfq,
  SavedProduct,
  SavedSearch,
  SearchEvent,
} from '@/lib/domain'
import type {
  AuditEntry,
  ResetTokenRecord,
  SessionRecord,
  UserRecord,
  ViewRecord,
} from '../types'
import { hashPassword } from '@/server/auth/password'

export type { ResetTokenRecord, SessionRecord, UserRecord, ViewRecord }

/**
 * Write store for the memory driver.
 *
 * Reads and writes `.data/store.json`. Everything the catalogue does not own —
 * users, sessions, shortlists, search history, RFQs, conversations,
 * notifications — lives here.
 *
 * Two things make this survivable in development:
 *
 *   1. The instance hangs off `globalThis`, so Next's module reloading on hot
 *      update does not silently reset every logged-in session.
 *   2. Writes are debounced and serialised through a single promise chain, so
 *      concurrent requests cannot interleave a half-written file.
 *
 * It is not a database and does not pretend to be one. `DATA_DRIVER=postgres`
 * replaces it wholesale — see ARCHITECTURE.md 5.2.
 */

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */

export interface StoreShape {
  version: 1
  /**
   * Admin-authored product records, layered over the seed catalogue.
   *
   * An entry with an id that exists in the seed data overrides it; a new id is
   * an addition. Keeping edits as an overlay rather than mutating the seed
   * means the demo catalogue is always recoverable by deleting `.data`, and
   * the Postgres driver replaces the whole mechanism with real rows.
   */
  productOverlay: Product[]
  /** Bumped on every catalogue write, so the search index knows to rebuild. */
  catalogVersion: number
  users: UserRecord[]
  sessions: SessionRecord[]
  resetTokens: ResetTokenRecord[]
  savedProducts: SavedProduct[]
  savedSearches: SavedSearch[]
  views: ViewRecord[]
  searchEvents: SearchEvent[]
  notifications: Notification[]
  conversations: Conversation[]
  rfqs: Rfq[]
  /** Append-only. See AuditRepository in ../types. */
  auditLog: AuditEntry[]
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                */
/* -------------------------------------------------------------------------- */

/**
 * `SOURCELY_DATA_DIR` lets the test harness point at a scratch directory so a
 * smoke run does not write users into the development store.
 *
 * Read lazily, not at module scope: ES module imports are hoisted above every
 * statement in the importing file, so a test that sets the variable at the top
 * of its own module would still lose the race against this one.
 */
function dataDir(): string {
  return process.env.SOURCELY_DATA_DIR
    ? path.resolve(process.env.SOURCELY_DATA_DIR)
    : path.join(process.cwd(), '.data')
}

function storeFile(): string {
  return path.join(dataDir(), 'store.json')
}

interface StoreHandle {
  data: StoreShape
  writeChain: Promise<void>
  writeTimer: ReturnType<typeof setTimeout> | null
}

declare global {
  var __sourcelyStore: StoreHandle | undefined
  var __sourcelyStoreInit: Promise<StoreHandle> | undefined
}

async function readFromDisk(): Promise<StoreShape | null> {
  try {
    const raw = await fs.readFile(storeFile(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as StoreShape).version === 1 &&
      Array.isArray((parsed as StoreShape).users)
    ) {
      const store = parsed as StoreShape
      // Forward-compatible read: a store written before the catalogue overlay
      // existed is still valid, it just has nothing in it.
      store.productOverlay ??= []
      store.catalogVersion ??= 0
      store.auditLog ??= []
      return store
    }
    return null
  } catch {
    // Absent or corrupt: reseed rather than crash. This file is demo state,
    // not a system of record.
    return null
  }
}

/** Monotonic per-process counter — see the temp-file note in `writeToDisk`. */
let writeSequence = 0

async function writeToDisk(data: StoreShape): Promise<void> {
  try {
    const target = storeFile()
    await fs.mkdir(path.dirname(target), { recursive: true })

    // Write-then-rename so a crash mid-write cannot leave a truncated file.
    //
    // The temp name must be unique per *write*, not per process. Seeding fires
    // an unawaited write and a caller may flush immediately after; with a
    // shared `${pid}.tmp` name the second write overwrites the first's temp
    // file, the first rename consumes it, and the second fails with ENOENT —
    // silently losing everything written in that second call.
    const temporary = `${target}.${process.pid}.${writeSequence++}.tmp`
    await fs.writeFile(temporary, JSON.stringify(data, null, 2), 'utf8')
    await fs.rename(temporary, target)
  } catch (error) {
    // A read-only filesystem must not take the request down — the in-memory
    // state is still correct for this process.
    console.warn('[store] could not persist:', (error as Error).message)
  }
}

async function initialise(): Promise<StoreHandle> {
  const existing = await readFromDisk()
  const data = existing ?? (await seed())

  const handle: StoreHandle = { data, writeChain: Promise.resolve(), writeTimer: null }
  if (!existing) void writeToDisk(data)
  return handle
}

export async function getStore(): Promise<StoreShape> {
  if (globalThis.__sourcelyStore) return globalThis.__sourcelyStore.data

  // Concurrent first requests must share one initialisation, or two of them
  // seed two different stores and the second overwrites the first.
  globalThis.__sourcelyStoreInit ??= initialise()
  const handle = await globalThis.__sourcelyStoreInit
  globalThis.__sourcelyStore ??= handle
  return handle.data
}

/**
 * Schedules a write. Debounced by 120ms so a burst of mutations in one request
 * costs a single file write.
 */
export function persist(): void {
  const handle = globalThis.__sourcelyStore
  if (!handle) return

  if (handle.writeTimer) clearTimeout(handle.writeTimer)
  handle.writeTimer = setTimeout(() => {
    handle.writeTimer = null
    handle.writeChain = handle.writeChain.then(() => writeToDisk(handle.data))
  }, 120)
}

/** Flushes any pending write. Used by tests and scripts. */
export async function flush(): Promise<void> {
  const handle = globalThis.__sourcelyStore
  if (!handle) return
  if (handle.writeTimer) {
    clearTimeout(handle.writeTimer)
    handle.writeTimer = null
  }
  handle.writeChain = handle.writeChain.then(() => writeToDisk(handle.data))
  await handle.writeChain
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`
}

/* -------------------------------------------------------------------------- */
/* Seed                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Demo credentials, printed on the sign-in page.
 *
 * Two accounts so role-based access is demonstrable rather than asserted.
 * Both are seeded through the same hashing path a real registration uses.
 */
export const DEMO_ACCOUNTS = {
  customer: { email: 'buyer@deccanprojects.in', password: 'Sourcely2026' },
  admin: { email: 'admin@sourcely.in', password: 'Sourcely2026' },
} as const

const HOUR = 3_600_000
const DAY = 24 * HOUR

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

async function seed(): Promise<StoreShape> {
  const passwordHash = await hashPassword(DEMO_ACCOUNTS.customer.password)

  const customer: UserRecord = {
    id: 'user_demo_customer',
    email: DEMO_ACCOUNTS.customer.email,
    name: 'Rajesh Kumar',
    role: 'customer',
    company: 'Deccan Projects Pvt. Ltd.',
    phone: '+91 98450 22140',
    city: 'Hyderabad',
    gstin: '36AAGCD1129R1ZP',
    avatarUrl: null,
    emailVerified: true,
    passwordHash,
    createdAt: ago(214 * DAY),
    lastActiveAt: ago(2 * HOUR),
  }

  const admin: UserRecord = {
    id: 'user_demo_admin',
    email: DEMO_ACCOUNTS.admin.email,
    name: 'Priya Menon',
    role: 'admin',
    company: 'Sourcely Commerce Technologies',
    phone: '+91 22 6814 2200',
    city: 'Mumbai',
    gstin: null,
    avatarUrl: null,
    emailVerified: true,
    passwordHash,
    createdAt: ago(420 * DAY),
    lastActiveAt: ago(30 * 60_000),
  }

  const savedProducts: SavedProduct[] = [
    {
      id: newId('sav'),
      userId: customer.id,
      productId: 'prod_vtk-bv2s-050',
      note: 'Preferred option for the 4th floor riser — confirm PN rating with MEP.',
      createdAt: ago(3 * DAY),
    },
    {
      id: newId('sav'),
      userId: customer.id,
      productId: 'prod_dor-drv-050',
      note: null,
      createdAt: ago(3 * DAY + 2 * HOUR),
    },
    {
      id: newId('sav'),
      userId: customer.id,
      productId: 'prod_afx-fcu-600',
      note: 'Check ceiling void depth before ordering.',
      createdAt: ago(9 * DAY),
    },
    {
      id: newId('sav'),
      userId: customer.id,
      productId: 'prod_hym-cp-es-050',
      note: null,
      createdAt: ago(16 * DAY),
    },
  ]

  const views: ViewRecord[] = [
    'prod_vtk-bv2s-050',
    'prod_vtk-bv3s-050',
    'prod_dor-bv-050t',
    'prod_vtk-ys-050t',
    'prod_afx-fcu-600',
    'prod_snc-mccb-100-3p',
    'prod_tru-pg-100',
  ].map((productId, index) => ({
    id: newId('view'),
    userId: customer.id,
    visitorId: 'visitor_demo',
    productId,
    viewedAt: ago(index * 6 * HOUR + HOUR),
  }))

  const searchEvents: SearchEvent[] = [
    {
      query: 'stainless steel threaded valve for HVAC under ₹5,000',
      mode: 'ai' as const,
      resultCount: 8,
      clicked: ['prod_vtk-bv2s-050', 'prod_vtk-bv3s-050'],
      converted: true,
      hoursAgo: 3,
    },
    {
      query: 'double regulating valve DN50',
      mode: 'ai' as const,
      resultCount: 4,
      clicked: ['prod_dor-drv-050'],
      converted: false,
      hoursAgo: 5,
    },
    {
      query: 'fan coil unit 600 cfm concealed',
      mode: 'ai' as const,
      resultCount: 6,
      clicked: ['prod_afx-fcu-600'],
      converted: false,
      hoursAgo: 30,
    },
    {
      query: 'mccb 100a',
      mode: 'traditional' as const,
      resultCount: 2,
      clicked: ['prod_snc-mccb-100-3p'],
      converted: false,
      hoursAgo: 52,
    },
    {
      query: 'pressure gauge chilled water 0-16 bar',
      mode: 'ai' as const,
      resultCount: 5,
      clicked: ['prod_tru-pg-100'],
      converted: false,
      hoursAgo: 74,
    },
    {
      query: 'end suction pump 30 m3/h 30m head',
      mode: 'ai' as const,
      resultCount: 3,
      clicked: [],
      converted: false,
      hoursAgo: 98,
    },
    {
      query: 'y strainer stainless 40 mesh',
      mode: 'traditional' as const,
      resultCount: 1,
      clicked: ['prod_vtk-ys-050t'],
      converted: false,
      hoursAgo: 120,
    },
  ].map((entry) => ({
    id: newId('evt'),
    userId: customer.id,
    sessionId: 'visitor_demo',
    query: entry.query,
    mode: entry.mode,
    intent: null,
    resultCount: entry.resultCount,
    clickedProductIds: entry.clicked,
    convertedToRfq: entry.converted,
    tookMs: 12 + ((entry.query.length * 7) % 40),
    createdAt: ago(entry.hoursAgo * HOUR),
  }))

  const rfqs: Rfq[] = [
    {
      id: 'rfq_demo_1',
      reference: 'RFQ-2608-0142',
      userId: customer.id,
      status: 'quoted',
      contact: {
        name: customer.name,
        company: customer.company ?? '',
        email: customer.email,
        phone: customer.phone ?? '',
        city: customer.city ?? '',
        gstin: customer.gstin,
      },
      items: [
        {
          productId: 'prod_vtk-bv2s-050',
          quantity: 42,
          note: 'DN50 for floors 4–9 risers.',
          quotedUnitPrice: 3540,
          quotedLeadTimeDays: 4,
        },
        {
          productId: 'prod_vtk-ys-050t',
          quantity: 42,
          note: 'One per pump set.',
          quotedUnitPrice: 2590,
          quotedLeadTimeDays: 4,
        },
      ],
      requirements:
        'Chilled water risers, 9-storey commercial block in Gachibowli. Delivery to site in two tranches. Test certificates required with despatch.',
      deliveryPincode: '500032',
      requiredByDate: new Date(Date.now() + 21 * DAY).toISOString(),
      sourceConversationId: null,
      messages: [
        {
          id: newId('msg'),
          rfqId: 'rfq_demo_1',
          authorId: 'user_demo_admin',
          authorRole: 'staff',
          body: 'Quotation attached for both lines at the volumes requested. Unit rates include a 7% volume discount. Test certificates to IS 554 will ship with the consignment.',
          createdAt: ago(19 * HOUR),
        },
      ],
      quotedTotal: 42 * 3540 + 42 * 2590,
      validUntil: new Date(Date.now() + 12 * DAY).toISOString(),
      createdAt: ago(2 * DAY),
      updatedAt: ago(19 * HOUR),
    },
    {
      id: 'rfq_demo_2',
      reference: 'RFQ-2608-0163',
      userId: customer.id,
      status: 'under_review',
      contact: {
        name: customer.name,
        company: customer.company ?? '',
        email: customer.email,
        phone: customer.phone ?? '',
        city: customer.city ?? '',
        gstin: customer.gstin,
      },
      items: [
        {
          productId: 'prod_afx-fcu-600',
          quantity: 24,
          note: 'Ceiling void is 300mm — confirm unit height with brackets.',
          quotedUnitPrice: null,
          quotedLeadTimeDays: null,
        },
      ],
      requirements:
        'Fan coil units for the 6th and 7th floor open-plan areas. Need confirmation on external static pressure at medium speed before we release the order.',
      deliveryPincode: '500032',
      requiredByDate: new Date(Date.now() + 34 * DAY).toISOString(),
      sourceConversationId: null,
      messages: [],
      quotedTotal: null,
      validUntil: null,
      createdAt: ago(11 * HOUR),
      updatedAt: ago(11 * HOUR),
    },
  ]

  const notifications: Notification[] = [
    {
      id: newId('ntf'),
      userId: customer.id,
      kind: 'rfq_status',
      title: 'Quotation received — RFQ-2608-0142',
      body: 'Metro Industrial Supply Co. has quoted ₹2,57,460 for 2 lines. Valid for 12 days.',
      href: '/account/rfq/rfq_demo_1',
      read: false,
      createdAt: ago(19 * HOUR),
    },
    {
      id: newId('ntf'),
      userId: customer.id,
      kind: 'rfq_message',
      title: 'New message on RFQ-2608-0142',
      body: 'Test certificates to IS 554 will ship with the consignment.',
      href: '/account/rfq/rfq_demo_1',
      read: false,
      createdAt: ago(19 * HOUR),
    },
    {
      id: newId('ntf'),
      userId: customer.id,
      kind: 'rfq_status',
      title: 'RFQ-2608-0163 is under review',
      body: 'Deccan MEP Traders has acknowledged your request for 24 fan coil units.',
      href: '/account/rfq/rfq_demo_2',
      read: true,
      createdAt: ago(10 * HOUR),
    },
    {
      id: newId('ntf'),
      userId: customer.id,
      kind: 'back_in_stock',
      title: 'Back in stock: Dorsett Series 40 Ball Valve',
      body: 'DN50 threaded, SS316. 34 units now available from Coastal Flow Solutions.',
      href: '/products/dorsett-series-40-ball-valve-ss316-dn50-threaded-dor-bv-050t',
      read: true,
      createdAt: ago(2 * DAY),
    },
  ]

  const savedSearches: SavedSearch[] = [
    {
      id: newId('ss'),
      userId: customer.id,
      title: 'SS316 threaded valves under ₹5,000',
      query: 'stainless steel threaded valve for HVAC under ₹5,000',
      intent: null,
      alertsEnabled: true,
      lastResultCount: 8,
      createdAt: ago(3 * DAY),
    },
    {
      id: newId('ss'),
      userId: customer.id,
      title: 'Concealed FCUs, 600–1200 CFM',
      query: 'ceiling concealed fan coil unit 600 to 1200 cfm',
      intent: null,
      alertsEnabled: false,
      lastResultCount: 6,
      createdAt: ago(9 * DAY),
    },
  ]

  return {
    version: 1,
    productOverlay: [],
    catalogVersion: 0,
    users: [customer, admin],
    sessions: [],
    resetTokens: [],
    savedProducts,
    savedSearches,
    views,
    searchEvents,
    notifications,
    conversations: [],
    rfqs,
    auditLog: [],
  }
}
