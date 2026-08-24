/**
 * Valve renders: ball, butterfly, gate, check, strainer, control.
 *
 * `ballValve` is the reference implementation for the whole render system —
 * read it before writing a new shape. The conventions it establishes:
 *
 *   - Compose around CANVAS.cx with the pipe axis near y ≈ 680.
 *   - Paint back-to-front: groundShadow → far parts → body → highlights.
 *   - Body material comes from ctx.finish, grips/trim from ctx.accent.
 *   - Use ctx.rng for small pose variation (a few degrees, a few pixels),
 *     never for anything that changes what the product *is*.
 */

import { CANVAS, type RenderContext, type ShapeRenderer } from '../types'
import {
  flange,
  groundShadow,
  handwheel,
  hexBolt,
  metal,
  metalRadial,
  ribs,
  sheet,
  specular,
  threadedStub,
  tones,
} from '../style'

const { cx } = CANVAS

/** Side-on hex end cap: three visible facets of a hexagon read as bands. */
function hexCap(ctx: RenderContext, x: number, cy: number, w: number, dia: number): string {
  const fill = metal(ctx, ctx.finish, 'v')
  const [, hi, , , dark] = tones(ctx.finish)
  const y = cy - dia / 2
  const facet = dia / 3
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${dia}" rx="${dia * 0.08}" fill="${fill}" stroke="${dark}" stroke-width="2.5"/>
    <rect x="${x}" y="${y + facet}" width="${w}" height="${facet}" fill="${hi}" opacity="0.28"/>
    <rect x="${x}" y="${y + facet * 2}" width="${w}" height="${facet}" fill="${dark}" opacity="0.3"/>
    <line x1="${x}" y1="${y + facet}" x2="${x + w}" y2="${y + facet}" stroke="${dark}" stroke-width="1.6" opacity="0.5"/>
    <line x1="${x}" y1="${y + facet * 2}" x2="${x + w}" y2="${y + facet * 2}" stroke="${dark}" stroke-width="1.6" opacity="0.5"/>
    <rect x="${x}" y="${y}" width="${w}" height="${dia * 0.14}" rx="${dia * 0.07}" fill="#ffffff" opacity="0.22"/>
  </g>`
}

export const ballValve: ShapeRenderer = (ctx) => {
  const axis = 680
  const bodyDia = 230
  const capDia = 195
  const bodyHalf = 260 + ctx.rng(-15, 15)
  const leverTilt = ctx.rng(-6.5, -2.5)

  const body = metal(ctx, ctx.finish, 'v')
  const [, , , , bodyDark] = tones(ctx.finish)
  const [, gripHi, gripMid, gripLow, gripDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 885, 520, 60))

  // End connections, outermost first.
  ctx.add(threadedStub(ctx, cx - bodyHalf - 150, axis, 110, 128, 'left', ctx.finish))
  ctx.add(threadedStub(ctx, cx + bodyHalf + 150, axis, 110, 128, 'right', ctx.finish))
  ctx.add(hexCap(ctx, cx - bodyHalf - 165, axis, 170, capDia))
  ctx.add(hexCap(ctx, cx + bodyHalf - 5, axis, 170, capDia))

  // Central body — a bulged cylinder with a seam collar at each end.
  ctx.add(`<rect x="${cx - bodyHalf}" y="${axis - bodyDia / 2}" width="${bodyHalf * 2}" height="${bodyDia}" rx="${bodyDia * 0.32}" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<rect x="${cx - bodyHalf + 14}" y="${axis - bodyDia / 2 + 16}" width="${bodyHalf * 2 - 28}" height="${bodyDia * 0.2}" rx="${bodyDia * 0.1}" fill="#ffffff" opacity="0.3"/>`)
  ctx.add(`<rect x="${cx - bodyHalf - 12}" y="${axis - bodyDia / 2 - 6}" width="26" height="${bodyDia + 12}" rx="10" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx + bodyHalf - 14}" y="${axis - bodyDia / 2 - 6}" width="26" height="${bodyDia + 12}" rx="10" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>`)

  // Stem and packing nut.
  const stemTop = axis - bodyDia / 2 - 120
  ctx.add(`<rect x="${cx - 26}" y="${stemTop + 30}" width="52" height="${axis - stemTop - 60}" rx="10" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="2"/>`)
  ctx.add(hexBolt(ctx, cx, stemTop + 42, 44))

  // Lever, tilted a touch so the pose reads as photographed, not drafted.
  ctx.add(`<g transform="rotate(${leverTilt.toFixed(1)} ${cx} ${stemTop + 30})">
    <rect x="${cx - 30}" y="${stemTop - 6}" width="470" height="60" rx="28" fill="${metal(ctx, 'steel', 'v')}" stroke="#2d3238" stroke-width="2.5"/>
    <rect x="${cx + 170}" y="${stemTop - 12}" width="290" height="72" rx="34" fill="${gripMid}" stroke="${gripDark}" stroke-width="2.5"/>
    <rect x="${cx + 186}" y="${stemTop - 2}" width="258" height="18" rx="9" fill="${gripHi}" opacity="0.55"/>
    <rect x="${cx + 186}" y="${stemTop + 40}" width="258" height="12" rx="6" fill="${gripLow}" opacity="0.6"/>
    ${ribs(cx + 200, stemTop - 8, 230, 64, 6, gripDark, 0.35, 4)}
    <circle cx="${cx}" cy="${stemTop + 24}" r="40" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2.5"/>
    <circle cx="${cx - 10}" cy="${stemTop + 14}" r="10" fill="#ffffff" opacity="0.5"/>
  </g>`)

  ctx.add(specular(cx - bodyHalf + 30, axis + bodyDia * 0.26, bodyHalf * 1.4, 14, 0.14))
}

