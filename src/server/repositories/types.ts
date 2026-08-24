import type { Brand, Category, Product, ProductView, Seller } from '@/lib/domain/catalog'
import type {
  AssistantMessage,
  CatalogQuery,
  Conversation,
  Page,
  RankedPage,
  RankedProduct,
  SearchIntent,
} from '@/lib/domain/search'
import type {
  Notification,
  Rfq,
  Role,
  SavedProduct,
  SavedSearch,
  SearchEvent,
  User,
} from '@/lib/domain/account'

/* -------------------------------------------------------------------------- */
/* Persistence records                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A user plus the fields that must never reach a React component.
 *
 * Services return `User` or `SessionUser`; only the repository layer ever sees
 * `passwordHash`. Keeping the two shapes distinct is what makes an accidental
 * leak a type error rather than a security incident.
 */
export interface UserRecord extends User {
  passwordHash: string
}

export interface SessionRecord {
  id: string
  userId: string
  createdAt: string
  expiresAt: string
  lastSeenAt: string
  /** Truncated — enough to show "Chrome on Windows", not to fingerprint. */
  userAgent: string
  revokedAt: string | null
}

export interface ResetTokenRecord {
  /** SHA-256 of the token that was emailed. The plaintext is never stored. */
  tokenHash: string
  userId: string
  expiresAt: string
  usedAt: string | null
}

export interface ViewRecord {
  id: string
  userId: string | null
  visitorId: string
  productId: string
  viewedAt: string
}

/**
 * The persistence seam.
 *
 * Services depend on these interfaces and never on a concrete driver. Two
 * implementations exist:
 *
 *   memory/   JSON-persisted, seeded, zero-infrastructure   (DATA_DRIVER=memory)
 *   prisma/   PostgreSQL 16 + pgvector                      (DATA_DRIVER=postgres)
 *
 * The interface is deliberately shaped for SQL — cursor pagination, explicit
 * projections, no methods that would require loading the catalogue into
 * memory. That is what stops the memory driver from quietly encoding
 * assumptions the Postgres driver cannot honour at ten thousand products.
 */

export interface CatalogRepository {
  /* --- Products --- */
  search(query: CatalogQuery): Promise<Page<ProductView>>
  rankByIntent(intent: SearchIntent, limit?: number): Promise<RankedPage>

  findBySlug(slug: string): Promise<ProductView | null>
  findById(id: string): Promise<ProductView | null>
  findManyByIds(ids: string[]): Promise<ProductView[]>

  related(productId: string, limit?: number): Promise<ProductView[]>
  featured(limit?: number): Promise<ProductView[]>

  /**
   * Scores one product against one intent, for the "why this is recommended"
   * panel on a product page reached from a search.
   */
  explain(productId: string, intent: SearchIntent): Promise<RankedProduct | null>

  /** All active product slugs, for static generation and the sitemap. */
  allSlugs(): Promise<string[]>

  /* --- Taxonomy --- */
  categories(): Promise<Category[]>
  topLevelCategories(): Promise<Category[]>
  categoryBySlug(slug: string): Promise<Category | null>
  childrenOf(categoryId: string): Promise<Category[]>

  brands(): Promise<Brand[]>
  brandBySlug(slug: string): Promise<Brand | null>

  sellers(): Promise<Seller[]>

  /* --- Writes (admin) --- */

  /**
   * Reads a product including archived ones.
   *
   * The public getters exclude archived records; the admin edit form must be
   * able to open and restore one.
   */
  findAnyById(id: string): Promise<Product | null>
  /** Every product, archived included. Admin listing only. */
  listAll(): Promise<Product[]>
  upsertProduct(product: Product): Promise<Product>
  setProductStatus(id: string, status: Product['status']): Promise<Product | null>

  /* --- Aggregates --- */
  count(query?: CatalogQuery): Promise<number>
  /** Total across the whole catalogue, for dashboard tiles. */
  stats(): Promise<CatalogStats>
}

export interface CatalogStats {
  products: number
  categories: number
  brands: number
  sellers: number
  inStock: number
  averagePrice: number
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export interface CreateUserInput {
  email: string
  name: string
  passwordHash: string
  company?: string | null
  phone?: string | null
  city?: string | null
  gstin?: string | null
  role?: Role
}

export interface AccountRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>
  findUserById(id: string): Promise<UserRecord | null>
  createUser(input: CreateUserInput): Promise<UserRecord>
  updateUser(id: string, patch: Partial<Omit<User, 'id' | 'role'>>): Promise<UserRecord | null>
  updatePassword(id: string, passwordHash: string): Promise<void>
  touchUser(id: string): Promise<void>

  createSession(userId: string, userAgent: string): Promise<SessionRecord>
  /** Returns null for unknown, expired or revoked sessions. */
  findActiveSession(sessionId: string): Promise<SessionRecord | null>
  listSessions(userId: string): Promise<SessionRecord[]>
  revokeSession(sessionId: string): Promise<void>
  /** Signs out everywhere, optionally sparing the current session. */
  revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void>

