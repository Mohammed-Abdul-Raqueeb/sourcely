import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

/**
 * ESLint flat config.
 *
 * `next lint` is deprecated in Next 15 and removed in 16, so this targets the
 * ESLint CLI directly. `FlatCompat` bridges eslint-config-next, which still
 * ships eslintrc-format config.
 */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // The repository seam and seed builders legitimately need `any` at the
      // boundary where untyped JSON is parsed; everything downstream is typed.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]

export default config
