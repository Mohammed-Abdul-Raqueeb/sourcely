import 'server-only'
import type { AuditEntry, AuditQuery, AuditRepository } from '../types'
import { getStore, newId, persist } from './store'

/** In-memory audit trail. Append-only, newest first on read. */
export class MemoryAuditRepository implements AuditRepository {
  async record(entry: Omit<AuditEntry, 'id' | 'createdAt'>): Promise<AuditEntry> {
    const store = await getStore()

    const record: AuditEntry = {
      ...entry,
      id: newId('audit'),
      createdAt: new Date().toISOString(),
    }

    store.auditLog.push(record)
    persist()
    return record
  }

  async list(query: AuditQuery = {}): Promise<AuditEntry[]> {
    const store = await getStore()

    return [...store.auditLog]
      .filter((entry) => (query.action ? entry.action === query.action : true))
      .filter((entry) => (query.actorId ? entry.actorId === query.actorId : true))
      .filter((entry) => (query.targetType ? entry.targetType === query.targetType : true))
      .filter((entry) => (query.targetId ? entry.targetId === query.targetId : true))
      // Reverse first so entries written in the same millisecond keep insertion
      // order under a stable sort — an audit trail out of order is misleading.
      .reverse()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, query.limit ?? 200)
  }

  async count(query: AuditQuery = {}): Promise<number> {
    const store = await getStore()
    return store.auditLog.filter(
      (entry) =>
        (query.action ? entry.action === query.action : true) &&
        (query.actorId ? entry.actorId === query.actorId : true) &&
        (query.targetType ? entry.targetType === query.targetType : true) &&
        (query.targetId ? entry.targetId === query.targetId : true)
    ).length
  }
}
