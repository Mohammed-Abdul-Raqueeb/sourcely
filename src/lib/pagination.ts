/**
 * Catalogue page sizes, shared by the server and the browser.
 *
 * In a neutral module for the same reason `MAX_COMPARE` and `MAX_UPLOAD_BYTES`
 * are. Importing a constant from a `'use client'` module into a Server
 * Component does not give you the value — it gives you a client reference
 * object. Arithmetic on it produces NaN silently, so the failure surfaces far
 * from its cause: here it became `take: NaN` in a Prisma query, which the
 * in-memory driver tolerated and PostgreSQL rejected outright.
 *
 * The rule: any constant read on both sides of the boundary lives in `src/lib`,
 * never in a component file.
 */

export const PAGE_SIZE = 24

/**
 * Ceiling on the grow-the-page approach.
 *
 * Beyond this, listing becomes cursor-paged infinite scroll against
 * `CatalogRepository.search`, which already returns `nextCursor`. The cap
 * exists so that migration is forced rather than forgotten.
 */
export const PAGE_CAP = 96