/* -------------------------------------------------------------------------- */
/* Remaining valve shapes — authored against the ballValve reference.         */
/* -------------------------------------------------------------------------- */

/** Hex plug/nut on a vertical axis seen side-on: vertical facet bands. */
function hexPlugV(ctx: RenderContext, px: number, topY: number, w: number, h: number): string {
  const fill = metal(ctx, ctx.finish, 'h')
  const [, hi, , , dark] = tones(ctx.finish)
  const x = px - w / 2
  const facet = w / 3
  return `<g>
    <rect x="${x}" y="${topY}" width="${w}" height="${h}" rx="${w * 0.08}" fill="${fill}" stroke="${dark}" stroke-width="2"/>
    <rect x="${x + facet}" y="${topY}" width="${facet}" height="${h}" fill="${hi}" opacity="0.25"/>
    <line x1="${x + facet}" y1="${topY}" x2="${x + facet}" y2="${topY + h}" stroke="${dark}" stroke-width="1.4" opacity="0.5"/>
    <line x1="${x + facet * 2}" y1="${topY}" x2="${x + facet * 2}" y2="${topY + h}" stroke="${dark}" stroke-width="1.4" opacity="0.5"/>
    <rect x="${x}" y="${topY}" width="${w}" height="${h * 0.2}" rx="${h * 0.1}" fill="#ffffff" opacity="0.2"/>
  </g>`
}

/** Small domed cap nut seen face-on. */
function domeNut(ctx: RenderContext, px: number, py: number, r: number): string {
  return `<g>
    <circle cx="${px}" cy="${py}" r="${r}" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2"/>
    <circle cx="${px - r * 0.3}" cy="${py - r * 0.32}" r="${r * 0.28}" fill="#ffffff" opacity="0.5"/>
  </g>`
}

/**
 * Butterfly valve, wafer body seen face-on: annular body with peripheral bolt
 * holes, rubber seat, stainless disc on a vertical stem, ISO top plate with a
 * notched throttling quadrant and a lever pointing up-right.
 */
