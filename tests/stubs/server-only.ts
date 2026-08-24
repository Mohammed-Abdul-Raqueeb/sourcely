/**
 * Stand-in for the `server-only` package.
 *
 * The real module throws on import so that a Server Component accidentally
 * pulled into a client bundle fails the build. In a test runner that is
 * deliberately importing server code, that guard is noise — this replaces it
 * with nothing.
 */
export {}
