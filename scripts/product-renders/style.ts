/**
 * Studio scene, materials and part helpers for the product renders.
 *
 * The look this file encodes: a commercial catalogue render — one product,
 * three-quarter-lit from the upper left, on a seamless light-grey studio
 * sweep with a soft ground shadow. Materials are layered linear/radial
 * gradients; nothing here uses text (font rasterization differs by machine
 * and would make the output non-reproducible).
 */

import { CANVAS, type FinishId, type RenderContext, type ShapeRenderer } from './types'

/* -------------------------------------------------------------------------- */
/* Palettes                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Five stops per finish, dark-edge → bright-highlight → mid → shade → dark,
 * which is what a cylinder of that material looks like under a softbox.
 */
const PALETTES: Record<FinishId, [string, string, string, string, string]> = {
  stainless:    ['#6b7280', '#f4f6f8', '#c3c9d1', '#8e959e', '#565c66'],
  steel:        ['#4d545c', '#dfe3e8', '#9aa2ac', '#6e767f', '#3a4048'],
  castIron:     ['#3a3f45', '#9aa1a9', '#6a7178', '#4a5057', '#2b2f34'],
  brass:        ['#8a6b1f', '#f7e4a8', '#d4af4e', '#a8842e', '#6b5316'],
  bronze:       ['#6e4a26', '#e0b380', '#b5814b', '#8a6136', '#503319'],
  copper:       ['#7c3f21', '#f0b795', '#cd7f52', '#a05a35', '#5e3018'],
  chrome:       ['#5a6470', '#ffffff', '#b9c2cc', '#7d8792', '#434b55'],
  aluminium:    ['#7d838b', '#eef0f3', '#c8ccd2', '#9fa5ad', '#666c74'],
  galvanized:   ['#767d85', '#e3e7ea', '#b7bdc4', '#949aa2', '#5d636b'],
  epoxyRed:     ['#7e1416', '#f0524f', '#c3272b', '#9a1c1f', '#5e0e10'],
  epoxyBlue:    ['#173a6b', '#4f8ad6', '#2b5ea8', '#1f4784', '#102a4e'],
  epoxyGreen:   ['#1d4d33', '#57a877', '#2f7a4f', '#25603e', '#153726'],
  machineGray:  ['#565b63', '#c9cdd3', '#8f949c', '#6e737b', '#41454c'],
  safetyYellow: ['#8f6d0a', '#ffd94d', '#f0b90b', '#c2950a', '#6e5407'],
  signalOrange: ['#8c3d0a', '#ff9147', '#e8621a', '#b84e14', '#69300a'],
  plasticBlack: ['#0e1013', '#4a4f56', '#26292e', '#1a1c20', '#08090b'],
  plasticGray:  ['#4c5158', '#b9bec5', '#83888f', '#63686f', '#383c42'],
  plasticWhite: ['#9aa0a6', '#ffffff', '#e8eaed', '#c9cdd1', '#82888e'],
  plasticBlue:  ['#1c4577', '#5b96e0', '#3268b4', '#254f8f', '#143156'],
  leather:      ['#4f3a18', '#b98d55', '#8a6534', '#6b4d26', '#3a2a13'],
  fabricGray:   ['#3f434a', '#a7acb3', '#767b83', '#585d64', '#2e3137'],
}

/* -------------------------------------------------------------------------- */
/* Materials — every factory registers a def once and returns url(#id)        */
/* -------------------------------------------------------------------------- */

/**
 * Machined/painted cylinder gradient along an axis.
 * `axis: 'v'` shades a horizontal cylinder (light on top); `'h'` a vertical one.
 */
export function metal(ctx: RenderContext, finish: FinishId, axis: 'v' | 'h' = 'v'): string {
  const [edge, hi, mid, low, dark] = PALETTES[finish]
  const id = `m-${finish}-${axis}`
  const coords = axis === 'v' ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"'
  return ctx.def(
    id,
    `<linearGradient id="${id}" ${coords}>
      <stop offset="0" stop-color="${edge}"/>
      <stop offset="0.16" stop-color="${hi}"/>
      <stop offset="0.42" stop-color="${mid}"/>
      <stop offset="0.78" stop-color="${low}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>`
  )
}

