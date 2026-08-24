/**
 * Comparison constants.
 *
 * These live in a plain module rather than beside the shortlist provider on
 * purpose. A `'use client'` module imported by a Server Component is replaced
 * with a client-reference proxy, and a non-component export read through it is
 * **not** the value you wrote — it is an opaque object.
 *
 * That failure is silent. `array.slice(0, MAX_COMPARE)` with a proxy coerces
 * to `NaN`, `slice` treats `NaN` as `0`, and the page renders an empty
 * comparison with no error in any log. Shared constants belong in a neutral
 * module that both runtimes can import as a value.
 */

/** Comparison beyond four columns stops being readable on any screen. */
export const MAX_COMPARE = 4

/** Fewer than two products is not a comparison. */
export const MIN_COMPARE = 2
