/**
 * Product image ingestion.
 *
 * Drop real product images into  product-images/  at the repo root, named by
 * SKU (see product-images/README.md for the full list), then run:
 *
 *   npm run images:ingest
 *
 * Accepted names, case-insensitive:  <SKU>.jpg|jpeg|png|webp|avif  for the
 * primary image, and  <SKU>-2.jpg … <SKU>-4.jpg  for extra gallery views.
 *
 * Each image is re-encoded to WebP (long edge capped at 1600px, metadata
 * stripped), written to public/products/, and recorded — with its dimensions
 * and a blur-up placeholder — in src/server/seed/product-images.ts, which the
 * seed reads at boot. Products with no image in the manifest keep the vector
 * line-art fallback, so a partial drop is fine: ingest as many or as few as
 * you have.
 *
 * Re-running is safe and incremental: SKUs found in the drop folder replace
 * their previous entries; every other SKU's entries are kept.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
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
const DROP_DIR = path.join(ROOT, 'product-images')
const OUT_DIR = path.join(ROOT, 'public', 'products')
const MANIFEST_PATH = path.join(ROOT, 'src', 'server', 'seed', 'product-images.ts')

const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const MAX_EDGE = 1600
const MAX_VIEWS = 4

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

interface ManifestImage {
  url: string
  alt: string
  width: number
  height: number
  blurDataUrl: string
}

/** `vlv-bv-001.jpg` → { sku: 'VLV-BV-001', view: 1 }; `…-2.png` → view 2. */
function parseDropName(
  file: string,
  skuByLower: Map<string, string>
): { sku: string; view: number } | null {
  const ext = path.extname(file).toLowerCase()
  if (!EXTENSIONS.has(ext)) return null

  const stem = path.basename(file, path.extname(file)).toLowerCase()
  const viewMatch = /^(.*)-([2-9])$/.exec(stem)
  const base = viewMatch ? viewMatch[1]! : stem
  const view = viewMatch ? Number.parseInt(viewMatch[2]!, 10) : 1

  const sku = skuByLower.get(base)
  if (!sku || view > MAX_VIEWS) return null
  return { sku, view }
}

async function main(): Promise<void> {
  const skuByLower = new Map(ALL_SEEDS.map((seed) => [seed.sku.toLowerCase(), seed.sku]))
  const nameBySku = new Map(ALL_SEEDS.map((seed) => [seed.sku, seed.name]))

  let entries: string[]
  try {
    entries = await readdir(DROP_DIR)
  } catch {
    console.error(
      `[ingest] drop folder not found: ${path.relative(ROOT, DROP_DIR)}\n` +
        `         Create it and add images named by SKU — see product-images/README.md.`
    )
    process.exit(1)
  }

  const matched = new Map<string, Map<number, string>>()
  const unmatched: string[] = []

  for (const file of entries) {
    if (file.toLowerCase() === 'readme.md') continue
    const parsed = parseDropName(file, skuByLower)
    if (!parsed) {
      unmatched.push(file)
      continue
    }
    const views = matched.get(parsed.sku) ?? new Map<number, string>()
    views.set(parsed.view, file)
    matched.set(parsed.sku, views)
  }

  if (matched.size === 0) {
    console.error('[ingest] no files in the drop folder matched a product SKU.')
    if (unmatched.length > 0) {
      console.error(`[ingest] unrecognized files: ${unmatched.join(', ')}`)
    }
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  /* --- Load the existing manifest so a partial drop merges, not replaces --- */

  let manifest: Record<string, ManifestImage[]> = {}
  try {
    const existing = (await import('../src/server/seed/product-images')) as {
      PRODUCT_IMAGE_MANIFEST: Record<string, ManifestImage[]>
    }
    manifest = { ...existing.PRODUCT_IMAGE_MANIFEST }
  } catch {
    // First run with no manifest module — start empty.
  }

  /* --- Process ------------------------------------------------------------ */

  for (const [sku, views] of matched) {
    const name = nameBySku.get(sku) ?? sku
    const images: ManifestImage[] = []

    for (const view of [...views.keys()].sort((a, b) => a - b)) {
      const sourceFile = views.get(view)!
      const source = await readFile(path.join(DROP_DIR, sourceFile))

      const webp = await sharp(source)
        .rotate() // honour EXIF orientation before stripping metadata
        .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toBuffer()

      const meta = await sharp(webp).metadata()
      const outName = `${sku.toLowerCase()}${view === 1 ? '' : `-${view}`}.webp`
      await writeFile(path.join(OUT_DIR, outName), webp)

      const blur = await sharp(webp).resize(12).webp({ quality: 40 }).toBuffer()

      images.push({
        url: `/products/${outName}`,
        alt: view === 1 ? `${name} — product photo` : `${name} — view ${view}`,
        width: meta.width ?? MAX_EDGE,
        height: meta.height ?? MAX_EDGE,
        blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
      })

      console.log(`[ingest] ${sourceFile} → public/products/${outName} (${meta.width}×${meta.height})`)
    }

    manifest[sku] = images
  }

  /* --- Write the manifest, ordered by seed order for stable diffs --------- */

  const ordered = Object.fromEntries(
    ALL_SEEDS.filter((seed) => manifest[seed.sku]).map((seed) => [seed.sku, manifest[seed.sku]])
  )

  const banner = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by scripts/ingest-product-images.ts from the images dropped into
 * product-images/. Regenerate with:
 *
 *   npm run images:ingest
 */

export interface GeneratedProductImage {
  url: string
  alt: string
  width: number
  height: number
  blurDataUrl: string
}

export const PRODUCT_IMAGE_MANIFEST: Record<string, GeneratedProductImage[]> = `

  await writeFile(MANIFEST_PATH, `${banner}${JSON.stringify(ordered, null, 2)}\n`)

  /* --- Report ------------------------------------------------------------- */

  const withImages = new Set(Object.keys(ordered))
  const missing = ALL_SEEDS.filter((seed) => !withImages.has(seed.sku))

  console.log(`\n[ingest] ${matched.size} product(s) ingested, ${withImages.size} total with images.`)
  if (unmatched.length > 0) {
    console.log(`[ingest] ${unmatched.length} file(s) did not match any SKU: ${unmatched.join(', ')}`)
  }
  if (missing.length > 0) {
    console.log(
      `[ingest] ${missing.length} product(s) still using line-art fallback:\n` +
        missing.map((seed) => `         ${seed.sku}  (${seed.name})`).join('\n')
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