/** Domed/radial face of a material — end caps, dials, wheel hubs, dome nuts. */
export function metalRadial(ctx: RenderContext, finish: FinishId): string {
  const [, hi, mid, low, dark] = PALETTES[finish]
  const id = `r-${finish}`
  return ctx.def(
    id,
    `<radialGradient id="${id}" cx="0.38" cy="0.32" r="0.85">
      <stop offset="0" stop-color="${hi}"/>
      <stop offset="0.45" stop-color="${mid}"/>
      <stop offset="0.8" stop-color="${low}"/>
      <stop offset="1" stop-color="${dark}"/>
    </radialGradient>`
  )
}

/** Flat sheet-metal / cabinet-panel gradient: gentler falloff than `metal`. */
export function sheet(ctx: RenderContext, finish: FinishId): string {
  const [, hi, mid, low] = PALETTES[finish]
  const id = `s-${finish}`
  return ctx.def(
    id,
    `<linearGradient id="${id}" x1="0" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="${hi}"/>
      <stop offset="0.5" stop-color="${mid}"/>
      <stop offset="1" stop-color="${low}"/>
    </linearGradient>`
  )
}

/** Solid tones for strokes and flat details. [edge, hi, mid, low, dark] */
export function tones(finish: FinishId): [string, string, string, string, string] {
  return PALETTES[finish]
}

/* -------------------------------------------------------------------------- */
/* Part helpers — return fragments for ctx.add()                              */
/* -------------------------------------------------------------------------- */

/** Soft elliptical ground shadow. Paint FIRST, under the product. */
export function groundShadow(
  ctx: RenderContext,
  cx: number,
  cy: number,
  rx: number,
  ry = rx * 0.16,
  opacity = 0.22
): string {
  const fill = ctx.def(
    'ground-shadow',
    `<radialGradient id="ground-shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#1c2430" stop-opacity="1"/>
      <stop offset="0.7" stop-color="#1c2430" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#1c2430" stop-opacity="0"/>
    </radialGradient>`
  )
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}"/>`
}

/** Soft white specular band — lay over a body to sell a glossy surface. */
export function specular(x: number, y: number, w: number, h: number, opacity = 0.32, rx?: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx ?? h / 2}" fill="#ffffff" opacity="${opacity}"/>`
}

/** Hex bolt head, lit from the upper left. */
export function hexBolt(ctx: RenderContext, cx: number, cy: number, r: number): string {
  const fill = metalRadial(ctx, 'steel')
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 90) * Math.PI) / 180
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`
  }).join(' ')
  return `<g>
    <polygon points="${pts}" fill="${fill}" stroke="#2f343a" stroke-width="${Math.max(1, r * 0.08)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="none" stroke="#2f343a" stroke-width="${Math.max(1, r * 0.09)}" opacity="0.55"/>
    <circle cx="${cx - r * 0.2}" cy="${cy - r * 0.22}" r="${r * 0.16}" fill="#ffffff" opacity="0.5"/>
  </g>`
}

/** Ring of bolts around a flange face. */
export function boltRing(
  ctx: RenderContext,
  cx: number,
  cy: number,
  ringR: number,
  count: number,
  boltR: number,
  squashY = 1
): string {
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const a = ((i * (360 / count) - 90) * Math.PI) / 180
    parts.push(hexBolt(ctx, cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR * squashY, boltR))
  }
  return parts.join('')
}

/**
 * Vertical pipe flange: a rounded plate with a raised face and bolt heads on
 * the visible edge. `x` is the flange centre-line, `cy` the pipe axis.
 */
export function flange(
  ctx: RenderContext,
  x: number,
  cy: number,
  w: number,
  h: number,
  finish: FinishId
): string {
  const fill = metal(ctx, finish, 'v')
  const [, , , , dark] = PALETTES[finish]
  return `<g>
    <rect x="${x - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${w * 0.24}" fill="${fill}" stroke="${dark}" stroke-width="2"/>
    ${specular(x - w / 2 + w * 0.18, cy - h / 2 + h * 0.05, w * 0.24, h * 0.9, 0.16, w * 0.12)}
    ${hexBolt(ctx, x, cy - h / 2 + h * 0.12, w * 0.26)}
    ${hexBolt(ctx, x, cy + h / 2 - h * 0.12, w * 0.26)}
  </g>`
}

/** Threaded pipe stub: cylinder with thread ridges. Points left or right. */
export function threadedStub(
  ctx: RenderContext,
  x: number,
  cy: number,
  len: number,
  dia: number,
  dir: 'left' | 'right',
  finish: FinishId = 'steel'
): string {
  const fill = metal(ctx, finish, 'v')
  const x0 = dir === 'left' ? x - len : x
  const ridges: string[] = []
  const step = len / 6
  for (let i = 1; i < 6; i++) {
    const rx = x0 + i * step
    ridges.push(
      `<line x1="${rx}" y1="${cy - dia / 2 + 2}" x2="${rx}" y2="${cy + dia / 2 - 2}" stroke="#3a4048" stroke-width="2.5" opacity="0.55"/>`
    )
  }
  return `<g>
    <rect x="${x0}" y="${cy - dia / 2}" width="${len}" height="${dia}" rx="${dia * 0.12}" fill="${fill}" stroke="#33383f" stroke-width="1.5"/>
    ${ridges.join('')}
    ${specular(x0 + 2, cy - dia / 2 + dia * 0.1, len - 4, dia * 0.16, 0.3)}
  </g>`
}

/** Cooling-fin / louvre array across a rectangle: vertical ribs. */
export function ribs(
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
  color = '#2f343a',
  opacity = 0.4,
  width = 3
): string {
  const parts: string[] = []
  const step = w / (count + 1)
  for (let i = 1; i <= count; i++) {
    parts.push(
      `<line x1="${x + i * step}" y1="${y}" x2="${x + i * step}" y2="${y + h}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`
    )
  }
  return parts.join('')
}

