import '@testing-library/jest-dom/vitest'

/**
 * Global test setup.
 *
 * The data directory is redirected to a scratch path so a test run can never
 * write users, sessions or catalogue edits into the development store.
 *
 * These run at module scope rather than in `beforeAll`, and that matters.
 * A setup file is evaluated before any test file, but a test file's own
 * top-level statements run *after* its imports — ESM hoists them. So a test
 * that sets `DATABASE_URL` at its top has already imported a module that
 * constructed a PrismaClient without one, and Prisma reports the variable as
 * missing even though the line assigning it is right there in the file.
 *
 * `??=` throughout, so a value supplied by the shell always wins.
 */
process.env.SOURCELY_DATA_DIR ??= '.data-vitest'
process.env.AUTH_SECRET ??= 'vitest-secret-key-that-is-at-least-32-characters-long'
process.env.DATA_DRIVER ??= 'memory'
process.env.AI_PROVIDER ??= 'offline'

// A default so the integration suites can probe for a local database or cache.
// Both skip cleanly when nothing is listening.
process.env.DATABASE_URL ??= 'postgresql://sourcely:sourcely@localhost:5432/sourcely?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
