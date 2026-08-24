/**
 * Product image generation — CGI-style catalogue renders.
 *
 * Run: npm run images:generate            — render all 63 products
 *      npm run images:generate -- --sku SKU-1 SKU-2
 *      npm run images:generate -- --preview ball-valve gate-valve
 *      npm run images:generate -- --preview all
 *
 * Renders each seeded product as a studio catalogue render (see
 * scripts/product-renders/) and rasterizes it with sharp to a 1600×1200 PNG
 * at product-images/<SKU>.png — the same drop folder used for supplied
 * photography. Integration is then the normal path for ANY image source:
 *
 *   npm run images:ingest
 *
 * The renders are deterministic (same seeds in, same pixels out) and are
 * catalogue illustrations, not photographs: no text, no logos, no watermarks.
 *
 * `--preview` renders PNGs per shape into scripts/product-renders/preview/
 * for visual iteration on the renderers without touching the drop folder.
 */

import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { type FinishId } from './product-renders/types'
import { renderScene } from './product-renders/style'
import { SHAPE_RENDERERS } from './product-renders/shapes'
import type { ProductSeed } from '../src/server/seed/build-product'
import { VALVE_SEEDS } from '../src/server/seed/products/valves'
import { HVAC_SEEDS, PUMP_SEEDS } from '../src/server/seed/products/climate'
import {
  ELECTRICAL_SEEDS,
  FIRE_SEEDS,
  INSTRUMENT_SEEDS,
  SAFETY_SEEDS,
  TOOL_SEEDS,
} from '../src/server/seed/products/power-safety'
import { INDUSTRIAL_SEEDS, PLUMBING_SEEDS } from '../src/server/seed/products/piping-plant'

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'product-images')
const PREVIEW_DIR = path.join(ROOT, 'scripts', 'product-renders', 'preview')

const ALL_SEEDS: ProductSeed[] = [
  ...VALVE_SEEDS,
  ...HVAC_SEEDS,
  ...PUMP_SEEDS,
  ...ELECTRICAL_SEEDS,
  ...FIRE_SEEDS,
  ...INSTRUMENT_SEEDS,
  ...PLUMBING_SEEDS,
  ...INDUSTRIAL_SEEDS,
  ...TOOL_SEEDS,
  ...SAFETY_SEEDS,
]

/* -------------------------------------------------------------------------- */
/* Finish selection                                                           */
/* -------------------------------------------------------------------------- */

/** Product material spec value → body finish. */
const MATERIAL_FINISH: Record<string, FinishId> = {
  stainless_steel: 'stainless',
  cast_iron: 'castIron',
  ductile_iron: 'castIron',
  brass: 'brass',
  bronze: 'bronze',
  carbon_steel: 'steel',
  forged_steel: 'steel',
  copper: 'copper',
  aluminium: 'aluminium',
  upvc: 'plasticGray',
  cpvc: 'plasticWhite',
  ppr: 'plasticWhite',
  galvanised_iron: 'galvanized',
  hdpe: 'plasticBlack',
}

/** Category defaults when no material spec decides: [body, accent]. */
const CATEGORY_FINISH: Record<string, [FinishId, FinishId]> = {
  valves: ['brass', 'epoxyRed'],
  pumps: ['epoxyBlue', 'castIron'],
  hvac: ['galvanized', 'machineGray'],
  electrical: ['plasticGray', 'copper'],
  'fire-fighting': ['epoxyRed', 'brass'],
  instrumentation: ['stainless', 'plasticBlack'],
  plumbing: ['steel', 'machineGray'],
  safety: ['safetyYellow', 'plasticBlack'],
  tools: ['steel', 'signalOrange'],
  industrial: ['machineGray', 'epoxyBlue'],
}