export const butterflyValve: ShapeRenderer = (ctx) => {
  const CY = 620
  const rOuter = 276 + ctx.rng(-6, 6)
  const rFace = rOuter * 0.81
  const rBore = rOuter * 0.66
  const leverAngle = ctx.rng(63, 73)
  const discTilt = ctx.rng(-3, 3)
  const pivotY = 232

  const [, bodyHi, , , bodyDark] = tones(ctx.finish)
  const [, gripHi, gripMid, gripLow, gripDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 905, 350, 48))

  // Neck rising from the ring to the actuator plate; painted first so the
  // ring covers its root.
  ctx.add(`<path d="M ${cx - 55} 262 L ${cx + 55} 262 L ${cx + 86} 410 L ${cx - 86} 410 Z" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx - 72}" y="300" width="144" height="26" rx="10" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="2"/>`)

  // Ring body.
  ctx.add(`<circle cx="${cx}" cy="${CY}" r="${rOuter}" fill="${metalRadial(ctx, ctx.finish)}" stroke="${bodyDark}" stroke-width="4"/>`)
  ctx.add(`<circle cx="${cx}" cy="${CY}" r="${rOuter - 11}" fill="none" stroke="#ffffff" stroke-width="9" opacity="0.16" stroke-dasharray="${(rOuter * 2.2).toFixed(0)} 2000" transform="rotate(-160 ${cx} ${CY})"/>`)
  ctx.add(`<circle cx="${cx}" cy="${CY}" r="${rFace}" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="2.5" opacity="0.98"/>`)

  // Peripheral bolt holes, offset so none collides with the neck.
  const holeR = rOuter * 0.062
  const holeRing = (rOuter + rFace) / 2
  for (let i = 0; i < 8; i++) {
    const a = ((22.5 + i * 45 - 90) * Math.PI) / 180
    const hx = cx + Math.cos(a) * holeRing
    const hy = CY + Math.sin(a) * holeRing
    ctx.add(`<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${holeR + 2}" fill="none" stroke="${bodyHi}" stroke-width="2" opacity="0.4"/>`)
    ctx.add(`<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${holeR}" fill="#23272c"/>`)
  }

  // Bore, seat liner, stem, disc.
  const bore = ctx.def(
    'bfv-bore',
    `<radialGradient id="bfv-bore" cx="0.42" cy="0.36" r="0.9">
      <stop offset="0" stop-color="#585f68"/>
      <stop offset="0.55" stop-color="#2c3138"/>
      <stop offset="1" stop-color="#121519"/>
    </radialGradient>`
  )
  ctx.add(`<circle cx="${cx}" cy="${CY}" r="${rBore}" fill="${bore}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<circle cx="${cx}" cy="${CY}" r="${rBore - 9}" fill="none" stroke="#1d2126" stroke-width="16"/>`)
  ctx.add(`<circle cx="${cx}" cy="${CY}" r="${rBore - 1}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.14"/>`)
  ctx.add(`<rect x="${cx - 11}" y="${CY - rBore + 14}" width="22" height="${rBore * 2 - 28}" rx="10" fill="${metal(ctx, 'steel', 'h')}" opacity="0.95"/>`)
  ctx.add(`<g transform="rotate(${discTilt.toFixed(1)} ${cx} ${CY})">
    <ellipse cx="${cx}" cy="${CY}" rx="${rBore * 0.34}" ry="${rBore * 0.93}" fill="${metalRadial(ctx, 'stainless')}" stroke="#4a5058" stroke-width="2.5"/>
    <ellipse cx="${cx - rBore * 0.1}" cy="${CY - rBore * 0.42}" rx="${rBore * 0.11}" ry="${rBore * 0.3}" fill="#ffffff" opacity="0.35"/>
    <circle cx="${cx}" cy="${CY}" r="${rBore * 0.19}" fill="${metalRadial(ctx, 'stainless')}" stroke="#4a5058" stroke-width="2"/>
    <circle cx="${cx - 6}" cy="${CY - 7}" r="6" fill="#ffffff" opacity="0.5"/>
  </g>`)

  // Bottom stem cover.
  ctx.add(`<rect x="${cx - 34}" y="${CY + rOuter - 16}" width="68" height="36" rx="12" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="2.5"/>`)

  // ISO mounting plate + notched quadrant.
  ctx.add(`<rect x="${cx - 100}" y="230" width="200" height="34" rx="9" fill="${metal(ctx, 'steel', 'v')}" stroke="#2d3238" stroke-width="2.5"/>`)
  ctx.add(hexBolt(ctx, cx - 72, 247, 12))
  ctx.add(hexBolt(ctx, cx + 72, 247, 12))
  const quad: string[] = [
    `<path d="M ${cx - 100} ${pivotY} A 100 100 0 0 1 ${cx + 100} ${pivotY} Z" fill="${metal(ctx, 'steel', 'v')}" stroke="#2d3238" stroke-width="2.5"/>`,
  ]
  for (let a = -72; a <= 72; a += 18) {
    const rad = (a * Math.PI) / 180
    quad.push(
      `<line x1="${(cx + Math.sin(rad) * 84).toFixed(1)}" y1="${(pivotY - Math.cos(rad) * 84).toFixed(1)}" x2="${(cx + Math.sin(rad) * 98).toFixed(1)}" y2="${(pivotY - Math.cos(rad) * 98).toFixed(1)}" stroke="#2d3238" stroke-width="3.5" opacity="0.6"/>`
    )
  }
  ctx.add(quad.join(''))

  // Lever with locking trigger, thrown to the upper right.
  ctx.add(`<g transform="rotate(${leverAngle.toFixed(1)} ${cx} ${pivotY})">
    <rect x="${cx + 14}" y="${pivotY - 150}" width="13" height="118" rx="6" fill="${metal(ctx, 'steel', 'v')}" stroke="#2d3238" stroke-width="1.5"/>
    <rect x="${cx - 16}" y="${pivotY - 262}" width="32" height="262" rx="13" fill="${metal(ctx, 'steel', 'h')}" stroke="#2d3238" stroke-width="2.5"/>
    <rect x="${cx - 22}" y="${pivotY - 272}" width="44" height="120" rx="18" fill="${gripMid}" stroke="${gripDark}" stroke-width="2.5"/>
    <rect x="${cx - 14}" y="${pivotY - 264}" width="10" height="104" rx="5" fill="${gripHi}" opacity="0.55"/>
    <rect x="${cx + 6}" y="${pivotY - 264}" width="8" height="104" rx="4" fill="${gripLow}" opacity="0.6"/>
    ${[0, 1, 2, 3, 4].map((i) => `<line x1="${cx - 20}" y1="${pivotY - 252 + i * 22}" x2="${cx + 20}" y2="${pivotY - 252 + i * 22}" stroke="${gripDark}" stroke-width="3" opacity="0.4"/>`).join('')}
    <circle cx="${cx}" cy="${pivotY}" r="28" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2.5"/>
    ${hexBolt(ctx, cx, pivotY, 13)}
  </g>`)

  ctx.add(specular(cx - rOuter * 0.62, CY + rOuter * 0.62, rOuter * 0.5, 12, 0.1))
}

