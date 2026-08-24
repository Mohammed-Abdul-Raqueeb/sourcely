/**
 * Tools, lifting and PPE renders: torque-wrench, wrench, hoist, gloves,
 * helmet, goggles, harness.
 *
 * Follow the `ballValve` reference in ./valves.ts for conventions:
 * groundShadow first, back-to-front, body = ctx.finish, trim = ctx.accent,
 * pose life only through ctx.rng. Custom def ids are prefixed per shape.
 */

import { CANVAS, type RenderContext, type ShapeRenderer } from '../types'
import {
  groundShadow,
  hexBolt,
  metal,
  metalRadial,
  ribs,
  sheet,
  specular,
  tones,
} from '../style'

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
  radius: number,
  fill: string,
  stroke = '',
  sw = 0,
  opacity?: number
): string {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''
  const o = opacity !== undefined ? ` opacity="${opacity}"` : ''
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${radius.toFixed(1)}" fill="${fill}"${s}${o}/>`
}

/**
 * Vertical run of welded chain links seen face-on: alternating wide (frontal)
 * and narrow (edge-on) oval links.
 */
function chainV(ctx: RenderContext, x: number, yTop: number, yBottom: number, size: number): string {
  const linkFill = metal(ctx, 'steel', 'v')
  const parts: string[] = []
  const step = size * 0.82
  let index = 0
  for (let y = yTop; y < yBottom; y += step) {
    const frontal = index % 2 === 0
    const rx = frontal ? size * 0.42 : size * 0.16
    const ry = size * 0.52
    parts.push(
      `<ellipse cx="${x}" cy="${(y + ry).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${linkFill}" stroke-width="${(size * 0.2).toFixed(1)}"/>`,
      `<ellipse cx="${x}" cy="${(y + ry).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="#2b3036" stroke-width="${(size * 0.06).toFixed(1)}" opacity="0.5"/>`
    )
    index += 1
  }
  return parts.join('')
}

/**
 * Strip of triangular jaw teeth on the edge y=yBase, tips reaching yTip.
 * Works pointing up (yTip < yBase) or down (yTip > yBase).
 */
