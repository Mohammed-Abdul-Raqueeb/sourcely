/**
 * Electrical renders: breaker, breaker-mcb, contactor, distribution-board,
 * cable-tray, motor, vfd.
 *
 * Follow the `ballValve` reference in ./valves.ts for conventions.
 * Custom gradient def ids in this module are prefixed `el-`.
 */

import { CANVAS, type RenderContext, type ShapeRenderer } from '../types'
import { groundShadow, metal, metalRadial, sheet, specular, tones } from '../style'

const { cx } = CANVAS

/* -------------------------------------------------------------------------- */
/* Local helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Rounded rect shorthand. */
function rr(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  fill: string,
  stroke = '',
  sw = 0,
  opacity?: number
): string {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''
  const o = opacity !== undefined ? ` opacity="${opacity}"` : ''
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx.toFixed(1)}" fill="${fill}"${s}${o}/>`
}

function ln(x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, opacity = 1): string {
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${w}" opacity="${opacity}"/>`
}

/** Horizontal sheen overlay that gives a flat moulded face gentle curvature. */
function faceSheen(ctx: RenderContext): string {
  return ctx.def(
    'el-face-sheen',
    `<linearGradient id="el-face-sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/>
      <stop offset="0.22" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="0.6" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.20"/>
    </linearGradient>`
  )
}

/** Top-down inner shadow for recessed pans and wells. */
function innerShade(ctx: RenderContext): string {
  return ctx.def(
    'el-inner-shade',
    `<linearGradient id="el-inner-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.38"/>
      <stop offset="0.35" stop-color="#000000" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>`
  )
}

/** Slotted / cross-recess screw head. */
function screwHead(ctx: RenderContext, x: number, y: number, r: number, ang: number, cross = false): string {
  const fill = metalRadial(ctx, 'steel')
  const slots = [ang, ...(cross ? [ang + 90] : [])]
    .map((a) => {
      const rad = (a * Math.PI) / 180
      const dx = Math.cos(rad) * (r - r * 0.22)
      const dy = Math.sin(rad) * (r - r * 0.22)
      return ln(x - dx, y - dy, x + dx, y + dy, '#23272c', Math.max(2, r * 0.22), 0.85)
    })
    .join('')
  return `<g>
    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" stroke="#2b3036" stroke-width="${Math.max(1.5, r * 0.1)}"/>
    ${slots}
    <circle cx="${(x - r * 0.28).toFixed(1)}" cy="${(y - r * 0.3).toFixed(1)}" r="${(r * 0.2).toFixed(1)}" fill="#ffffff" opacity="0.5"/>
  </g>`
}

/** Blank printed label / nameplate: light plate with faint print bars, no text. */
function plate(ctx: RenderContext, x: number, y: number, w: number, h: number, lines: number): string {
  const fill = ctx.def(
    'el-plate',
    `<linearGradient id="el-plate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fdfefe"/>
      <stop offset="0.6" stop-color="#eceef1"/>
      <stop offset="1" stop-color="#d9dde2"/>
    </linearGradient>`
  )
  const widths = [0.86, 0.6, 0.74, 0.5, 0.66]
  const pad = h * 0.18
  const gap = (h - pad * 2) / Math.max(1, lines)
  const bars: string[] = []
  for (let i = 0; i < lines; i++) {
    bars.push(rr(x + w * 0.08, y + pad + i * gap, (w * 0.84) * (widths[i % widths.length] ?? 0.6), Math.min(9, gap * 0.36), 3, '#8b929b', '', 0, 0.6))
  }
  return `<g>
    ${rr(x, y, w, h, 6, fill, '#9aa1a9', 2)}
    ${bars.join('')}
  </g>`
}

/** Dark recessed well with a rim highlight along the bottom edge. */
function well(ctx: RenderContext, x: number, y: number, w: number, h: number, rx: number): string {
  return `<g>
    ${rr(x, y, w, h, rx, '#1b1f24', '#0b0d10', 2.5)}
    ${rr(x + 2, y + 2, w - 4, h * 0.6, rx * 0.8, innerShade(ctx))}
    ${rr(x + rx * 0.5, y + h - 4, w - rx, 3, 1.5, '#ffffff', '', 0, 0.18)}
  </g>`
}

/** Recessed terminal: dark pocket, accent-metal lug, cross screw. */
function copperTerm(ctx: RenderContext, x: number, y: number, w: number, h: number, ang: number): string {
  const lug = metal(ctx, ctx.accent, 'v')
  const [, , , , lugDark] = tones(ctx.accent)
  return `<g>
    ${well(ctx, x, y, w, h, 10)}
    ${rr(x + w * 0.14, y + h * 0.42, w * 0.72, h * 0.44, 5, lug, lugDark, 2)}
    ${rr(x + w * 0.18, y + h * 0.46, w * 0.64, h * 0.1, 4, '#ffffff', '', 0, 0.35)}
    ${screwHead(ctx, x + w / 2, y + h * 0.42, Math.min(w, h) * 0.26, ang, true)}
  </g>`
}