  /** Returns the plaintext token to email; only its hash is stored. */
  createResetToken(userId: string): Promise<string>
  /** Consumes a reset token, returning the user id, or null if invalid. */
  consumeResetToken(token: string): Promise<string | null>
}

/* -------------------------------------------------------------------------- */
/* Buyer activity                                                             */
/* -------------------------------------------------------------------------- */

export interface ActivityRepository {
  listSavedProducts(userId: string): Promise<SavedProduct[]>
  isSaved(userId: string, productId: string): Promise<boolean>
  saveProduct(userId: string, productId: string, note?: string | null): Promise<SavedProduct>
  unsaveProduct(userId: string, productId: string): Promise<void>
  setSavedNote(userId: string, productId: string, note: string | null): Promise<void>

  listSavedSearches(userId: string): Promise<SavedSearch[]>
  saveSearch(input: Omit<SavedSearch, 'id' | 'createdAt'>): Promise<SavedSearch>
  deleteSavedSearch(userId: string, id: string): Promise<void>
  setSearchAlerts(userId: string, id: string, enabled: boolean): Promise<void>

  recordView(userId: string | null, visitorId: string, productId: string): Promise<void>
  recentlyViewed(userId: string, limit?: number): Promise<string[]>

  recordSearch(event: Omit<SearchEvent, 'id' | 'createdAt'>): Promise<SearchEvent>
  listSearchHistory(userId: string, limit?: number): Promise<SearchEvent[]>
  clearSearchHistory(userId: string): Promise<void>

  listNotifications(userId: string, limit?: number): Promise<Notification[]>
  unreadCount(userId: string): Promise<number>
  markNotificationRead(userId: string, id: string): Promise<void>
  markAllNotificationsRead(userId: string): Promise<void>
  createNotification(input: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification>

  listRfqs(userId: string): Promise<Rfq[]>
  findRfq(userId: string, id: string): Promise<Rfq | null>
  createRfq(input: Omit<Rfq, 'id' | 'reference' | 'createdAt' | 'updatedAt' | 'messages'>): Promise<Rfq>

  listConversations(userId: string, limit?: number): Promise<Conversation[]>
  findConversation(userId: string | null, id: string): Promise<Conversation | null>
  createConversation(userId: string | null, title: string): Promise<Conversation>
  appendMessages(conversationId: string, messages: AssistantMessage[]): Promise<Conversation | null>
  renameConversation(userId: string, id: string, title: string): Promise<void>
  deleteConversation(userId: string, id: string): Promise<void>
}

/* -------------------------------------------------------------------------- */
/* Administration                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cross-tenant reads and writes.
 *
 * Deliberately a separate interface from `ActivityRepository`. Every method
 * there is scoped by `userId` — that scoping is the security property, and
 * adding an unscoped `listAllRfqs` beside `listRfqs(userId)` would put a
 * privileged call one autocomplete away from an accidental leak. Anything that
 * reads across users lives here, behind `requireRole('staff')`.
 */
export interface AdminRepository {
  listUsers(limit?: number): Promise<User[]>
  findUser(id: string): Promise<User | null>
  countUsers(): Promise<number>

  listAllRfqs(limit?: number): Promise<Rfq[]>
  findAnyRfq(id: string): Promise<Rfq | null>
  updateRfq(id: string, patch: RfqUpdate): Promise<Rfq | null>
  addRfqMessage(
    id: string,
    author: { id: string; role: Role },
    body: string
  ): Promise<Rfq | null>

  listAllSearchEvents(limit?: number): Promise<SearchEvent[]>
  listAllConversations(limit?: number): Promise<Conversation[]>
  countSavedForProduct(productId: string): Promise<number>
}

export interface RfqUpdate {
  status?: Rfq['status']
  /** Per-line quoted unit prices, keyed by product id. */
  quotes?: Record<string, { unitPrice: number; leadTimeDays: number }>
  validUntil?: string | null
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

export const AUDIT_ACTIONS = [
  'product_create',
  'product_update',
  'product_status_change',
  'rfq_status_change',
  'rfq_quote',
  'rfq_message',
  'user_role_change',
  'session_revoke',
  'password_change',
  'password_reset',
  'login_success',
  'login_failure',
  'export',
  'upload',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditEntry {
  id: string
  actorId: string | null
  actorEmail: string
  actorRole: Role
  action: AuditAction
  targetType: string
  targetId: string
  summary: string
  /** Before/after for the fields that changed. Never the whole record. */
  changes: Record<string, { from: unknown; to: unknown }> | null
  /** Hashed, never the raw address — see the note in server/audit/record.ts. */
  ipHash: string | null
  userAgent: string | null
  createdAt: string
}

export interface AuditQuery {
  action?: AuditAction
  actorId?: string
  targetType?: string
  targetId?: string
  limit?: number
}

/**
 * Append-only audit trail.
 *
 * There is deliberately no update or delete method. An audit log an operator
 * can edit is not an audit log, and putting the capability behind a comment
 * rather than behind the type is how it ends up being used. Retention is a
 * scheduled database job, not application code.
 */
export interface AuditRepository {
  record(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<AuditEntry>
  list(query?: AuditQuery): Promise<AuditEntry[]>
  count(query?: AuditQuery): Promise<number>
}