/** Shapes whose real-world colour is fixed regardless of body material. */
const SHAPE_FINISH_OVERRIDES: Record<string, Partial<{ finish: FinishId; accent: FinishId }>> = {
  hydrant: { finish: 'epoxyRed', accent: 'brass' },
  hose: { finish: 'epoxyRed', accent: 'stainless' },
  'flow-switch': { accent: 'epoxyRed' },
  'pump-dosing': { finish: 'plasticGray', accent: 'plasticBlue' },
  vfd: { finish: 'plasticGray', accent: 'machineGray' },
  'cable-tray': { finish: 'galvanized' },
  ahu: { finish: 'galvanized', accent: 'plasticBlue' },
  fcu: { finish: 'galvanized', accent: 'machineGray' },
  gloves: { finish: 'fabricGray', accent: 'plasticBlue' },
  helmet: { finish: 'safetyYellow', accent: 'plasticGray' },
  goggles: { finish: 'plasticGray', accent: 'plasticBlack' },
  harness: { finish: 'signalOrange', accent: 'plasticBlack' },
}

function pickFinish(seed: ProductSeed): { finish: FinishId; accent: FinishId } {
  const [categoryFinish, categoryAccent] = CATEGORY_FINISH[seed.category] ?? ['machineGray', 'steel']

  const material = seed.specs.material
  const materialFinish =
    typeof material === 'string' ? MATERIAL_FINISH[material] : undefined

  const override = SHAPE_FINISH_OVERRIDES[seed.artwork] ?? {}

  return {
    finish: override.finish ?? materialFinish ?? categoryFinish,
    accent: override.accent ?? categoryAccent,
  }
}

/* -------------------------------------------------------------------------- */
/* Modes                                                                      */
/* -------------------------------------------------------------------------- */

async function previewShapes(keys: string[]): Promise<void> {
  await mkdir(PREVIEW_DIR, { recursive: true })

  const wanted = keys.includes('all') ? Object.keys(SHAPE_RENDERERS) : keys
  for (const key of wanted) {
    const renderer = SHAPE_RENDERERS[key]
    if (!renderer) {
      console.error(`[images] unknown shape "${key}" — known: ${Object.keys(SHAPE_RENDERERS).join(', ')}`)
      process.exitCode = 1
      continue
    }

    // A representative product for the shape, so preview finishes match what
    // the real run will produce.
    const sample = ALL_SEEDS.find((seed) => seed.artwork === key)
    const { finish, accent } = sample
      ? pickFinish(sample)
      : { finish: 'steel' as FinishId, accent: 'epoxyRed' as FinishId }

    const svg = renderScene(renderer, { seedKey: `preview:${key}`, finish, accent })
    const out = path.join(PREVIEW_DIR, `${key}.png`)
    await sharp(Buffer.from(svg)).resize(800, 600).png().toFile(out)
    console.log(`[images] preview ${key} (${finish}/${accent}) → ${path.relative(ROOT, out)}`)
  }
}

async function generateAll(skuFilter: string[]): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true })

  // Every artwork key used by a seed must have a renderer; fail loudly before
  // writing anything rather than shipping a placeholder silently.
  const missing = [...new Set(ALL_SEEDS.map((seed) => seed.artwork))].filter(
    (key) => !SHAPE_RENDERERS[key]
  )
  if (missing.length > 0) {
    throw new Error(`[images] no renderer for artwork key(s): ${missing.join(', ')}`)
  }

  const seeds =
    skuFilter.length > 0 ? ALL_SEEDS.filter((seed) => skuFilter.includes(seed.sku)) : ALL_SEEDS

  for (const seed of seeds) {
    const renderer = SHAPE_RENDERERS[seed.artwork]!
    const { finish, accent } = pickFinish(seed)
    const svg = renderScene(renderer, { seedKey: seed.sku, finish, accent })

    const out = path.join(OUT_DIR, `${seed.sku}.png`)
    await sharp(Buffer.from(svg)).png().toFile(out)

    console.log(`[images] ${seed.sku} (${seed.artwork}, ${finish}/${accent}) → product-images/${seed.sku}.png`)
  }

  console.log(
    `\n[images] rendered ${seeds.length} product(s). Integrate with:  npm run images:ingest`
  )
}

/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args[0] === '--preview') {
    const keys = args.slice(1)
    if (keys.length === 0) {
      console.error('Usage: --preview <shape-key ...|all>')
      process.exit(1)
    }
    await previewShapes(keys)
    return
  }

  const skuFilter = args[0] === '--sku' ? args.slice(1) : []
  await generateAll(skuFilter)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