/**
 * OS&Y gate valve: flanged ends, wedge body, bolted bonnet, open yoke with a
 * rising threaded stem through a foreshortened handwheel.
 */
export const gateValve: ShapeRenderer = (ctx) => {
  const axis = 770
  const bodyHalf = 182 + ctx.rng(-8, 8)
  const wheelR = 148 + ctx.rng(-6, 6)
  const wheelY = 300

  const [, , , , bodyDark] = tones(ctx.finish)
  const [, , , , accDark] = tones(ctx.accent)
  const bodyV = metal(ctx, ctx.finish, 'v')
  const bodyH = metal(ctx, ctx.finish, 'h')

  ctx.add(groundShadow(ctx, cx, 906, 440, 56))

  // Pipe ends.
  ctx.add(`<rect x="${cx - 344}" y="${axis - 94}" width="184" height="188" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx + 160}" y="${axis - 94}" width="184" height="188" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(specular(cx - 338, axis - 78, 172, 20, 0.25))
  ctx.add(specular(cx + 166, axis - 78, 172, 20, 0.25))
  ctx.add(flange(ctx, cx - 352, axis, 62, 274, ctx.finish))
  ctx.add(flange(ctx, cx + 352, axis, 62, 274, ctx.finish))

  // Body.
  ctx.add(`<rect x="${cx - bodyHalf}" y="${axis - 122}" width="${bodyHalf * 2}" height="244" rx="58" fill="${bodyV}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<path d="M ${cx - bodyHalf + 36} ${axis - 116} q -30 116 0 232" fill="none" stroke="${bodyDark}" stroke-width="2.5" opacity="0.25"/>`)
  ctx.add(`<path d="M ${cx + bodyHalf - 36} ${axis - 116} q 30 116 0 232" fill="none" stroke="${bodyDark}" stroke-width="2.5" opacity="0.25"/>`)
  ctx.add(specular(cx - bodyHalf + 26, axis - 104, bodyHalf * 2 - 52, 26, 0.28, 13))
  ctx.add(`<rect x="${cx - 62}" y="${axis + 118}" width="124" height="22" rx="8" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2"/>`)

  // Bonnet flange pair with through-bolts.
  ctx.add(`<rect x="${cx - 152}" y="648" width="304" height="30" rx="10" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx - 146}" y="622" width="292" height="30" rx="10" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(hexBolt(ctx, cx - 118, 649, 15))
  ctx.add(hexBolt(ctx, cx - 40, 649, 15))
  ctx.add(hexBolt(ctx, cx + 40, 649, 15))
  ctx.add(hexBolt(ctx, cx + 118, 649, 15))

  // Bonnet.
  ctx.add(`<path d="M ${cx - 128} 624 L ${cx - 88} 540 L ${cx + 88} 540 L ${cx + 128} 624 Z" fill="${bodyH}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx - 96}" y="518" width="192" height="28" rx="10" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)

  // Stem behind the yoke: plain below, threaded where it rises.
  ctx.add(`<rect x="${cx - 16}" y="210" width="32" height="330" rx="8" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="2"/>`)
  const threads: string[] = []
  for (let y = 218; y < 268; y += 9) {
    threads.push(`<line x1="${cx - 14}" y1="${y}" x2="${cx + 14}" y2="${y}" stroke="#3a4048" stroke-width="2" opacity="0.65"/>`)
  }
  ctx.add(threads.join(''))

  // Yoke arms + head.
  ctx.add(`<path d="M ${cx - 94} 528 L ${cx - 64} 528 L ${cx - 26} 348 L ${cx - 54} 348 Z" fill="${bodyH}" stroke="${bodyDark}" stroke-width="2"/>`)
  ctx.add(`<path d="M ${cx + 94} 528 L ${cx + 64} 528 L ${cx + 26} 348 L ${cx + 54} 348 Z" fill="${bodyH}" stroke="${bodyDark}" stroke-width="2"/>`)
  ctx.add(`<rect x="${cx - 78}" y="330" width="156" height="44" rx="14" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(specular(cx - 64, 336, 128, 10, 0.25))

  // Foreshortened handwheel: horizontal wheel seen from slightly above.
  const rimFill = metal(ctx, ctx.accent, 'v')
  ctx.add(`<ellipse cx="${cx}" cy="${wheelY}" rx="${wheelR}" ry="${wheelR * 0.3}" fill="none" stroke="${accDark}" stroke-width="27"/>`)
  ctx.add(`<ellipse cx="${cx}" cy="${wheelY}" rx="${wheelR}" ry="${wheelR * 0.3}" fill="none" stroke="${rimFill}" stroke-width="22"/>`)
  ctx.add(`<line x1="${cx - wheelR + 12}" y1="${wheelY + 2}" x2="${cx + wheelR - 12}" y2="${wheelY + 2}" stroke="${accDark}" stroke-width="11"/>`)
  ctx.add(`<line x1="${cx}" y1="${wheelY}" x2="${cx}" y2="${wheelY + wheelR * 0.3 - 4}" stroke="${accDark}" stroke-width="11"/>`)
  ctx.add(`<ellipse cx="${cx}" cy="${wheelY}" rx="42" ry="15" fill="${metalRadial(ctx, ctx.accent)}" stroke="${accDark}" stroke-width="2"/>`)
  ctx.add(`<ellipse cx="${cx - wheelR * 0.42}" cy="${wheelY - wheelR * 0.26}" rx="${wheelR * 0.34}" ry="9" fill="#ffffff" opacity="0.3" transform="rotate(-8 ${cx - wheelR * 0.42} ${wheelY - wheelR * 0.26})"/>`)

  // Stem tip through the hub, capped.
  ctx.add(`<rect x="${cx - 13}" y="196" width="26" height="112" rx="7" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="2"/>`)
  const tipThreads: string[] = []
  for (let y = 206; y < 262; y += 9) {
    tipThreads.push(`<line x1="${cx - 11}" y1="${y}" x2="${cx + 11}" y2="${y}" stroke="#3a4048" stroke-width="2" opacity="0.65"/>`)
  }
  ctx.add(tipThreads.join(''))
  ctx.add(domeNut(ctx, cx, 192, 19))
}

/**
 * Swing check valve: squat horizontal body with threaded hex ends, a bolted
 * round access cover on the raised bonnet, hinge-pin boss and a raised cast
 * flow arrow.
 */
export const checkValve: ShapeRenderer = (ctx) => {
  const axis = 690
  const bodyHalf = 245 + ctx.rng(-10, 10)
  const dia = 220
  const arrowLen = 250 + ctx.rng(-12, 12)

  const [, bodyHi, , , bodyDark] = tones(ctx.finish)
  const bodyV = metal(ctx, ctx.finish, 'v')

  ctx.add(groundShadow(ctx, cx, 888, 480, 56))

  // Threaded ends + hex unions.
  ctx.add(threadedStub(ctx, cx - bodyHalf - 140, axis, 100, 122, 'left', ctx.finish))
  ctx.add(threadedStub(ctx, cx + bodyHalf + 140, axis, 100, 122, 'right', ctx.finish))
  ctx.add(hexCap(ctx, cx - bodyHalf - 155, axis, 160, 182))
  ctx.add(hexCap(ctx, cx + bodyHalf - 5, axis, 160, 182))

  // Bonnet neck + bolted cover, painted before the body so its root is buried.
  ctx.add(`<path d="M ${cx - 105} 600 L ${cx - 80} 508 L ${cx + 80} 508 L ${cx + 105} 600 Z" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx - 128}" y="474" width="256" height="38" rx="15" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(specular(cx - 112, 480, 224, 10, 0.3))
  ctx.add(hexBolt(ctx, cx - 90, 493, 14))
  ctx.add(hexBolt(ctx, cx, 493, 14))
  ctx.add(hexBolt(ctx, cx + 90, 493, 14))

  // Body.
  ctx.add(`<rect x="${cx - bodyHalf}" y="${axis - dia / 2}" width="${bodyHalf * 2}" height="${dia}" rx="${dia * 0.3}" fill="${bodyV}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<line x1="${cx - bodyHalf + 24}" y1="${axis + 6}" x2="${cx + bodyHalf - 24}" y2="${axis + 6}" stroke="${bodyDark}" stroke-width="2" opacity="0.18"/>`)
  ctx.add(specular(cx - bodyHalf + 22, axis - dia / 2 + 16, bodyHalf * 2 - 44, dia * 0.18, 0.3))

  // Hinge-pin boss on the upstream shoulder.
  ctx.add(`<circle cx="${cx - bodyHalf + 55}" cy="${axis - 62}" r="30" fill="${metalRadial(ctx, ctx.finish)}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(hexBolt(ctx, cx - bodyHalf + 55, axis - 62, 14))

  // Raised cast flow arrow, lit from the upper left.
  const ax0 = cx - arrowLen / 2 - 20
  const ay = axis + 58
  const head = 52
  const shaftH = 13
  const arrow = (dx: number, dy: number) =>
    `M ${ax0 + dx} ${ay - shaftH + dy} L ${ax0 + arrowLen - head + dx} ${ay - shaftH + dy} L ${ax0 + arrowLen - head + dx} ${ay - 30 + dy} L ${ax0 + arrowLen + dx} ${ay + dy} L ${ax0 + arrowLen - head + dx} ${ay + 30 + dy} L ${ax0 + arrowLen - head + dx} ${ay + shaftH + dy} L ${ax0 + dx} ${ay + shaftH + dy} Z`
  ctx.add(`<path d="${arrow(3, 4)}" fill="${bodyDark}" opacity="0.55"/>`)
  ctx.add(`<path d="${arrow(0, 0)}" fill="${bodyHi}" opacity="0.4" stroke="${bodyDark}" stroke-width="1.5" />`)
}

/**
 * Y-strainer: flanged horizontal body with a 33° screen leg running down to a
 * bolted cap and blow-down plug.
 */
export const strainer: ShapeRenderer = (ctx) => {
  const axis = 590
  const bodyHalf = 285 + ctx.rng(-10, 10)
  const dia = 210
  const legAngle = ctx.rng(31, 35)

  const [, , , , bodyDark] = tones(ctx.finish)
  const bodyV = metal(ctx, ctx.finish, 'v')

  ctx.add(groundShadow(ctx, cx + 70, 902, 410, 54))

  // Pipe stubs + end flanges.
  ctx.add(`<rect x="${cx - 345}" y="${axis - 97}" width="80" height="194" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx + 265}" y="${axis - 97}" width="80" height="194" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(flange(ctx, cx - 352, axis, 64, 300, ctx.finish))
  ctx.add(flange(ctx, cx + 352, axis, 64, 300, ctx.finish))

  // Screen leg, drawn behind the body so the joint reads as a cast fillet.
  ctx.add(`<g transform="rotate(${legAngle.toFixed(1)} ${cx} ${axis})">
    <path d="M ${cx + 60} ${axis - 102} L ${cx + 370} ${axis - 80} L ${cx + 370} ${axis + 80} L ${cx + 60} ${axis + 102} Z" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>
    <line x1="${cx + 120}" y1="${axis - 72}" x2="${cx + 362}" y2="${axis - 58}" stroke="#ffffff" stroke-width="10" opacity="0.22" stroke-linecap="round"/>
    <line x1="${cx + 120}" y1="${axis + 72}" x2="${cx + 362}" y2="${axis + 58}" stroke="${bodyDark}" stroke-width="6" opacity="0.3" stroke-linecap="round"/>
    <rect x="${cx + 330}" y="${axis - 84}" width="18" height="168" fill="${bodyDark}" opacity="0.25"/>
    ${flange(ctx, cx + 385, axis, 46, 215, ctx.finish)}
    ${threadedStub(ctx, cx + 408, axis, 58, 70, 'right', 'steel')}
    ${hexCap(ctx, cx + 466, axis, 46, 96)}
  </g>`)

  // Body.
  ctx.add(`<rect x="${cx - bodyHalf}" y="${axis - dia / 2}" width="${bodyHalf * 2}" height="${dia}" rx="52" fill="${bodyV}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<line x1="${cx - bodyHalf + 30}" y1="${axis + 4}" x2="${cx + bodyHalf - 30}" y2="${axis + 4}" stroke="${bodyDark}" stroke-width="2" opacity="0.16"/>`)
  ctx.add(specular(cx - bodyHalf + 26, axis - dia / 2 + 16, bodyHalf * 2 - 60, dia * 0.17, 0.3))

  // Gauge-port boss on top.
  ctx.add(`<rect x="${cx - 40}" y="${axis - dia / 2 - 44}" width="80" height="54" rx="10" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(hexPlugV(ctx, cx, axis - dia / 2 - 76, 68, 36))
}

/**
 * Pneumatic globe control valve: flanged globe body, open yoke with stem and
 * travel clamp, spring-diaphragm actuator dome with a bolted rim, side
 * positioner with a gauge, and an air line into the diaphragm case.
 */
export const controlValve: ShapeRenderer = (ctx) => {
  const axis = 780
  const domeR = 288 + ctx.rng(-8, 8)
  const needleAngle = ctx.rng(-50, 15)

  const [, , , , bodyDark] = tones(ctx.finish)
  const [, , , , accDark] = tones(ctx.accent)
  const bodyV = metal(ctx, ctx.finish, 'v')
  const accV = metal(ctx, ctx.accent, 'v')
  const accTones = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 906, 430, 54))

  // Pipe ends + flanges + globe body.
  ctx.add(`<rect x="${cx - 300}" y="${axis - 88}" width="180" height="176" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx + 120}" y="${axis - 88}" width="180" height="176" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(specular(cx - 292, axis - 72, 164, 18, 0.25))
  ctx.add(specular(cx + 128, axis - 72, 164, 18, 0.25))
  ctx.add(flange(ctx, cx - 318, axis, 62, 252, ctx.finish))
  ctx.add(flange(ctx, cx + 318, axis, 62, 252, ctx.finish))
  ctx.add(`<circle cx="${cx}" cy="${axis + 2}" r="132" fill="${metalRadial(ctx, ctx.finish)}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<ellipse cx="${cx - 42}" cy="${axis - 58}" rx="40" ry="22" fill="#ffffff" opacity="0.3"/>`)

  // Bonnet + gland.
  ctx.add(`<rect x="${cx - 72}" y="640" width="144" height="34" rx="11" fill="${bodyV}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(hexBolt(ctx, cx - 46, 657, 12))
  ctx.add(hexBolt(ctx, cx + 46, 657, 12))

  // Stem + travel clamp, then the yoke legs over it.
  ctx.add(`<rect x="${cx - 14}" y="478" width="28" height="178" rx="7" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="2"/>`)
  ctx.add(`<rect x="${cx - 27}" y="554" width="54" height="30" rx="7" fill="${accTones[2]}" stroke="${accDark}" stroke-width="2"/>`)
  ctx.add(`<path d="M ${cx - 84} 648 L ${cx - 50} 648 L ${cx - 24} 470 L ${cx - 52} 470 Z" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2"/>`)
  ctx.add(`<path d="M ${cx + 84} 648 L ${cx + 50} 648 L ${cx + 24} 470 L ${cx + 52} 470 Z" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2"/>`)

  // Positioner on the yoke with a pressure gauge and an air line to the dome.
  ctx.add(`<rect x="${cx + 100}" y="530" width="46" height="30" fill="${tones('machineGray')[3]}" stroke="#41454c" stroke-width="2"/>`)
  ctx.add(`<path d="M ${cx + 230} 470 C ${cx + 242} 420 ${cx + 214} 396 ${cx + 178} 380" fill="none" stroke="#33383f" stroke-width="9" stroke-linecap="round"/>`)
  ctx.add(`<path d="M ${cx + 230} 470 C ${cx + 242} 420 ${cx + 214} 396 ${cx + 178} 380" fill="none" stroke="#9aa2ac" stroke-width="5" stroke-linecap="round"/>`)
  ctx.add(`<rect x="${cx + 140}" y="470" width="142" height="170" rx="14" fill="${sheet(ctx, 'machineGray')}" stroke="#41454c" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${cx + 156}" y="486" width="110" height="72" rx="8" fill="${tones('machineGray')[1]}" opacity="0.5"/>`)
  ctx.add(`<circle cx="${cx + 211}" cy="${600}" r="27" fill="${metalRadial(ctx, 'stainless')}" stroke="#40464e" stroke-width="2.5"/>`)
  ctx.add(`<circle cx="${cx + 211}" cy="${600}" r="19" fill="#f4f6f8"/>`)
  ctx.add(`<line x1="${cx + 211}" y1="600" x2="${(cx + 211 + Math.sin((needleAngle * Math.PI) / 180) * 15).toFixed(1)}" y2="${(600 - Math.cos((needleAngle * Math.PI) / 180) * 15).toFixed(1)}" stroke="#c3272b" stroke-width="2.5" stroke-linecap="round"/>`)
  ctx.add(`<circle cx="${cx + 211}" cy="600" r="3" fill="#33383f"/>`)

  // Actuator: lower dish, rim band with bolts, spun top dome, air fitting.
  ctx.add(`<rect x="${cx - 88}" y="452" width="176" height="38" rx="12" fill="${accV}" stroke="${accDark}" stroke-width="2.5"/>`)
  ctx.add(`<path d="M ${cx - domeR + 6} 376 Q ${cx} 462 ${cx + domeR - 6} 376 L ${cx + domeR - 6} 364 L ${cx - domeR + 6} 364 Z" fill="${accTones[3]}" stroke="${accDark}" stroke-width="2"/>`)
  ctx.add(`<path d="M ${cx - domeR} 356 A ${domeR} ${domeR * 0.55} 0 0 1 ${cx + domeR} 356 Z" fill="${accV}" stroke="${accDark}" stroke-width="3"/>`)
  ctx.add(`<ellipse cx="${cx - 100}" cy="262" rx="128" ry="30" fill="#ffffff" opacity="0.26" transform="rotate(-11 ${cx - 100} 262)"/>`)
  ctx.add(`<rect x="${cx - domeR - 8}" y="352" width="${domeR * 2 + 16}" height="28" rx="13" fill="${accV}" stroke="${accDark}" stroke-width="2.5"/>`)
  for (let i = 0; i < 7; i++) {
    ctx.add(hexBolt(ctx, cx - 234 + i * 78, 366, 12))
  }
  ctx.add(`<rect x="${cx - 16}" y="162" width="32" height="42" rx="7" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="2"/>`)
  ctx.add(domeNut(ctx, cx, 158, 15))
}

/**
 * Obvious-on-sight placeholder so an unauthored shape is caught in review,
 * never mistaken for a finished render. Remove once every shape is real.
 */
export function placeholderBody(ctx: RenderContext, _key: string): void {
  ctx.add(groundShadow(ctx, cx, 900, 430, 56))
  ctx.add(`<rect x="${cx - 330}" y="420" width="660" height="440" rx="36" fill="${metal(ctx, ctx.finish, 'v')}" stroke="#3a4048" stroke-width="3"/>`)
  ctx.add(`<circle cx="${cx}" cy="640" r="130" fill="${metalRadial(ctx, ctx.accent)}" stroke="#3a4048" stroke-width="3"/>`)
  ctx.add(specular(cx - 300, 448, 600, 40, 0.3))
}

/* Referenced by the gate/globe shapes agents will author. */
export const valveHelpers = { hexCap, flange, handwheel }
