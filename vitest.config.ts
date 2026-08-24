import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

/**
 * Vitest configuration.
 *
 * Two projects, because the code under test needs two runtimes:
 *
 *   unit        node    — engine, parsing, scoring, persistence, actions
 *   components  jsdom   — rendering and interaction
 *
 * `server-only` is aliased to an empty module. That package exists to throw
 * when a server module is pulled into a client bundle, which is exactly the
 * right behaviour in Next and exactly the wrong behaviour in a test runner
 * that is deliberately importing server code directly.
 */

const alias = [
  { find: '@', replacement: path.resolve(__dirname, 'src') },
  { find: /^server-only$/, replacement: path.resolve(__dirname, 'tests/stubs/server-only.ts') },
]

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
          // Repositories and the store hang state off `globalThis`. Forks give
          // each file a clean process rather than a shared module registry.
          pool: 'forks',
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'components',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/components/**/*.test.tsx'],
        },
      },
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        // Pages and layouts are exercised by the HTTP checks in the smoke
        // scripts; unit-testing a Server Component that only composes other
        // tested pieces measures nothing.
        'src/app/**',
        'src/server/seed/**',
      ],
    },
  },
})