function toothStrip(
  x0: number,
  x1: number,
  yTip: number,
  yBase: number,
  count: number,
  fill: string,
  stroke: string
): string {
  const pts: string[] = [`${x0},${yBase}`]
  const step = (x1 - x0) / count
  for (let i = 0; i < count; i++) {
    pts.push(`${(x0 + step * (i + 0.5)).toFixed(1)},${yTip}`)
    pts.push(`${(x0 + step * (i + 1)).toFixed(1)},${yBase}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
}

/** Forged hook drawn as layered strokes along a path, plus a safety latch. */
function forgedHook(
  ctx: RenderContext,
  d: string,
  latch: [number, number, number, number],
  width: number
): string {
  const [, , , low, dark] = tones(ctx.finish)
  return `<g>
    <path d="${d}" fill="none" stroke="${dark}" stroke-width="${width}" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${metal(ctx, ctx.finish, 'v')}" stroke-width="${(width * 0.72).toFixed(1)}" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#ffffff" stroke-width="${(width * 0.2).toFixed(1)}" stroke-linecap="round" opacity="0.32" transform="translate(-4 -4)"/>
    <line x1="${latch[0]}" y1="${latch[1]}" x2="${latch[2]}" y2="${latch[3]}" stroke="${low}" stroke-width="7" opacity="0.9"/>
  </g>`
}

/** Stitch bars across a webbing strap end — the boxed X read as dark bars. */
function stitching(x: number, y: number, w: number, h: number, dark: string): string {
  return `<g opacity="0.55">
    ${rr(x, y, w, 4, 2, dark)}
    ${rr(x, y + h - 4, w, 4, 2, dark)}
    <line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${dark}" stroke-width="3"/>
    <line x1="${x + w}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${dark}" stroke-width="3"/>
  </g>`
}

/** Webbing strap along a path: dark edge, body, centre stripe, stitch dashes. */
function strap(d: string, width: number, mid: string, hi: string, low: string, dark: string): string {
  return `<g fill="none" stroke-linecap="round">
    <path d="${d}" stroke="${dark}" stroke-width="${width + 8}"/>
    <path d="${d}" stroke="${mid}" stroke-width="${width}"/>
    <path d="${d}" stroke="${low}" stroke-width="${(width * 0.4).toFixed(1)}" opacity="0.5"/>
    <path d="${d}" stroke="${hi}" stroke-width="${Math.max(2.5, width * 0.09).toFixed(1)}" opacity="0.55" stroke-dasharray="11 8"/>
  </g>`
}

/** Rectangular pass-through buckle over a strap. */
function buckle(ctx: RenderContext, x: number, y: number, w: number, h: number): string {
  const [, , , , dark] = tones('steel')
  return `<g>
    ${rr(x - w / 2, y - h / 2, w, h, 7, metal(ctx, 'steel', 'v'), dark, 2.5)}
    ${rr(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 4, '#181c20', dark, 1.5)}
    ${rr(x - w / 2 + 4, y - 2.5, w - 8, 5, 2.5, metal(ctx, 'steel', 'h'), dark, 1.5)}
  </g>`
}

/* -------------------------------------------------------------------------- */
/* Torque wrench — click type seen from above: square-drive ratchet head,     */
/* long shaft with a recessed scale window, knurled lock collar, rubber grip  */
/* and micrometer end knob.                                                   */
/* -------------------------------------------------------------------------- */

export const torqueWrench: ShapeRenderer = (ctx) => {
  const axis = 645
  const tilt = ctx.rng(-5, -2)
  const [, bHi, , bLow, bDark] = tones(ctx.finish)
  const bodyV = metal(ctx, ctx.finish, 'v')
  const [, gHi, gMid, gLow, gDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 882, 560, 58))

  const p: string[] = []

  // Shaft first, so grip/collar/head sit over its ends.
  p.push(
    `<rect x="556" y="${axis - 33}" width="648" height="66" rx="12" fill="${bodyV}" stroke="${bDark}" stroke-width="2.5"/>`,
    specular(576, axis - 26, 610, 12, 0.3),
    `<rect x="560" y="${axis + 18}" width="640" height="9" rx="4.5" fill="${bLow}" opacity="0.35"/>`
  )

  // Recessed scale window: dark inset with graduation ticks (no lettering)
  // and the accent set-point line.
  p.push(
    `<rect x="636" y="${axis - 23}" width="240" height="46" rx="8" fill="#23272c" stroke="#14171a" stroke-width="2"/>`,
    `<rect x="640" y="${axis - 21}" width="232" height="8" rx="4" fill="#000000" opacity="0.45"/>`
  )
  for (let i = 0; i <= 12; i++) {
    const tx = 650 + i * 18
    const h = i % 4 === 0 ? 26 : 15
    p.push(
      `<line x1="${tx}" y1="${axis + 14}" x2="${tx}" y2="${axis + 14 - h}" stroke="#c8ccd2" stroke-width="2.5" opacity="0.75"/>`
    )
  }
  p.push(`<line x1="700" y1="${axis - 20}" x2="700" y2="${axis + 20}" stroke="${gMid}" stroke-width="4"/>`)

  // Neck into the head, junction collar, then the ratchet head.
  p.push(
    `<path d="M 1204 ${axis - 33} L 1252 ${axis - 20} L 1252 ${axis + 20} L 1204 ${axis + 33} Z" fill="${bodyV}" stroke="${bDark}" stroke-width="2.5"/>`,
    `<rect x="1196" y="${axis - 38}" width="22" height="76" rx="8" fill="${bodyV}" stroke="${bDark}" stroke-width="2"/>`,
    `<circle cx="1292" cy="${axis}" r="76" fill="${metalRadial(ctx, ctx.finish)}" stroke="${bDark}" stroke-width="3"/>`,
    `<circle cx="1292" cy="${axis}" r="56" fill="${bodyV}" stroke="${bDark}" stroke-width="2"/>`,
    `<circle cx="1266" cy="${axis - 26}" r="12" fill="#ffffff" opacity="0.4"/>`
  )
  // Cover-plate screws.
  for (const [sx, sy] of [
    [1256, axis - 36],
    [1328, axis + 36],
  ] as [number, number][]) {
    p.push(
      `<circle cx="${sx}" cy="${sy}" r="7" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="1.8"/>`,
      `<line x1="${sx - 4}" y1="${sy}" x2="${sx + 4}" y2="${sy}" stroke="#2d3238" stroke-width="1.8" transform="rotate(28 ${sx} ${sy})"/>`
    )
  }
  // Square drive boss with retaining hole, and the direction lever.
  p.push(
    `<rect x="1268" y="${axis - 24}" width="48" height="48" rx="7" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2.5"/>`,
    `<circle cx="1292" cy="${axis}" r="9" fill="#1a1d21"/>`,
    `<rect x="1272" y="${axis - 20}" width="12" height="10" rx="4" fill="#ffffff" opacity="0.45"/>`,
    `<g transform="rotate(-38 1292 ${axis})">
      <rect x="1284" y="${axis - 98}" width="16" height="52" rx="8" fill="${metal(ctx, 'steel', 'h')}" stroke="#2d3238" stroke-width="2"/>
      <circle cx="1292" cy="${axis - 100}" r="12" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2"/>
    </g>`
  )

  // Handle end: micrometer lock knob, rubber grip, knurled lock collar.
  p.push(
    `<rect x="222" y="${axis - 26}" width="22" height="52" rx="8" fill="${metal(ctx, 'steel', 'v')}" stroke="#2d3238" stroke-width="2"/>`,
    `<rect x="240" y="${axis - 45}" width="70" height="90" rx="18" fill="${bodyV}" stroke="${bDark}" stroke-width="2.5"/>`,
    ribs(246, axis - 41, 58, 82, 6, bDark, 0.5, 3),
    `<rect x="248" y="${axis - 40}" width="54" height="12" rx="6" fill="${bHi}" opacity="0.5"/>`,
    `<rect x="304" y="${axis - 51}" width="264" height="102" rx="44" fill="${gMid}" stroke="${gDark}" stroke-width="2.5"/>`,
    `<rect x="322" y="${axis - 42}" width="228" height="16" rx="8" fill="${gHi}" opacity="0.55"/>`,
    `<rect x="322" y="${axis + 26}" width="228" height="12" rx="6" fill="${gLow}" opacity="0.6"/>`,
    ribs(330, axis - 46, 212, 92, 7, gDark, 0.35, 4),
    `<rect x="562" y="${axis - 40}" width="44" height="80" rx="10" fill="${metal(ctx, 'steel', 'v')}" stroke="#2d3238" stroke-width="2.5"/>`,
    ribs(566, axis - 36, 36, 72, 5, '#2d3238', 0.5, 2.5),
    `<rect x="566" y="${axis - 36}" width="36" height="10" rx="5" fill="#ffffff" opacity="0.35"/>`
  )

  ctx.add(`<g transform="rotate(${tilt.toFixed(1)} ${cx} ${axis})">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* Pipe wrench — drop-forged Stillson: hook jaw on a threaded shank, knurled  */
/* adjustment nut, cast frame with heel jaw, epoxy-painted I-beam handle.     */
/* -------------------------------------------------------------------------- */

export const wrench: ShapeRenderer = (ctx) => {
  const tilt = ctx.rng(-21, -16)
  const [, sHi, sMid, sLow, sDark] = tones(ctx.finish)
  const steelV = metal(ctx, ctx.finish, 'v')
  const [, aHi, , , aDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx - 40, 888, 540, 58))

  const p: string[] = []

  // Handle (accent epoxy) first so the frame overlaps its root.
  p.push(
    `<path d="M 640 566 L 1248 592 Q 1338 598 1338 621 Q 1338 644 1248 650 L 640 668 Z" fill="${metal(ctx, ctx.accent, 'v')}" stroke="${aDark}" stroke-width="2.5"/>`,
    `<path d="M 694 598 L 1226 613 L 1226 629 L 694 640 Z" fill="${aDark}" opacity="0.45"/>`,
    `<path d="M 666 578 L 1244 600" stroke="${aHi}" stroke-width="6" opacity="0.5" fill="none"/>`,
    `<path d="M 670 656 L 1240 638" stroke="${aDark}" stroke-width="4" opacity="0.35" fill="none"/>`,
    `<circle cx="1300" cy="621" r="13" fill="#23262b" stroke="${aDark}" stroke-width="2"/>`,
    `<path d="M 1290 630 A 13 13 0 0 0 1310 626" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.4"/>`
  )

  // Hook-jaw shank rising through the frame, threaded above the nut, with a
  // rounded cap standing proud of the jaw arm.
  p.push(
    `<rect x="478" y="368" width="54" height="314" rx="14" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${sDark}" stroke-width="2.5"/>`,
    `<rect x="486" y="374" width="12" height="52" rx="6" fill="#ffffff" opacity="0.35"/>`
  )
  for (let y = 468; y <= 510; y += 8) {
    p.push(`<line x1="482" y1="${y}" x2="528" y2="${y}" stroke="${sDark}" stroke-width="2" opacity="0.5"/>`)
  }

  // Hook jaw arm reaching left, a dropped nose at the tip, teeth underneath.
  p.push(
    `<path d="M 532 412 L 412 418 Q 358 424 346 448 L 338 482 Q 338 504 352 518 L 366 526 L 392 509 L 532 500 Z" fill="${steelV}" stroke="${sDark}" stroke-width="2.5"/>`,
    `<path d="M 416 422 Q 366 428 350 452" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.3"/>`,
    toothStrip(366, 528, 522, 501, 9, sLow, sDark)
  )

  // Knurled adjustment nut on the shank.
  p.push(
    `<rect x="447" y="514" width="116" height="46" rx="14" fill="${steelV}" stroke="${sDark}" stroke-width="2.5"/>`,
    ribs(455, 518, 100, 38, 9, sDark, 0.55, 2.5),
    `<rect x="455" y="518" width="100" height="9" rx="4.5" fill="${sHi}" opacity="0.45"/>`
  )

  // Heel jaw (teeth up), collar boss under the nut, then the cast frame.
  p.push(
    `<path d="M 294 590 L 472 590 L 474 650 L 318 658 Q 296 654 293 630 Z" fill="${steelV}" stroke="${sDark}" stroke-width="2.5"/>`,
    toothStrip(302, 464, 568, 590, 8, sMid, sDark),
    `<rect x="462" y="548" width="86" height="24" rx="8" fill="${steelV}" stroke="${sDark}" stroke-width="2"/>`,
    `<path d="M 444 564 L 664 564 Q 684 566 686 588 L 686 644 Q 684 664 662 666 L 448 668 Q 428 666 426 646 L 424 588 Q 426 566 444 564 Z" fill="${steelV}" stroke="${sDark}" stroke-width="3"/>`,
    `<line x1="600" y1="572" x2="600" y2="662" stroke="${sDark}" stroke-width="2.5" opacity="0.2"/>`,
    `<circle cx="622" cy="617" r="16" fill="none" stroke="${sDark}" stroke-width="2.5" opacity="0.35"/>`,
    specular(438, 574, 226, 11, 0.28)
  )

  ctx.add(`<g transform="rotate(${tilt.toFixed(1)} ${cx} 617)">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* Chain hoist — chain block: forged top hook, suspension bracket, geared     */
/* body with a stamped accent cover, load chain to a bottom hook, hand chain. */
/* -------------------------------------------------------------------------- */

export const hoist: ShapeRenderer = (ctx) => {
  const bodyCy = 452
  const R = 160
  const sway = ctx.rng(-10, 10)
  const [, , , , pDark] = tones(ctx.finish)
  const [, aHi, , , aDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 902, 400, 50))

  // Top hook, opening up-left, shank buried in the suspension bracket.
  ctx.add(
    forgedHook(
      ctx,
      `M ${cx} 262 L ${cx} 234 C ${cx} 184 ${cx - 20} 158 ${cx - 54} 152 C ${cx - 96} 145 ${cx - 118} 176 ${cx - 112} 208`,
      [cx - 12, 194, cx - 104, 220],
      40
    )
  )

  // Suspension bracket sitting proud of the side plates.
  ctx.add(`<rect x="${cx - 122}" y="246" width="244" height="48" rx="14" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${pDark}" stroke-width="2.5"/>`)
  ctx.add(hexBolt(ctx, cx - 86, 270, 13))
  ctx.add(hexBolt(ctx, cx + 86, 270, 13))

  // Back side plate and the hand-chain wheel cover on the right.
  ctx.add(`<circle cx="${cx}" cy="${bodyCy}" r="${R + 12}" fill="${pDark}"/>`)
  ctx.add(`<circle cx="${cx + 128}" cy="${bodyCy + 38}" r="108" fill="${metalRadial(ctx, ctx.finish)}" stroke="${pDark}" stroke-width="3"/>`)
  ctx.add(`<circle cx="${cx + 128}" cy="${bodyCy + 38}" r="86" fill="none" stroke="${pDark}" stroke-width="3" opacity="0.5"/>`)
  ctx.add(`<circle cx="${cx + 196}" cy="${bodyCy + 38}" r="12" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2"/>`)

  // Load chain down the centre to the bottom block.
  ctx.add(chainV(ctx, cx, bodyCy + 126, 722, 34))

  // Hand chain: two strands off the wheel cover, joined by a U near the
  // floor, textured with dashes so it reads as links.
  const xA = cx + 104
  const xB = cx + 168
  ctx.add(chainV(ctx, xA + sway * 0.4, bodyCy + 154, 856, 24))
  ctx.add(chainV(ctx, xB + sway, bodyCy + 150, 848, 24))
  const uMid = (xA + xB) / 2 + sway * 0.7
  ctx.add(
    `<path d="M ${xA + sway * 0.4} 856 Q ${uMid - 18} 908 ${uMid} 908 Q ${uMid + 20} 908 ${xB + sway} 848" fill="none" stroke="#3a4048" stroke-width="13"/>`
  )
  ctx.add(
    `<path d="M ${xA + sway * 0.4} 856 Q ${uMid - 18} 904 ${uMid} 904 Q ${uMid + 20} 904 ${xB + sway} 846" fill="none" stroke="${metal(ctx, 'steel', 'v')}" stroke-width="8" stroke-dasharray="10 7"/>`
  )
  // Chain guide under the wheel cover, hiding where the strands emerge.
  ctx.add(`<rect x="${cx + 86}" y="${bodyCy + 128}" width="100" height="28" rx="10" fill="${metal(ctx, 'steel', 'v')}" stroke="#2d3238" stroke-width="2.5"/>`)

  // Main body drum and the stamped accent cover.
  ctx.add(`<circle cx="${cx}" cy="${bodyCy}" r="${R}" fill="${metalRadial(ctx, ctx.finish)}" stroke="${pDark}" stroke-width="3.5"/>`)
  ctx.add(`<circle cx="${cx}" cy="${bodyCy}" r="${R - 8}" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.18"/>`)
  for (const a of [30, 150, 210, 330]) {
    const rad = (a * Math.PI) / 180
    ctx.add(hexBolt(ctx, cx + Math.cos(rad) * (R - 20), bodyCy + Math.sin(rad) * (R - 20), 11))
  }
  const cover: string[] = [
    `<circle cx="${cx}" cy="${bodyCy}" r="124" fill="${metalRadial(ctx, ctx.accent)}" stroke="${aDark}" stroke-width="3"/>`,
  ]
  for (let i = 0; i < 8; i++) {
    const rad = ((i * 45 + 22) * Math.PI) / 180
    cover.push(
      `<line x1="${(cx + Math.cos(rad) * 48).toFixed(1)}" y1="${(bodyCy + Math.sin(rad) * 48).toFixed(1)}" x2="${(cx + Math.cos(rad) * 112).toFixed(1)}" y2="${(bodyCy + Math.sin(rad) * 112).toFixed(1)}" stroke="${aDark}" stroke-width="9" stroke-linecap="round" opacity="0.22"/>`
    )
  }
  for (let i = 0; i < 6; i++) {
    const rad = ((i * 60 - 90) * Math.PI) / 180
    cover.push(hexBolt(ctx, cx + Math.cos(rad) * 106, bodyCy + Math.sin(rad) * 106, 9))
  }
  cover.push(
    `<circle cx="${cx}" cy="${bodyCy}" r="40" fill="${metalRadial(ctx, ctx.accent)}" stroke="${aDark}" stroke-width="2.5"/>`,
    hexBolt(ctx, cx, bodyCy, 13),
    `<path d="M ${cx - 96} ${bodyCy - 52} A 110 110 0 0 1 ${cx - 14} ${bodyCy - 116}" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" opacity="0.28"/>`,
    // Nameplate: shaded rectangle, printed lines as grey bars.
    rr(cx - 56, bodyCy + 50, 112, 44, 8, '#eceff2', '#9aa1a8', 2),
    rr(cx - 42, bodyCy + 61, 66, 9, 4.5, '#5b636c', '', 0, 0.85),
    rr(cx - 42, bodyCy + 77, 84, 7, 3.5, '#8a929b', '', 0, 0.8),
    `<circle cx="${cx + 40}" cy="${bodyCy + 65}" r="6" fill="${aHi}" opacity="0.9"/>`
  )
  ctx.add(cover.join(''))

  // Bottom hook block on the load chain, then the forged bottom hook.
  ctx.add(rr(cx - 52, 718, 104, 72, 14, metal(ctx, ctx.finish, 'v'), pDark, 2.5))
  ctx.add(specular(cx - 40, 726, 80, 10, 0.3))
  ctx.add(hexBolt(ctx, cx - 28, 754, 9))
  ctx.add(hexBolt(ctx, cx + 28, 754, 9))
  ctx.add(rr(cx - 11, 786, 22, 20, 6, metal(ctx, 'steel', 'h'), '#2d3238', 2))
  ctx.add(
    forgedHook(
      ctx,
      `M ${cx} 802 L ${cx} 842 C ${cx} 884 ${cx - 18} 902 ${cx - 48} 906 C ${cx - 86} 911 ${cx - 106} 880 ${cx - 100} 848`,
      [cx - 10, 844, cx - 94, 860],
      38
    )
  )
}

/* -------------------------------------------------------------------------- */
/* Gloves — pair of knit safety gloves: one back-of-hand, one coated palm up. */
/* -------------------------------------------------------------------------- */

/**
 * One glove in local coords: wrist at the origin, fingers up (negative y).
 * `thumbSide` +1 puts the thumb on the right. `coated` paints the hand in the
 * accent palm coating (palm-up view); otherwise it is the knit back.
 */
function glove(ctx: RenderContext, coated: boolean, thumbSide: -1 | 1): string {
  const [, shHi, , shLow, shDark] = tones(ctx.finish)
  const shellFill = sheet(ctx, ctx.finish)
  const [, , coMid, , coDark] = tones(ctx.accent)
  const coatFill = metal(ctx, ctx.accent, 'h')
  const knit = ctx.def(
    'ts-gloves-knit',
    `<pattern id="ts-gloves-knit" width="12" height="9" patternUnits="userSpaceOnUse">
      <path d="M0 7 L3 2 L6 7" fill="none" stroke="${shDark}" stroke-width="1.5"/>
      <path d="M6 7 L9 2 L12 7" fill="none" stroke="${shDark}" stroke-width="1.5"/>
    </pattern>`
  )

  const handFill = coated ? coatFill : shellFill
  const handDark = coated ? coDark : shDark

  // Fingers: [xCentre, topY] with index nearest the thumb.
  const fingerSpec: [number, number][] = (
    [
      [-93, -440],
      [-31, -495],
      [31, -515],
      [93, -480],
    ] as [number, number][]
  ).map(([fx, top]) => [fx * thumbSide, top])

  const parts: string[] = []
  for (const [fx, top] of fingerSpec) {
    parts.push(rr(fx - 29, top, 58, -240 - top, 28, handFill, handDark, 2.5))
    if (!coated) {
      parts.push(rr(fx - 29, top, 58, -240 - top, 28, knit, '', 0, 0.4))
      // Coating wrapping over the fingertip from the palm side.
      parts.push(
        `<path d="M ${fx - 23} ${top + 36} Q ${fx} ${top - 4} ${fx + 23} ${top + 36}" stroke="${coMid}" stroke-width="11" fill="none" opacity="0.95"/>`
      )
    } else {
      parts.push(rr(fx - 23, top + 8, 12, -260 - top, 6, '#ffffff', '', 0, 0.25))
    }
  }

  // Thumb: a rotated capsule, base buried under the palm.
  parts.push(`<g transform="rotate(${thumbSide * 40} ${thumbSide * 108} -150)">
    ${rr(thumbSide * 108 - 31, -352, 62, 212, 30, handFill, handDark, 2.5)}
    ${coated ? rr(thumbSide * 108 - 25, -344, 12, 160, 6, '#ffffff', '', 0, 0.25) : rr(thumbSide * 108 - 31, -352, 62, 212, 30, knit, '', 0, 0.4)}
  </g>`)

  // Palm/back panel over the finger roots.
  parts.push(rr(-128, -280, 256, 290, 46, handFill, handDark, 3))
  if (coated) {
    parts.push(
      `<ellipse cx="${thumbSide * -26}" cy="-170" rx="58" ry="80" fill="#ffffff" opacity="0.1"/>`,
      `<ellipse cx="${thumbSide * 30}" cy="-64" rx="80" ry="40" fill="${coDark}" opacity="0.1"/>`,
      `<path d="M -112 -252 Q 0 -286 112 -252" stroke="#ffffff" stroke-width="7" fill="none" opacity="0.3"/>`
    )
  } else {
    parts.push(rr(-128, -280, 256, 290, 46, knit, '', 0, 0.4))
    // Elastic shirring across the back of the hand.
    for (const sy of [-84, -58, -32]) {
      parts.push(`<path d="M -104 ${sy} Q 0 ${sy - 10} 104 ${sy}" stroke="${shDark}" stroke-width="3" fill="none" opacity="0.35"/>`)
    }
    parts.push(`<ellipse cx="-44" cy="-208" rx="52" ry="70" fill="${shHi}" opacity="0.25"/>`)
  }

  // Knit cuff with ribbing and an accent overlocked hem.
  parts.push(
    rr(-120, -6, 240, 20, 9, shLow, shDark, 2, 0.9),
    `<path d="M -116 8 L 116 8 L 98 134 Q 0 150 -98 134 Z" fill="${shellFill}" stroke="${shDark}" stroke-width="2.5"/>`,
    ribs(-84, 18, 168, 108, 10, shDark, 0.4, 3),
    `<path d="M -98 134 Q 0 150 98 134" stroke="${coMid}" stroke-width="13" fill="none"/>`,
    `<path d="M -98 134 Q 0 150 98 134" stroke="${coDark}" stroke-width="3" fill="none" stroke-dasharray="7 6" opacity="0.8"/>`
  )

  return parts.join('')
}

export const gloves: ShapeRenderer = (ctx) => {
  const tiltL = ctx.rng(-12, -6)
  const tiltR = ctx.rng(6, 12)

  ctx.add(groundShadow(ctx, cx, 888, 540, 58, 0.2))
  ctx.add(`<g transform="translate(${cx - 218} 706) rotate(${tiltL.toFixed(1)}) scale(1.06)">${glove(ctx, false, 1)}</g>`)
  ctx.add(`<g transform="translate(${cx + 222} 714) rotate(${tiltR.toFixed(1)}) scale(1.06)">${glove(ctx, true, -1)}</g>`)
}

/* -------------------------------------------------------------------------- */
/* Helmet — industrial hard hat, front view: dome, crown ridge, vent slots,   */
/* full brim with rain gutter, suspension band and a ratchet hint below.      */
/* -------------------------------------------------------------------------- */

export const helmet: ShapeRenderer = (ctx) => {
  const tilt = ctx.rng(-2.5, 2.5)
  const [, sHi, sMid, sLow, sDark] = tones(ctx.finish)
  const [, , iMid, iLow, iDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 895, 480, 54))

  const dome = ctx.def(
    'ts-helmet-dome',
    `<radialGradient id="ts-helmet-dome" cx="0.36" cy="0.24" r="1.05">
      <stop offset="0" stop-color="${sHi}"/>
      <stop offset="0.45" stop-color="${sMid}"/>
      <stop offset="0.82" stop-color="${sLow}"/>
      <stop offset="1" stop-color="${sDark}"/>
    </radialGradient>`
  )

  const p: string[] = []

  // Suspension visible in the shadow under the shell, with the rear ratchet
  // knob dropping below the brim line.
  p.push(`<circle cx="${cx}" cy="810" r="44" fill="${metalRadial(ctx, ctx.accent)}" stroke="${iDark}" stroke-width="2.5"/>`)
  for (let i = 0; i < 12; i++) {
    const rad = (i * 30 * Math.PI) / 180
    p.push(
      `<line x1="${(cx + Math.cos(rad) * 34).toFixed(1)}" y1="${(810 + Math.sin(rad) * 34).toFixed(1)}" x2="${(cx + Math.cos(rad) * 43).toFixed(1)}" y2="${(810 + Math.sin(rad) * 43).toFixed(1)}" stroke="${iDark}" stroke-width="3" opacity="0.7"/>`
    )
  }
  p.push(`<circle cx="${cx}" cy="810" r="16" fill="${iLow}" stroke="${iDark}" stroke-width="2"/>`)
  p.push(`<path d="M ${cx - 250} 742 Q ${cx} 836 ${cx + 250} 742 L ${cx + 222} 776 Q ${cx} 856 ${cx - 222} 776 Z" fill="#20242a" opacity="0.92"/>`)
  p.push(rr(cx - 130, 772, 260, 32, 15, iMid, iDark, 2, 0.95))
  p.push(ribs(cx - 114, 776, 228, 24, 9, iDark, 0.5, 3))

  // Shell: broad dome.
  p.push(`<path d="M ${cx - 356} 690
    C ${cx - 360} 470 ${cx - 226} 332 ${cx} 332
    C ${cx + 226} 332 ${cx + 360} 470 ${cx + 356} 690
    Q ${cx} 758 ${cx - 356} 690 Z" fill="${dome}" stroke="${sDark}" stroke-width="3.5"/>`)

  // Crown ridge and two moulded side ribs.
  p.push(`<path d="M ${cx - 36} 350 Q ${cx} 328 ${cx + 36} 350 L ${cx + 30} 566 Q ${cx} 582 ${cx - 30} 566 Z" fill="${sMid}" stroke="${sDark}" stroke-width="2" opacity="0.92"/>`)
  p.push(`<path d="M ${cx - 32} 358 Q ${cx} 338 ${cx + 32} 358" fill="none" stroke="${sHi}" stroke-width="5" opacity="0.6"/>`)
  p.push(`<line x1="${cx - 9}" y1="366" x2="${cx - 9}" y2="556" stroke="${sHi}" stroke-width="4" opacity="0.45"/>`)
  p.push(`<path d="M ${cx - 196} 402 Q ${cx - 228} 530 ${cx - 220} 664" fill="none" stroke="${sDark}" stroke-width="4" opacity="0.26"/>`)
  p.push(`<path d="M ${cx + 196} 402 Q ${cx + 228} 530 ${cx + 220} 664" fill="none" stroke="${sDark}" stroke-width="4" opacity="0.26"/>`)

  // Vent slots high on each side of the crown.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const vx = cx + side * (128 + i * 30)
      p.push(
        `<rect x="${vx - 7}" y="${418 + i * 10}" width="14" height="46" rx="7" fill="${sDark}" opacity="0.5" transform="rotate(${side * (12 + i * 7)} ${vx} ${440 + i * 10})"/>`
      )
    }
  }

  // Brim with rain gutter, sweeping wider at the front.
  p.push(`<path d="M ${cx - 448} 672
    Q ${cx} 606 ${cx + 448} 672
    Q ${cx + 462} 716 ${cx + 434} 730
    Q ${cx} 806 ${cx - 434} 730
    Q ${cx - 462} 716 ${cx - 448} 672 Z" fill="${sheet(ctx, ctx.finish)}" stroke="${sDark}" stroke-width="3.5"/>`)
  p.push(`<path d="M ${cx - 424} 686 Q ${cx} 626 ${cx + 424} 686" fill="none" stroke="${sDark}" stroke-width="3" opacity="0.4"/>`)
  p.push(`<path d="M ${cx - 412} 716 Q ${cx} 780 ${cx + 412} 716" fill="none" stroke="${sHi}" stroke-width="5" opacity="0.5"/>`)
  // Accessory slots on the brim sides.
  p.push(rr(cx - 442, 690, 52, 20, 8, iLow, iDark, 2, 0.9))
  p.push(rr(cx + 390, 690, 52, 20, 8, iLow, iDark, 2, 0.9))

  // Big soft specular upper-left; shade the lower right of the dome.
  p.push(`<ellipse cx="${cx - 136}" cy="446" rx="104" ry="60" fill="#ffffff" opacity="0.32" transform="rotate(-24 ${cx - 136} 446)"/>`)
  p.push(`<ellipse cx="${cx + 232}" cy="556" rx="92" ry="84" fill="${sDark}" opacity="0.08"/>`)

  ctx.add(`<g transform="rotate(${tilt.toFixed(1)} ${cx} 640)">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* Goggles — wraparound safety goggles: soft frame, indirect vents, tinted    */
/* lens with speculars and a wide elastic strap sweeping behind.              */
/* -------------------------------------------------------------------------- */

export const goggles: ShapeRenderer = (ctx) => {
  const cy = 620
  const tilt = ctx.rng(-2.5, 2.5)
  const [, fHi, fMid, , fDark] = tones(ctx.finish)
  const [, , aMid, aLow, aDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 880, 480, 52))

  const lens = ctx.def(
    'ts-goggles-lens',
    `<linearGradient id="ts-goggles-lens" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#e9f2f8" stop-opacity="0.92"/>
      <stop offset="0.4" stop-color="#b9cfdd" stop-opacity="0.85"/>
      <stop offset="0.75" stop-color="#7d97a8" stop-opacity="0.88"/>
      <stop offset="1" stop-color="#5a707f" stop-opacity="0.92"/>
    </linearGradient>`
  )

  const p: string[] = []

  // Elastic strap: broad ribbed band sweeping out and behind on both sides,
  // with a sliding adjuster clip midway.
  for (const s of [-1, 1]) {
    const d = `M ${cx + s * 400} ${cy - 4} C ${cx + s * 512} ${cy - 26} ${cx + s * 592} ${cy - 12} ${cx + s * 622} ${cy + 26}`
    p.push(
      `<path d="${d}" fill="none" stroke="${aDark}" stroke-width="54" stroke-linecap="round"/>`,
      `<path d="${d}" fill="none" stroke="${aMid}" stroke-width="44" stroke-linecap="round"/>`,
      `<path d="${d}" fill="none" stroke="${aLow}" stroke-width="14" stroke-linecap="round" opacity="0.6" stroke-dasharray="4 9"/>`,
      `<g transform="rotate(${s * 14} ${cx + s * 524} ${cy - 12})">
        ${rr(cx + s * 524 - 20, cy - 44, 40, 62, 8, aMid, aDark, 2.5)}
        ${rr(cx + s * 524 - 12, cy - 32, 24, 8, 4, '#14171a', '', 0, 0.6)}
        ${rr(cx + s * 524 - 12, cy - 4, 24, 8, 4, '#14171a', '', 0, 0.6)}
      </g>`
    )
  }

  // Soft frame body.
  p.push(`<path d="M ${cx - 430} ${cy - 24}
    C ${cx - 430} ${cy - 150} ${cx - 258} ${cy - 176} ${cx} ${cy - 176}
    C ${cx + 258} ${cy - 176} ${cx + 430} ${cy - 150} ${cx + 430} ${cy - 24}
    C ${cx + 430} ${cy + 100} ${cx + 322} ${cy + 162} ${cx + 186} ${cy + 168}
    C ${cx + 112} ${cy + 172} ${cx + 74} ${cy + 128} ${cx} ${cy + 128}
    C ${cx - 74} ${cy + 128} ${cx - 112} ${cy + 172} ${cx - 186} ${cy + 168}
    C ${cx - 322} ${cy + 162} ${cx - 430} ${cy + 100} ${cx - 430} ${cy - 24} Z"
    fill="${sheet(ctx, ctx.finish)}" stroke="${fDark}" stroke-width="3.5"/>`)

  // Top indirect vents.
  for (const vx of [-235, -118, 0, 118, 235]) {
    p.push(rr(cx + vx - 38, cy - 166, 76, 22, 11, fMid, fDark, 2))
    p.push(rr(cx + vx - 30, cy - 161, 60, 8, 4, '#14171a', '', 0, 0.55))
  }
  // Bottom vents flanking the nose.
  p.push(rr(cx - 260, cy + 118, 70, 20, 10, fMid, fDark, 2))
  p.push(rr(cx + 190, cy + 118, 70, 20, 10, fMid, fDark, 2))

  // Lens inside the frame.
  p.push(`<path d="M ${cx - 390} ${cy - 22}
    C ${cx - 390} ${cy - 124} ${cx - 240} ${cy - 146} ${cx} ${cy - 146}
    C ${cx + 240} ${cy - 146} ${cx + 390} ${cy - 124} ${cx + 390} ${cy - 22}
    C ${cx + 390} ${cy + 74} ${cx + 300} ${cy + 128} ${cx + 180} ${cy + 134}
    C ${cx + 104} ${cy + 136} ${cx + 70} ${cy + 96} ${cx} ${cy + 96}
    C ${cx - 70} ${cy + 96} ${cx - 104} ${cy + 136} ${cx - 180} ${cy + 134}
    C ${cx - 300} ${cy + 128} ${cx - 390} ${cy + 74} ${cx - 390} ${cy - 22} Z"
    fill="${lens}" stroke="#3d4c57" stroke-width="2.5"/>`)

  // Lens speculars: one broad sweep, one crisp arc, one lower-left shade.
  p.push(`<path d="M ${cx - 318} ${cy - 74} C ${cx - 206} ${cy - 122} ${cx - 50} ${cy - 128} ${cx + 44} ${cy - 110} L ${cx + 24} ${cy - 66} C ${cx - 94} ${cy - 82} ${cx - 218} ${cy - 70} ${cx - 286} ${cy - 26} Z" fill="#ffffff" opacity="0.42"/>`)
  p.push(`<path d="M ${cx + 160} ${cy + 56} q 104 -22 160 -92" fill="none" stroke="#ffffff" stroke-width="12" opacity="0.3" stroke-linecap="round"/>`)
  p.push(`<path d="M ${cx - 356} ${cy + 30} q 30 52 96 74" fill="none" stroke="#22303a" stroke-width="8" opacity="0.25" stroke-linecap="round"/>`)

  // Nose bridge recess.
  p.push(`<path d="M ${cx - 60} ${cy + 106} Q ${cx} ${cy + 36} ${cx + 60} ${cy + 106}" fill="none" stroke="${fDark}" stroke-width="6" opacity="0.5"/>`)
  p.push(`<path d="M ${cx - 44} ${cy + 112} Q ${cx} ${cy + 54} ${cx + 44} ${cy + 112}" fill="none" stroke="${fDark}" stroke-width="3" opacity="0.3"/>`)

  // Strap clips at the temples.
  for (const s of [-1, 1]) {
    p.push(`<g transform="rotate(${s * 8} ${cx + s * 408} ${cy})">
      ${rr(cx + s * 408 - 26, cy - 50, 52, 100, 12, metal(ctx, ctx.accent, 'v'), aDark, 2.5)}
      ${rr(cx + s * 408 - 16, cy - 36, 32, 10, 5, '#14171a', '', 0, 0.6)}
      ${rr(cx + s * 408 - 16, cy + 26, 32, 10, 5, '#14171a', '', 0, 0.6)}
      <circle cx="${cx + s * 400}" cy="${cy - 40}" r="5" fill="${fHi}" opacity="0.6"/>
    </g>`)
  }

  ctx.add(`<g transform="rotate(${tilt.toFixed(1)} ${cx} ${cy})">${p.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* Harness — full-body fall-arrest harness on display: shoulder straps,       */
/* dorsal D-ring, chest strap, waist belt and buckled leg loops.              */
/* -------------------------------------------------------------------------- */

export const harness: ShapeRenderer = (ctx) => {
  const sway = ctx.rng(-1.5, 1.5)
  const [, wHi, wMid, wLow, wDark] = tones(ctx.finish)
  const [, , pMid, , pDark] = tones(ctx.accent)
  const [, , , , steelDark] = tones('steel')

  ctx.add(groundShadow(ctx, cx, 905, 430, 50))

  const p: string[] = []
  const topY = 186
  const waistY = 646

  // Hanger loop at the top.
  p.push(`<circle cx="${cx}" cy="${topY - 36}" r="30" fill="none" stroke="${metal(ctx, 'steel', 'v')}" stroke-width="13"/>`)
  p.push(`<circle cx="${cx}" cy="${topY - 36}" r="30" fill="none" stroke="${steelDark}" stroke-width="2" opacity="0.5"/>`)

  // Shoulder straps: from the hanger flaring down to the waist belt.
  p.push(strap(`M ${cx - 8} ${topY} C ${cx - 186} ${topY + 136} ${cx - 212} ${topY + 280} ${cx - 190} ${waistY - 20}`, 46, wMid, wHi, wLow, wDark))
  p.push(strap(`M ${cx + 8} ${topY} C ${cx + 186} ${topY + 136} ${cx + 212} ${topY + 280} ${cx + 190} ${waistY - 20}`, 46, wMid, wHi, wLow, wDark))

  // Dorsal pad and forged D-ring where the straps converge.
  const dY = topY + 112
  p.push(rr(cx - 78, dY - 48, 156, 112, 24, sheet(ctx, ctx.accent), pDark, 2.5))
  p.push(rr(cx - 62, dY - 34, 124, 84, 16, pMid, pDark, 2, 0.6))
  p.push(`<path d="M ${cx - 54} ${dY + 12} a 54 54 0 1 1 108 0 l -18 0 a 36 36 0 1 0 -72 0 Z" fill="${metal(ctx, 'steel', 'h')}" stroke="${steelDark}" stroke-width="2.5"/>`)
  p.push(`<path d="M ${cx - 42} ${dY - 26} a 46 46 0 0 1 46 -11" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.55" stroke-linecap="round"/>`)
  p.push(rr(cx - 58, dY + 12, 116, 22, 10, metal(ctx, 'steel', 'v'), steelDark, 2))

  // Chest strap with a small buckle.
  const chestY = topY + 252
  p.push(strap(`M ${cx - 178} ${chestY} Q ${cx} ${chestY + 36} ${cx + 178} ${chestY}`, 30, wMid, wHi, wLow, wDark))
  p.push(buckle(ctx, cx, chestY + 18, 72, 48))

  // Waist belt with side D-rings, stitching and a centre buckle.
  p.push(strap(`M ${cx - 262} ${waistY} Q ${cx} ${waistY + 48} ${cx + 262} ${waistY}`, 56, wMid, wHi, wLow, wDark))
  p.push(stitching(cx - 238, waistY - 14, 56, 36, wDark))
  p.push(stitching(cx + 182, waistY - 14, 56, 36, wDark))
  p.push(buckle(ctx, cx, waistY + 26, 92, 60))
  for (const s of [-1, 1]) {
    p.push(
      rr(cx + s * 252 - 12, waistY + 8, 24, 34, 8, wLow, wDark, 2),
      `<circle cx="${cx + s * 252}" cy="${waistY + 56}" r="20" fill="none" stroke="${metal(ctx, 'steel', 'h')}" stroke-width="11"/>`,
      `<circle cx="${cx + s * 252}" cy="${waistY + 56}" r="20" fill="none" stroke="${steelDark}" stroke-width="2" opacity="0.5"/>`
    )
  }

  // Leg loops: closed webbing rings hanging from short risers.
  for (const s of [-1, 1]) {
    const lx = cx + s * 160
    p.push(strap(`M ${lx - s * 24} ${waistY + 26} C ${lx - s * 12} ${waistY + 60} ${lx} ${waistY + 78} ${lx + s * 10} ${waistY + 92}`, 30, wMid, wHi, wLow, wDark))
    const ring = `M ${lx - 128} ${waistY + 176} a 128 74 0 1 0 256 0 a 128 74 0 1 0 -256 0`
    p.push(strap(ring, 40, wMid, wHi, wLow, wDark))
    p.push(buckle(ctx, lx + s * 108, waistY + 214, 62, 44))
    p.push(stitching(lx - s * 74 - 28, waistY + 116, 56, 30, wDark))
  }

  // Strap keepers along the shoulder straps.
  p.push(rr(cx - 204, topY + 196, 50, 28, 10, pMid, pDark, 2))
  p.push(rr(cx + 154, topY + 196, 50, 28, 10, pMid, pDark, 2))

  ctx.add(`<g transform="rotate(${sway.toFixed(1)} ${cx} ${topY})">${p.join('')}</g>`)
}