/** Handwheel seen face-on: rim, spokes, hub. */
export function handwheel(ctx: RenderContext, cx: number, cy: number, r: number, finish: FinishId): string {
  const rim = metal(ctx, finish, 'v')
  const hub = metalRadial(ctx, finish)
  const [, , , , dark] = PALETTES[finish]
  const spokes = [0, 120, 240]
    .map((deg) => {
      const a = ((deg - 90) * Math.PI) / 180
      return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * (r - 6)}" y2="${cy + Math.sin(a) * (r - 6)}" stroke="${dark}" stroke-width="${r * 0.16}" stroke-linecap="round"/>`
    })
    .join('')
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${rim}" stroke-width="${r * 0.22}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${dark}" stroke-width="2" opacity="0.6"/>
    ${spokes}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.28}" fill="${hub}" stroke="${dark}" stroke-width="2"/>
    <circle cx="${cx - r * 0.09}" cy="${cy - r * 0.1}" r="${r * 0.08}" fill="#ffffff" opacity="0.55"/>
  </g>`
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SceneOptions {
  seedKey: string
  finish: FinishId
  accent: FinishId
}

/** Runs a renderer and returns the complete standalone SVG document. */
export function renderScene(renderer: ShapeRenderer, options: SceneOptions): string {
  const random = mulberry32(hashString(options.seedKey))
  const defs = new Map<string, string>()
  const body: string[] = []

  const ctx: RenderContext = {
    rng: (min, max) => min + random() * (max - min),
    finish: options.finish,
    accent: options.accent,
    def: (id, fragment) => {
      if (!defs.has(id)) defs.set(id, fragment)
      return `url(#${id})`
    },
    add: (fragment) => {
      body.push(fragment)
    },
  }

  renderer(ctx)

  const { w, h } = CANVAS
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="studio-bg" cx="0.5" cy="0.38" r="0.85">
      <stop offset="0" stop-color="#fafbfc"/>
      <stop offset="0.55" stop-color="#f0f2f5"/>
      <stop offset="1" stop-color="#dde1e6"/>
    </radialGradient>
    <linearGradient id="studio-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6e9ed" stop-opacity="0"/>
      <stop offset="1" stop-color="#ced3da" stop-opacity="0.9"/>
    </linearGradient>
    <radialGradient id="studio-vignette" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
      <stop offset="0.82" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#22282f" stop-opacity="0.10"/>
    </radialGradient>
    ${[...defs.values()].join('\n    ')}
  </defs>
  <rect width="${w}" height="${h}" fill="url(#studio-bg)"/>
  <rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="url(#studio-floor)"/>
  ${body.join('\n  ')}
  <rect width="${w}" height="${h}" fill="url(#studio-vignette)"/>
</svg>`
}
