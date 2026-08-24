/**
 * Contracts for the product-render pipeline.
 *
 * A renderer paints ONE product, photographically staged, into a 1600×1200
 * scene. It returns SVG fragments; `renderScene` in style.ts wraps them in the
 * studio backdrop and the generation script rasterizes the result with sharp.
 *
 * Renderers are pure: same seed, same finish → byte-identical SVG. No
 * Date.now(), no Math.random() — randomness comes from `ctx.rng` only.
 */

/** Master canvas. Rasterized to 1200×900; keep ~120px clear at every edge. */
export const CANVAS = { w: 1600, h: 1200, cx: 800, cy: 600 } as const

/**
 * A material finish: the ids are resolved by the material factories in
 * style.ts. Renderers pick parts from `ctx` rather than hardcoding colours so
 * a stainless valve and a bronze one share geometry.
 */
export type FinishId =
  | 'stainless'
  | 'steel'
  | 'castIron'
  | 'brass'
  | 'bronze'
  | 'copper'
  | 'chrome'
  | 'aluminium'
  | 'galvanized'
  | 'epoxyRed'
  | 'epoxyBlue'
  | 'epoxyGreen'
  | 'machineGray'
  | 'safetyYellow'
  | 'signalOrange'
  | 'plasticBlack'
  | 'plasticGray'
  | 'plasticWhite'
  | 'plasticBlue'
  | 'leather'
  | 'fabricGray'

export interface RenderContext {
  /** Deterministic PRNG seeded from the SKU: rng(min, max) → number in [min, max). */
  rng: (min: number, max: number) => number
  /** Main body finish, chosen from the product's material spec / category. */
  finish: FinishId
  /** Accent finish for handles, levers, dials, trims. */
  accent: FinishId
  /** Register a <defs> entry once; returns `url(#id)` for use as fill. */
  def: (id: string, fragment: string) => string
  /** Append a painted fragment to the scene, back to front. */
  add: (fragment: string) => void
}

export type ShapeRenderer = (ctx: RenderContext) => void