/** Moulded rivet on a plastic case face. */
function rivet(x: number, y: number, r: number, mid: string, dark: string): string {
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${mid}" stroke="${dark}" stroke-width="1.6"/>
    <circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.28}" fill="#ffffff" opacity="0.4"/>
    <circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="${dark}" opacity="0.35"/>
  </g>`
}

/* -------------------------------------------------------------------------- */
/* breaker — moulded-case circuit breaker (MCCB), 3 pole, front-on            */
/* -------------------------------------------------------------------------- */

export const breaker: ShapeRenderer = (ctx) => {
  const W = 600
  const H = 880
  const x0 = cx - W / 2
  const y0 = 150
  const y1 = y0 + H
  const [, hi, mid, , dark] = tones(ctx.finish)
  const face = sheet(ctx, ctx.finish)
  const tilt = ctx.rng(-1.1, 1.1)
  const toggleUp = ctx.rng(-12, 4)
  const p: string[] = []

  ctx.add(groundShadow(ctx, cx, 1080, 400, 50))

  // Moulded case with bevelled face.
  p.push(rr(x0, y0, W, H, 26, face, dark, 3.5))
  p.push(rr(x0, y0, W, H, 26, faceSheen(ctx)))
  p.push(rr(x0 + 10, y0 + 10, W - 20, H - 20, 20, 'none', hi, 2, 0.3))

  // Terminal zones, three poles top and bottom.
  const poles = [cx - 200, cx, cx + 200]
  for (const band of [y0 + 26, y1 - 148]) {
    p.push(rr(x0 + 16, band - 8, W - 32, 138, 14, '#000000', '', 0, 0.12))
    poles.forEach((px, i) => {
      p.push(copperTerm(ctx, px - 66, band, 132, 122, 25 + i * 40 + ctx.rng(-14, 14)))
    })
  }
  // Pole separation grooves.
  for (const gx of [cx - 100, cx + 100]) {
    p.push(ln(gx, y0 + 16, gx, y0 + 172, dark, 3, 0.5))
    p.push(ln(gx, y1 - 172, gx, y1 - 16, dark, 3, 0.5))
    p.push(ln(gx, y0 + 172, gx, y1 - 172, dark, 2, 0.18))
  }

  // Embossed brand block.
  p.push(rr(cx - 120, y0 + 208, 240, 44, 9, '#000000', '', 0, 0.16))
  p.push(rr(cx - 120, y0 + 208, 240, 44, 9, 'none', hi, 1.5, 0.3))

  // Toggle well with ON / OFF marks and the big handle.
  const wellY = 460
  p.push(well(ctx, cx - 105, wellY, 210, 300, 18))
  p.push(rr(cx - 30, wellY + 14, 60, 12, 5, '#3fae5c', '', 0, 0.85))
  p.push(rr(cx - 30, wellY + 274, 60, 12, 5, '#c0392b', '', 0, 0.85))
  const tY = wellY + 96 + toggleUp
  p.push(`<g transform="rotate(${ctx.rng(-1.6, 1.6).toFixed(1)} ${cx} ${tY + 54})">
    ${rr(cx - 76, tY, 152, 108, 16, metal(ctx, 'plasticBlack', 'v'), '#050607', 2.5)}
    ${rr(cx - 62, tY + 12, 124, 18, 9, '#ffffff', '', 0, 0.2)}
    ${ln(cx - 56, tY + 48, cx + 56, tY + 48, '#000000', 4, 0.5)}
    ${ln(cx - 56, tY + 66, cx + 56, tY + 66, '#000000', 4, 0.5)}
    ${ln(cx - 56, tY + 84, cx + 56, tY + 84, '#000000', 4, 0.5)}
  </g>`)

  // Trip test button and amber rating-adjust dial (accent).
  p.push(`<circle cx="${cx - 190}" cy="640" r="26" fill="${metal(ctx, 'plasticBlack', 'v')}" stroke="#08090b" stroke-width="2"/>`)
  p.push(`<circle cx="${cx - 196}" cy="632" r="7" fill="#ffffff" opacity="0.35"/>`)
  p.push(`<circle cx="${cx + 190}" cy="640" r="30" fill="${metalRadial(ctx, ctx.accent)}" stroke="#3a2c12" stroke-width="2.5"/>`)
  p.push(ln(cx + 190, 618, cx + 190, 640, '#2c2313', 5, 0.8))

  // Rating plate and corner screws.
  p.push(plate(ctx, cx - 150, 800, 300, 92, 3))
  const inset = 36
  p.push(screwHead(ctx, x0 + inset, y0 + inset, 13, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + W - inset, y0 + inset, 13, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + inset, y1 - inset, 13, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + W - inset, y1 - inset, 13, ctx.rng(0, 180)))

  p.push(rr(x0 + 26, y0 + 20, W - 150, 22, 11, '#ffffff', '', 0, 0.16))
  p.push(rr(x0 + 18, y0 + 60, 16, H - 120, 8, mid, '', 0, 0.25))

  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} ${cx} 590)">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* breaker-mcb — DIN-rail miniature circuit breaker, tall narrow module       */
/* -------------------------------------------------------------------------- */

export const breakerMcb: ShapeRenderer = (ctx) => {
  const W = 300
  const H = 880
  const x0 = cx - W / 2
  const y0 = 160
  const y1 = y0 + H
  const [, hi, mid, low, dark] = tones(ctx.finish)
  const face = sheet(ctx, ctx.finish)
  const tilt = ctx.rng(-1.3, 1.3)
  const p: string[] = []

  ctx.add(groundShadow(ctx, cx, 1078, 240, 42))

  // DIN clip tab peeking out below the case.
  p.push(rr(cx - 52, y1 - 6, 104, 34, 8, metal(ctx, 'plasticGray', 'v'), '#2f343a', 2))

  // Case.
  p.push(rr(x0, y0, W, H, 20, face, dark, 3))
  p.push(rr(x0, y0, W, H, 20, faceSheen(ctx)))
  p.push(rr(x0 + 8, y0 + 8, W - 16, H - 16, 15, 'none', hi, 2, 0.3))

  // Top and bottom terminal zones with recessed captive screws.
  for (const [band, flip] of [
    [y0 + 18, 1],
    [y1 - 136, -1],
  ] as const) {
    p.push(rr(x0 + 12, band, W - 24, 118, 12, '#000000', '', 0, 0.13))
    p.push(well(ctx, cx - 44, band + 18, 88, 84, 12))
    p.push(screwHead(ctx, cx, band + 60, 27, ctx.rng(0, 180)))
    p.push(ln(x0 + 20, band + (flip === 1 ? 118 : 0), x0 + W - 20, band + (flip === 1 ? 118 : 0), dark, 2.5, 0.45))
  }

  // Embossed brand block.
  p.push(rr(cx - 90, y0 + 158, 180, 40, 8, '#000000', '', 0, 0.15))
  p.push(rr(cx - 90, y0 + 158, 180, 40, 8, 'none', hi, 1.5, 0.3))

  // Raised escutcheon carrying the toggle.
  p.push(rr(x0 + 22, 392, W - 44, 330, 16, hi, dark, 2, 0.99))
  p.push(rr(x0 + 22, 392, W - 44, 330, 16, faceSheen(ctx)))
  p.push(rr(x0 + 22, 392, W - 44, 330, 16, '#000000', '', 0, 0.06))

  // Toggle window and the accent-coloured handle, flicked to ON.
  p.push(well(ctx, cx - 54, 428, 108, 212, 14))
  const [, accHi, , , accDark] = tones(ctx.accent)
  const tTop = 452 + ctx.rng(-8, 8)
  p.push(`<g transform="rotate(${ctx.rng(-1.5, 1.5).toFixed(1)} ${cx} ${tTop + 50})">
    ${rr(cx - 40, tTop, 80, 100, 12, metal(ctx, ctx.accent, 'v'), accDark, 2.5)}
    ${rr(cx - 30, tTop + 8, 60, 14, 7, accHi, '', 0, 0.6)}
    ${ln(cx - 26, tTop + 44, cx + 26, tTop + 44, accDark, 4, 0.6)}
    ${ln(cx - 26, tTop + 62, cx + 26, tTop + 62, accDark, 4, 0.6)}
    ${ln(cx - 26, tTop + 80, cx + 26, tTop + 80, accDark, 4, 0.6)}
  </g>`)

  // Status flag window beside the toggle base.
  p.push(rr(cx + 62, 656, 36, 28, 5, '#111417', '#000000', 2))
  p.push(rr(cx + 66, 660, 28, 20, 3, '#c0392b', '', 0, 0.9))
  p.push(rr(cx + 66, 660, 28, 8, 3, '#ffffff', '', 0, 0.25))

  // Printed specification label.
  p.push(plate(ctx, cx - 96, 742, 192, 118, 4))

  // Case rivets down both margins.
  for (const ry of [380, 620, 900]) {
    p.push(rivet(x0 + 34, ry, 10, mid, dark))
    p.push(rivet(x0 + W - 34, ry, 10, mid, dark))
  }

  p.push(rr(x0 + 18, y0 + 16, W - 96, 18, 9, '#ffffff', '', 0, 0.16))
  p.push(rr(x0 + 12, y0 + 50, 12, H - 110, 6, low, '', 0, 0.25))

  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} ${cx} 600)">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* contactor — DIN-rail motor contactor, squat block, front-on                */
/* -------------------------------------------------------------------------- */

export const contactor: ShapeRenderer = (ctx) => {
  const W = 720
  const H = 800
  const x0 = cx - W / 2
  const y0 = 170
  const y1 = y0 + H
  const [, hi, mid, , dark] = tones(ctx.finish)
  const face = sheet(ctx, ctx.finish)
  const tilt = ctx.rng(-1, 1)
  const p: string[] = []

  ctx.add(groundShadow(ctx, cx, 1008, 460, 54))

  // Case.
  p.push(rr(x0, y0, W, H, 24, face, dark, 3.5))
  p.push(rr(x0, y0, W, H, 24, faceSheen(ctx)))
  p.push(rr(x0 + 10, y0 + 10, W - 20, H - 20, 18, 'none', hi, 2, 0.3))

  // Power terminal banks, three poles top and bottom, plus coil terminals.
  const poles = [cx - 210, cx, cx + 210]
  for (const band of [y0 + 24, y1 - 146]) {
    p.push(rr(x0 + 14, band - 6, W - 28, 134, 14, '#000000', '', 0, 0.12))
    poles.forEach((px, i) => {
      p.push(copperTerm(ctx, px - 72, band, 144, 122, 30 + i * 35 + ctx.rng(-12, 12)))
    })
    p.push(ln(cx - 105, band, cx - 105, band + 122, dark, 2.5, 0.4))
    p.push(ln(cx + 105, band, cx + 105, band + 122, dark, 2.5, 0.4))
  }
  p.push(screwHead(ctx, x0 + 42, y0 + 46, 16, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + W - 42, y0 + 46, 16, ctx.rng(0, 180)))

  // Fine vent ribs along both face margins.
  for (let i = 0; i < 5; i++) {
    p.push(ln(x0 + 28 + i * 11, 430, x0 + 28 + i * 11, 660, dark, 3, 0.3))
    p.push(ln(x0 + W - 28 - i * 11, 430, x0 + W - 28 - i * 11, 660, dark, 3, 0.3))
  }

  // Central recessed window with the moving contact carrier.
  p.push(well(ctx, cx - 156, 420, 312, 230, 16))
  const carY = 448 + ctx.rng(-6, 6)
  p.push(rr(cx - 124, carY, 248, 168, 10, metal(ctx, ctx.finish, 'v'), dark, 2.5))
  p.push(rr(cx - 112, carY + 10, 224, 22, 10, '#ffffff', '', 0, 0.22))
  for (const sx of [cx - 74, cx, cx + 74]) {
    p.push(rr(sx - 17, carY + 22, 34, 124, 8, '#14171b', '#000000', 1.5))
    p.push(rr(sx - 12, carY + 28, 24, 12, 5, '#ffffff', '', 0, 0.12))
  }

  // Embossed brand block and printed rating plate.
  p.push(rr(cx - 110, y0 + 180, 220, 40, 8, '#000000', '', 0, 0.15))
  p.push(rr(cx - 110, y0 + 180, 220, 40, 8, 'none', hi, 1.5, 0.3))
  p.push(plate(ctx, cx - 165, 686, 330, 84, 2))

  // Pole cover screws.
  p.push(screwHead(ctx, cx - 260, 438, 15, ctx.rng(0, 180)))
  p.push(screwHead(ctx, cx + 260, 438, 15, ctx.rng(0, 180)))
  p.push(screwHead(ctx, cx - 260, 640, 15, ctx.rng(0, 180)))
  p.push(screwHead(ctx, cx + 260, 640, 15, ctx.rng(0, 180)))

  p.push(rr(x0 + 26, y0 + 18, W - 180, 20, 10, '#ffffff', '', 0, 0.16))
  p.push(rr(x0 + 16, y0 + 60, 14, H - 120, 7, mid, '', 0, 0.22))

  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} ${cx} 570)">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* distribution-board — wall enclosure, cover off, two rows of MCB modules    */
/* -------------------------------------------------------------------------- */

export const distributionBoard: ShapeRenderer = (ctx) => {
  const W = 1060
  const H = 740
  const x0 = cx - W / 2
  const y0 = 200
  const y1 = y0 + H
  const [, hi, , , dark] = tones(ctx.finish)
  const shell = sheet(ctx, ctx.finish)
  const p: string[] = []

  ctx.add(groundShadow(ctx, cx, 990, 580, 60))

  // Folded sheet-steel enclosure flange.
  p.push(rr(x0, y0, W, H, 20, shell, dark, 3.5))
  p.push(rr(x0, y0, W, H, 20, faceSheen(ctx)))
  p.push(rr(x0 + 16, y0 + 16, W - 32, H - 32, 12, 'none', dark, 2, 0.35))
  p.push(rr(x0 + 14, y0 + 12, W - 28, 16, 8, '#ffffff', '', 0, 0.28))

  // Embossed brand strip on the flange.
  p.push(rr(cx - 80, y0 + 22, 160, 26, 6, '#000000', '', 0, 0.15))

  // Interior pan.
  const ix = x0 + 62
  const iy = y0 + 62
  const iw = W - 124
  const ih = H - 124
  const modFill = ctx.def(
    'el-dbmod',
    `<linearGradient id="el-dbmod" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbfcfd"/>
      <stop offset="0.55" stop-color="#e2e5e9"/>
      <stop offset="1" stop-color="#c7ccd1"/>
    </linearGradient>`
  )
  p.push(rr(ix, iy, iw, ih, 10, '#c2c7cd', dark, 2.5))
  p.push(rr(ix, iy, iw, ih, 10, innerShade(ctx)))

  // Two DIN rows of modules.
  const modW = 60
  const modH = 168
  const count = 13
  const rowX = cx - (count * modW) / 2
  const blanks = new Set([Math.floor(ctx.rng(8, 11)), Math.floor(ctx.rng(11, 13))])
  for (const rowY of [iy + 44, iy + 322]) {
    // DIN rail behind the row.
    p.push(rr(rowX - 24, rowY + modH / 2 - 17, count * modW + 48, 34, 4, metal(ctx, 'steel', 'v'), '#3a4048', 2))
    for (let i = 0; i < count; i++) {
      const mx = rowX + i * modW
      if (blanks.has(i)) {
        p.push(rr(mx + 2, rowY, modW - 4, modH, 5, '#b9bec5', '#8f959c', 1.5))
        p.push(rr(mx + 2, rowY, modW - 4, modH * 0.16, 5, '#ffffff', '', 0, 0.3))
        continue
      }
      p.push(rr(mx + 2, rowY, modW - 4, modH, 5, modFill, '#8f959c', 1.5))
      p.push(rr(mx + 2, rowY, modW - 4, modH * 0.14, 5, '#ffffff', '', 0, 0.4))
      // Toggle well and tiny toggle, most on, a few off.
      const on = ctx.rng(0, 1) > 0.22
      p.push(rr(mx + modW / 2 - 12, rowY + 54, 24, 60, 5, '#22262b'))
      p.push(rr(mx + modW / 2 - 10, on ? rowY + 56 : rowY + 84, 20, 28, 5, metal(ctx, 'plasticBlack', 'v'), '#000000', 1.2))
      // Printed dot label.
      p.push(rr(mx + modW / 2 - 14, rowY + 126, 28, 10, 3, '#8b929b', '', 0, 0.5))
    }
    // A wide incomer isolator at the row start.
    p.push(rr(rowX - 22, rowY - 6, 118, modH + 12, 6, modFill, '#7f858d', 2))
    p.push(rr(rowX - 22, rowY - 6, 118, (modH + 12) * 0.14, 6, '#ffffff', '', 0, 0.4))
    p.push(rr(rowX + 37 - 17, rowY + 46, 34, 78, 6, '#22262b'))
    p.push(rr(rowX + 37 - 14, rowY + 50, 28, 36, 5, metal(ctx, 'plasticBlack', 'v'), '#000000', 1.5))
    p.push(rr(rowX + 10, rowY + 134, 54, 12, 3, '#8b929b', '', 0, 0.5))
  }

  // Wiring trunking between the rows, with slot ticks and dropping wires.
  const trkY = iy + 236
  p.push(rr(ix + 18, trkY, iw - 36, 62, 8, '#d6dade', '#9aa1a9', 2))
  for (let i = 0; i < 26; i++) {
    p.push(ln(ix + 36 + i * 34, trkY + 6, ix + 36 + i * 34, trkY + 56, '#9aa1a9', 4, 0.45))
  }
  for (let i = 0; i < 4; i++) {
    const wx = rowX + 120 + i * 190 + ctx.rng(-18, 18)
    p.push(
      `<path d="M ${wx.toFixed(1)} ${iy + 208} q ${ctx.rng(-14, 14).toFixed(1)} 22 0 30" fill="none" stroke="#33383e" stroke-width="7" stroke-linecap="round" opacity="0.6"/>`
    )
  }

  // Copper neutral bar along the pan bottom.
  const nbY = y1 - 96
  p.push(rr(ix + 60, nbY, iw - 320, 24, 5, metal(ctx, ctx.accent, 'v'), '#5e3b18', 2))
  p.push(rr(ix + 66, nbY + 3, iw - 332, 6, 3, '#ffffff', '', 0, 0.35))
  for (let i = 0; i < 9; i++) {
    p.push(screwHead(ctx, ix + 96 + i * 64, nbY + 12, 7, ctx.rng(0, 180)))
  }

  // Flange corner screws.
  p.push(screwHead(ctx, x0 + 32, y0 + 32, 13, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + W - 32, y0 + 32, 13, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + 32, y1 - 32, 13, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + W - 32, y1 - 32, 13, ctx.rng(0, 180)))

  p.push(rr(x0 + 30, y0 + 10, W * 0.5, 14, 7, '#ffffff', '', 0, 0.2))
  p.push(rr(x0 + 12, y0 + 40, 14, H - 80, 7, hi, '', 0, 0.25))

  ctx.add(`<g>${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* cable-tray — perforated galvanized tray length, three-quarter view         */
/* -------------------------------------------------------------------------- */

export const cableTray: ShapeRenderer = (ctx) => {
  const angle = -8 + ctx.rng(-1.5, 1.5)
  const L = 1160
  const x0 = cx - L / 2
  const x1 = cx + L / 2
  const [, hi, mid, low, dark] = tones(ctx.finish)
  const p: string[] = []

  ctx.add(groundShadow(ctx, cx, 895, 600, 62))

  const floorFill = ctx.def(
    'el-tray-floor',
    `<linearGradient id="el-tray-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${low}"/>
      <stop offset="0.55" stop-color="${mid}"/>
      <stop offset="1" stop-color="${hi}"/>
    </linearGradient>`
  )

  // Far rail: bright top lip, then its shaded inner face.
  p.push(rr(x0, 462, L, 12, 4, hi, dark, 1.5))
  p.push(rr(x0, 472, L, 48, 0, low, '', 0))
  p.push(rr(x0, 472, L, 48, 0, innerShade(ctx)))
  p.push(ln(x0, 520, x1, 520, dark, 2, 0.6))

  // Perforated floor, seen from above-front.
  p.push(rr(x0, 520, L, 110, 0, floorFill, '', 0))
  for (let row = 0; row < 2; row++) {
    const sy = 543 + row * 46
    const off = row === 0 ? 0 : 41
    for (let i = 0; i < 13; i++) {
      const sx = x0 + 42 + off + i * 84
      if (sx + 46 > x1 - 24) break
      p.push(rr(sx, sy, 46, 19, 9.5, '#555b63', '', 0, 0.9))
      p.push(ln(sx + 4, sy + 19, sx + 42, sy + 19, '#ffffff', 1.5, 0.4))
    }
  }

  // Near rail: return flange lip, bright front face with its own slots.
  p.push(rr(x0, 622, L, 16, 4, hi, dark, 1.5))
  p.push(rr(x0, 636, L, 108, 0, metal(ctx, ctx.finish, 'v'), dark, 2.5))
  p.push(ln(x0, 640, x1, 640, '#ffffff', 2, 0.5))
  for (let i = 0; i < 12; i++) {
    const sx = x0 + 76 + i * 94
    if (sx + 36 > x1 - 60) break
    p.push(rr(sx, 678, 36, 15, 7.5, dark, '', 0, 0.5))
  }
  // Splice holes at both ends of the near rail.
  for (const hx of [x0 + 34, x0 + 64, x1 - 34, x1 - 64]) {
    p.push(`<circle cx="${hx}" cy="${666}" r="7" fill="#454b52" opacity="0.85"/>`)
    p.push(`<circle cx="${hx}" cy="${700}" r="7" fill="#454b52" opacity="0.85"/>`)
  }

  // Cut ends: left end shows the C-channel cut edge, right end a bright sliver.
  p.push(rr(x0 - 8, 458, 18, 290, 4, '#d7dbdf', dark, 2))
  p.push(ln(x0 + 10, 462, x0 + 10, 744, dark, 2, 0.6))
  p.push(rr(x1 - 6, 458, 12, 290, 3, hi, dark, 1.5, 0.9))

  // Long soft specular along the front face.
  p.push(specular(x0 + 60, 648, L * 0.5, 16, 0.28))
  p.push(rr(x0, 726, L, 18, 0, '#000000', '', 0, 0.18))

  ctx.add(`<g transform="rotate(${angle.toFixed(2)} ${cx} 600)">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* motor — TEFC induction motor, side view, shaft to the right                */
/* -------------------------------------------------------------------------- */

export const motor: ShapeRenderer = (ctx) => {
  const axis = 600
  const bodyX0 = 500
  const bodyX1 = 1060 + ctx.rng(-10, 10)
  const bodyR = 170
  const [, hi, mid, , dark] = tones(ctx.finish)
  const body = metal(ctx, ctx.finish, 'v')
  const p: string[] = []

  ctx.add(groundShadow(ctx, cx, 885, 540, 58))

  // Mounting feet, painted cast iron, behind the body.
  for (const fx of [545, 895]) {
    p.push(rr(fx, axis + bodyR - 24, 122, 66, 10, metal(ctx, ctx.finish, 'v'), dark, 2.5))
    p.push(rr(fx + 8, axis + bodyR + 22, 106, 16, 6, dark, '', 0, 0.5))
    p.push(`<ellipse cx="${fx + 26}" cy="${axis + bodyR + 24}" rx="10" ry="6" fill="#14171a" opacity="0.8"/>`)
    p.push(`<ellipse cx="${fx + 96}" cy="${axis + bodyR + 24}" rx="10" ry="6" fill="#14171a" opacity="0.8"/>`)
  }

  // Fan cowl on the left: slightly larger drum with a rounded end.
  const cowlX = 320 + ctx.rng(-8, 8)
  p.push(rr(cowlX, axis - bodyR - 20, 515 - cowlX, bodyR * 2 + 40, 62, body, dark, 3))
  p.push(rr(cowlX + 14, axis - bodyR - 2, 500 - cowlX, 30, 15, '#ffffff', '', 0, 0.3))
  p.push(ln(cowlX + 52, axis - bodyR - 8, cowlX + 52, axis + bodyR + 8, dark, 3, 0.4))
  p.push(ln(cowlX + 70, axis - bodyR - 12, cowlX + 70, axis + bodyR + 12, dark, 3, 0.4))
  // Crimp ring where the cowl meets the stator.
  p.push(rr(492, axis - bodyR - 26, 26, bodyR * 2 + 52, 10, body, dark, 2.5))

  // Finned stator body.
  p.push(rr(bodyX0, axis - bodyR, bodyX1 - bodyX0, bodyR * 2, 26, body, dark, 3))
  for (let y = axis - bodyR + 22; y < axis + bodyR - 12; y += 24) {
    p.push(ln(bodyX0 + 6, y, bodyX1 - 6, y, dark, 3, 0.3))
  }
  p.push(rr(bodyX0 + 14, axis - bodyR + 12, bodyX1 - bodyX0 - 28, 26, 13, '#ffffff', '', 0, 0.32))

  // Drive end shield and bearing hub.
  p.push(rr(bodyX1 - 8, axis - 155, 62, 310, 18, body, dark, 3))
  p.push(ln(bodyX1 + 8, axis - 148, bodyX1 + 8, axis + 148, dark, 2.5, 0.4))
  p.push(rr(bodyX1 + 44, axis - 80, 40, 160, 14, body, dark, 2.5))
  p.push(rr(bodyX1 - 2, axis - 148, 50, 24, 12, '#ffffff', '', 0, 0.3))

  // Shaft with keyway.
  const shaftLen = 130 + ctx.rng(-8, 8)
  const shaftX = bodyX1 + 82
  p.push(rr(shaftX, axis - 37, shaftLen, 74, 8, metal(ctx, 'steel', 'v'), '#33383f', 2.5))
  p.push(rr(shaftX + shaftLen * 0.38, axis - 37, shaftLen * 0.62, 14, 4, '#22262b', '', 0, 0.85))
  p.push(rr(shaftX + 4, axis - 30, shaftLen - 10, 12, 6, '#ffffff', '', 0, 0.4))
  p.push(ln(shaftX + shaftLen - 2, axis - 34, shaftX + shaftLen - 2, axis + 34, '#dfe3e8', 3, 0.7))

  // Lifting eyebolt.
  p.push(`<circle cx="642" cy="${axis - bodyR - 34}" r="20" fill="none" stroke="${metal(ctx, 'steel', 'v')}" stroke-width="11"/>`)
  p.push(rr(628, axis - bodyR - 18, 28, 20, 5, metal(ctx, 'steel', 'v'), '#33383f', 2))

  // Terminal box (accent) with lid screws and a cable gland.
  const tbX = 700
  p.push(rr(tbX, axis - bodyR - 112, 200, 122, 12, sheet(ctx, ctx.accent), tones(ctx.accent)[4], 2.5))
  p.push(rr(tbX, axis - bodyR - 112, 200, 34, 12, '#ffffff', '', 0, 0.25))
  p.push(ln(tbX + 8, axis - bodyR - 74, tbX + 192, axis - bodyR - 74, tones(ctx.accent)[4], 2.5, 0.6))
  p.push(screwHead(ctx, tbX + 22, axis - bodyR - 94, 9, ctx.rng(0, 180)))
  p.push(screwHead(ctx, tbX + 178, axis - bodyR - 94, 9, ctx.rng(0, 180)))
  p.push(rr(tbX + 200, axis - bodyR - 66, 42, 30, 8, metal(ctx, 'steel', 'v'), '#33383f', 2))
  p.push(rr(tbX + 242, axis - bodyR - 72, 16, 42, 5, metal(ctx, 'steel', 'v'), '#33383f', 2))

  // Riveted nameplate on the stator.
  p.push(plate(ctx, 742, 540, 224, 112, 3))
  p.push(rivet(752, 550, 6, mid, dark))
  p.push(rivet(956, 642, 6, mid, dark))

  p.push(specular(520, axis + bodyR * 0.62, 480, 12, 0.12))
  ctx.add(`<g>${p.join('')}</g>`)
  void hi
}

/* -------------------------------------------------------------------------- */
/* vfd — variable frequency drive, tall wall-mount unit with keypad           */
/* -------------------------------------------------------------------------- */

export const vfd: ShapeRenderer = (ctx) => {
  const W = 560
  const H = 880
  const x0 = cx - W / 2
  const y0 = 150
  const y1 = y0 + H
  const [, hi, mid, , dark] = tones(ctx.finish)
  const face = sheet(ctx, ctx.finish)
  const tilt = ctx.rng(-0.9, 0.9)
  const p: string[] = []

  ctx.add(groundShadow(ctx, cx, 1064, 370, 48))

  // Heatsink comb peeking above the case.
  p.push(rr(x0 + 44, y0 - 26, W - 88, 34, 6, '#3a3f45', '#24282d', 2))
  for (let i = 0; i < 18; i++) {
    p.push(ln(x0 + 60 + i * 25, y0 - 22, x0 + 60 + i * 25, y0 + 4, '#171a1e', 5, 0.7))
  }

  // Case.
  p.push(rr(x0, y0, W, H, 28, face, dark, 3.5))
  p.push(rr(x0, y0, W, H, 28, faceSheen(ctx)))
  p.push(rr(x0 + 10, y0 + 10, W - 20, H - 20, 22, 'none', hi, 2, 0.3))

  // Top vent slots.
  for (let i = 0; i < 15; i++) {
    p.push(rr(x0 + 44 + i * 32, y0 + 28, 12, 52, 6, dark, '', 0, 0.45))
  }

  // Embossed brand block.
  p.push(rr(x0 + 40, y0 + 104, 170, 30, 6, '#000000', '', 0, 0.16))
  p.push(rr(x0 + 40, y0 + 104, 170, 30, 6, 'none', hi, 1.5, 0.3))

  // Keypad panel (accent).
  const kpY = y0 + 152
  p.push(rr(x0 + 38, kpY, W - 76, 372, 20, sheet(ctx, ctx.accent), tones(ctx.accent)[4], 2.5))
  p.push(rr(x0 + 38, kpY, W - 76, 40, 20, '#ffffff', '', 0, 0.22))

  // Display window with amber segment bars and status LEDs.
  p.push(rr(x0 + 78, kpY + 30, W - 156, 112, 12, '#0f1317', '#04060a', 3))
  p.push(rr(x0 + 82, kpY + 34, W - 164, 40, 10, '#ffffff', '', 0, 0.06))
  const segs = 4
  let sx = x0 + 116
  for (let i = 0; i < segs; i++) {
    const sw = i === segs - 1 ? ctx.rng(28, 50) : 46
    p.push(rr(sx - 5, kpY + 62, sw + 10, 46, 8, '#ffb63d', '', 0, 0.16))
    p.push(rr(sx, kpY + 70, sw, 30, 4, '#ffb63d', '', 0, 0.95))
    sx += 64
  }
  p.push(`<circle cx="${x0 + W - 108}" cy="${kpY + 58}" r="7" fill="#4ade80"/>`)
  p.push(`<circle cx="${x0 + W - 108}" cy="${kpY + 58}" r="12" fill="#4ade80" opacity="0.25"/>`)
  p.push(`<circle cx="${x0 + W - 108}" cy="${kpY + 92}" r="7" fill="#f87171" opacity="0.5"/>`)

  // Button rows: nav greys, green run, red stop, and a speed pot.
  const gBtn = ctx.def(
    'el-vfd-btn-g',
    `<radialGradient id="el-vfd-btn-g" cx="0.38" cy="0.32" r="0.9">
      <stop offset="0" stop-color="#86efac"/>
      <stop offset="0.55" stop-color="#2f9e44"/>
      <stop offset="1" stop-color="#14532d"/>
    </radialGradient>`
  )
  const rBtn = ctx.def(
    'el-vfd-btn-r',
    `<radialGradient id="el-vfd-btn-r" cx="0.38" cy="0.32" r="0.9">
      <stop offset="0" stop-color="#fda4a4"/>
      <stop offset="0.55" stop-color="#dc3d43"/>
      <stop offset="1" stop-color="#7f1d1d"/>
    </radialGradient>`
  )
  const row1 = kpY + 196
  const row2 = kpY + 286
  for (const bx of [x0 + 110, x0 + 190, x0 + 270]) {
    p.push(`<circle cx="${bx}" cy="${row1}" r="27" fill="${metalRadial(ctx, 'plasticBlack')}" stroke="#0a0c0e" stroke-width="2.5"/>`)
    p.push(`<circle cx="${bx - 8}" cy="${row1 - 9}" r="7" fill="#ffffff" opacity="0.35"/>`)
  }
  p.push(`<circle cx="${x0 + 110}" cy="${row2}" r="30" fill="${gBtn}" stroke="#0f3d20" stroke-width="2.5"/>`)
  p.push(`<circle cx="${x0 + 200}" cy="${row2}" r="30" fill="${rBtn}" stroke="#57120f" stroke-width="2.5"/>`)
  // Speed potentiometer with a pointer mark.
  const potX = x0 + W - 128
  const potA = ctx.rng(-50, 40)
  p.push(`<circle cx="${potX}" cy="${(row1 + row2) / 2}" r="42" fill="${metalRadial(ctx, ctx.accent)}" stroke="${tones(ctx.accent)[4]}" stroke-width="3"/>`)
  p.push(`<circle cx="${potX}" cy="${(row1 + row2) / 2}" r="16" fill="${metalRadial(ctx, 'plasticBlack')}" stroke="#0a0c0e" stroke-width="2"/>`)
  p.push(
    `<g transform="rotate(${potA.toFixed(1)} ${potX} ${(row1 + row2) / 2})">${ln(potX, (row1 + row2) / 2 - 40, potX, (row1 + row2) / 2 - 20, '#f2f4f6', 6, 0.95)}</g>`
  )

  // Lower louvred cover over the power terminals.
  const lvY = kpY + 404
  p.push(rr(x0 + 40, lvY, W - 80, y1 - lvY - 34, 14, '#000000', '', 0, 0.14))
  p.push(rr(x0 + 40, lvY, W - 80, y1 - lvY - 34, 14, 'none', dark, 2, 0.5))
  const lvH = y1 - lvY - 34
  for (let i = 1; i < Math.floor(lvH / 26); i++) {
    p.push(ln(x0 + 58, lvY + i * 26, x0 + W - 58, lvY + i * 26, dark, 4.5, 0.5))
    p.push(ln(x0 + 58, lvY + i * 26 + 4, x0 + W - 58, lvY + i * 26 + 4, '#ffffff', 2, 0.18))
  }
  p.push(screwHead(ctx, x0 + 62, y1 - 54, 12, ctx.rng(0, 180)))
  p.push(screwHead(ctx, x0 + W - 62, y1 - 54, 12, ctx.rng(0, 180)))

  p.push(rr(x0 + 24, y0 + 18, W * 0.45, 18, 9, '#ffffff', '', 0, 0.18))
  p.push(rr(x0 + 14, y0 + 60, 13, H - 120, 6, mid, '', 0, 0.22))

  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} ${cx} 590)">${p.join('')}</g>`)
}
