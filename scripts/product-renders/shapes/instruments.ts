/**
 * Instrumentation renders: gauge, thermometer, transmitter, flow-meter,
 * clamp-meter.
 *
 * Follow the `ballValve` reference in ./valves.ts for conventions.
 */

import { CANVAS, type FinishId, type RenderContext, type ShapeRenderer } from '../types'
import {
  flange,
  groundShadow,
  hexBolt,
  metal,
  metalRadial,
  sheet,
  specular,
  tones,
} from '../style'

const { cx } = CANVAS

/* -------------------------------------------------------------------------- */
/* Local helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Point on a circle; degrees measured anticlockwise from 3 o'clock. */
function pt(pcx: number, pcy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [pcx + Math.cos(a) * r, pcy - Math.sin(a) * r]
}

/** Clockwise arc path from a0 to a1 (a0 > a1 in gauge-dial convention). */
function arcPath(pcx: number, pcy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(pcx, pcy, r, a0)
  const [x1, y1] = pt(pcx, pcy, r, a1)
  const large = Math.abs(a0 - a1) > 180 ? 1 : 0
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

/** Vertical threaded stub pointing down: cylinder with horizontal thread ridges. */
function vThread(
  ctx: RenderContext,
  x: number,
  yTop: number,
  len: number,
  dia: number,
  finish: FinishId
): string {
  const fill = metal(ctx, finish, 'h')
  const ridges: string[] = []
  const step = len / 7
  for (let i = 1; i < 7; i++) {
    const ry = yTop + i * step
    ridges.push(
      `<line x1="${x - dia / 2 + 2}" y1="${ry.toFixed(1)}" x2="${x + dia / 2 - 2}" y2="${ry.toFixed(1)}" stroke="#3a4048" stroke-width="2.5" opacity="0.55"/>`
    )
  }
  return `<g>
    <rect x="${x - dia / 2}" y="${yTop}" width="${dia}" height="${len}" rx="${dia * 0.12}" fill="${fill}" stroke="#33383f" stroke-width="1.5"/>
    ${ridges.join('')}
    <rect x="${x - dia / 2 + dia * 0.1}" y="${yTop + 2}" width="${dia * 0.14}" height="${len - 4}" rx="${dia * 0.07}" fill="#ffffff" opacity="0.28"/>
  </g>`
}

/** Vertical hex flats (wrench block on a stem): three facet bands read side-on. */
function vHexFlats(
  ctx: RenderContext,
  x: number,
  yTop: number,
  h: number,
  w: number,
  finish: FinishId
): string {
  const fill = metal(ctx, finish, 'h')
  const [, hi, , , dark] = tones(finish)
  const facet = w / 3
  const x0 = x - w / 2
  return `<g>
    <rect x="${x0}" y="${yTop}" width="${w}" height="${h}" rx="${w * 0.07}" fill="${fill}" stroke="${dark}" stroke-width="2.5"/>
    <rect x="${x0}" y="${yTop}" width="${facet}" height="${h}" fill="${hi}" opacity="0.26"/>
    <rect x="${x0 + facet * 2}" y="${yTop}" width="${facet}" height="${h}" fill="${dark}" opacity="0.3"/>
    <line x1="${x0 + facet}" y1="${yTop}" x2="${x0 + facet}" y2="${yTop + h}" stroke="${dark}" stroke-width="1.6" opacity="0.5"/>
    <line x1="${x0 + facet * 2}" y1="${yTop}" x2="${x0 + facet * 2}" y2="${yTop + h}" stroke="${dark}" stroke-width="1.6" opacity="0.5"/>
    <rect x="${x0 + 3}" y="${yTop + 3}" width="${w * 0.1}" height="${h - 6}" rx="${w * 0.05}" fill="#ffffff" opacity="0.24"/>
  </g>`
}

interface DialSpec {
  idPrefix: string
  cy: number
  /** Dial-face radius (inside the bezel). */
  r: number
  /** Scale start/end angles, degrees anticlockwise from 3 o'clock, a0 > a1. */
  a0: number
  a1: number
  /** Total tick count; every 4th is a major. */
  ticks: number
  /** Red high-end zone start as a fraction of scale, or null for none. */
  redFrom: number | null
  /** Pointer position as a fraction of the scale. */
  pointerFrac: number
  pointerLen: number
}

/**
 * White instrument dial: face, tick scale, red zone, needle with drop shadow,
 * hub and glass reflections. Shared by gauge and thermometer.
 */
function dialFace(ctx: RenderContext, spec: DialSpec): string {
  const { idPrefix, cy, r, a0, a1, ticks, redFrom, pointerFrac, pointerLen } = spec
  const sweep = a0 - a1
  const face = ctx.def(
    `${idPrefix}-dial`,
    `<radialGradient id="${idPrefix}-dial" cx="0.42" cy="0.36" r="0.95">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#f3f5f7"/>
      <stop offset="0.85" stop-color="#e8ebee"/>
      <stop offset="1" stop-color="#d7dce1"/>
    </radialGradient>`
  )

  const parts: string[] = []
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${face}" stroke="#b9bfc6" stroke-width="1.5"/>`)
  // Faint printed inner ring.
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="none" stroke="#c9ced4" stroke-width="1.5" opacity="0.8"/>`)

  // Tick scale.
  const tickOuter = r * 0.88
  for (let i = 0; i < ticks; i++) {
    const a = a0 - (i * sweep) / (ticks - 1)
    const major = i % 4 === 0
    const inner = tickOuter - (major ? r * 0.13 : r * 0.065)
    const [x1, y1] = pt(cx, cy, tickOuter, a)
    const [x2, y2] = pt(cx, cy, inner, a)
    parts.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#23272c" stroke-width="${major ? 6 : 3}" opacity="${major ? 0.92 : 0.6}"/>`
    )
  }

  // Red high-end zone painted just outside the ticks.
  if (redFrom !== null) {
    const zr = r * 0.93
    parts.push(
      `<path d="${arcPath(cx, cy, zr, a0 - redFrom * sweep, a1)}" fill="none" stroke="#c3272b" stroke-width="${r * 0.05}" stroke-linecap="butt"/>`
    )
  }

  // Suggested maker block and unit block — shaded rects, never text.
  parts.push(`<rect x="${cx - r * 0.16}" y="${cy - r * 0.42}" width="${r * 0.32}" height="${r * 0.09}" rx="${r * 0.03}" fill="#9aa2ab" opacity="0.5"/>`)
  parts.push(`<rect x="${cx - r * 0.11}" y="${cy + r * 0.34}" width="${r * 0.22}" height="${r * 0.075}" rx="${r * 0.03}" fill="#9aa2ab" opacity="0.4"/>`)

  // Needle: kite-section polygon plus a soft drop shadow on the face.
  const aP = a0 - pointerFrac * sweep
  const rad = (aP * Math.PI) / 180
  const dirX = Math.cos(rad)
  const dirY = -Math.sin(rad)
  const perpX = -dirY
  const perpY = dirX
  const tail = pointerLen * 0.28
  const needle = (offX: number, offY: number): string => {
    const p = (px: number, py: number) => `${(px + offX).toFixed(1)},${(py + offY).toFixed(1)}`
    return [
      p(cx + dirX * pointerLen + perpX * 3, cy + dirY * pointerLen + perpY * 3),
      p(cx + perpX * 13, cy + perpY * 13),
      p(cx - dirX * tail + perpX * 9, cy - dirY * tail + perpY * 9),
      p(cx - dirX * tail - perpX * 9, cy - dirY * tail - perpY * 9),
      p(cx - perpX * 13, cy - perpY * 13),
      p(cx + dirX * pointerLen - perpX * 3, cy + dirY * pointerLen - perpY * 3),
    ].join(' ')
  }
  const [, , , , accentDark] = tones(ctx.accent)
  parts.push(`<polygon points="${needle(6, 9)}" fill="#1c2430" opacity="0.14"/>`)
  parts.push(`<polygon points="${needle(0, 0)}" fill="${accentDark}"/>`)
  parts.push(`<polygon points="${needle(0, 0)}" fill="#ffffff" opacity="0.08"/>`)

  // Hub over the needle root.
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.115}" fill="${metalRadial(ctx, ctx.accent)}" stroke="#1a1d21" stroke-width="2"/>`)
  parts.push(`<circle cx="${cx - r * 0.03}" cy="${cy - r * 0.035}" r="${r * 0.032}" fill="#ffffff" opacity="0.5"/>`)

  // Glass: broad low-opacity sheen and a crisper arc, both upper-left.
  parts.push(`<path d="${arcPath(cx, cy, r * 0.7, 168, 92)}" fill="none" stroke="#ffffff" stroke-width="${r * 0.2}" stroke-linecap="round" opacity="0.1"/>`)
  parts.push(`<path d="${arcPath(cx, cy, r * 0.93, 155, 108)}" fill="none" stroke="#ffffff" stroke-width="${r * 0.05}" stroke-linecap="round" opacity="0.28"/>`)

  return parts.join('')
}

/** Round instrument case: depth shadow ring, bezel, and bezel specular. */
function roundCase(ctx: RenderContext, cy: number, rOuter: number, rDial: number): string {
  const [, , , low, dark] = tones(ctx.finish)
  const bezel = metal(ctx, ctx.finish, 'v')
  return `<g>
    <circle cx="${cx + rOuter * 0.03}" cy="${cy + rOuter * 0.04}" r="${rOuter}" fill="${dark}" opacity="0.85"/>
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="${bezel}" stroke="${dark}" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${(rOuter + rDial) / 2}" fill="none" stroke="${low}" stroke-width="1.5" opacity="0.6"/>
    <path d="${arcPath(cx, cy, (rOuter + rDial) / 2, 165, 60)}" fill="none" stroke="#ffffff" stroke-width="${(rOuter - rDial) * 0.42}" stroke-linecap="round" opacity="0.38"/>
    <path d="${arcPath(cx, cy, (rOuter + rDial) / 2, -20, -80)}" fill="none" stroke="${dark}" stroke-width="${(rOuter - rDial) * 0.35}" stroke-linecap="round" opacity="0.3"/>
  </g>`
}

/* -------------------------------------------------------------------------- */
/* gauge — 100 mm bourdon pressure gauge, bottom entry                        */
/* -------------------------------------------------------------------------- */

export const gauge: ShapeRenderer = (ctx) => {
  const cy = 520
  const rCase = 345
  const rDial = rCase * 0.83
  const pointerFrac = 0.52 + ctx.rng(-0.1, 0.14)

  ctx.add(groundShadow(ctx, cx, 1035, 260, 40))

  // Bottom-entry stem: threads, then the wrench flats, tucked under the case.
  ctx.add(vThread(ctx, cx, 925, 95, 105, ctx.finish))
  ctx.add(vHexFlats(ctx, cx, 843, 88, 175, ctx.finish))

  ctx.add(roundCase(ctx, cy, rCase, rDial))
  ctx.add(
    dialFace(ctx, {
      idPrefix: 'gauge',
      cy,
      r: rDial,
      a0: 225,
      a1: -45,
      ticks: 41,
      redFrom: 0.78,
      pointerFrac,
      pointerLen: rDial * 0.8,
    })
  )
}

/* -------------------------------------------------------------------------- */
/* thermometer — 100 mm bimetal dial thermometer with probe stem              */
/* -------------------------------------------------------------------------- */

export const thermometer: ShapeRenderer = (ctx) => {
  const cy = 395
  const rCase = 240
  const rDial = rCase * 0.82
  const pointerFrac = 0.42 + ctx.rng(-0.1, 0.12)
  const probeLen = 225 + ctx.rng(-10, 15)

  ctx.add(groundShadow(ctx, cx, 1030, 210, 34))

  // Probe stem: thermowell hex + threads, then the long immersion probe.
  const stemFill = metal(ctx, ctx.finish, 'h')
  const [, , , , stemDark] = tones(ctx.finish)
  ctx.add(vHexFlats(ctx, cx, 615, 82, 150, ctx.finish))
  ctx.add(vThread(ctx, cx, 697, 78, 85, ctx.finish))
  ctx.add(`<g>
    <rect x="${cx - 18}" y="775" width="36" height="${probeLen}" rx="15" fill="${stemFill}" stroke="${stemDark}" stroke-width="1.5"/>
    <rect x="${cx - 12}" y="779" width="7" height="${probeLen - 10}" rx="3.5" fill="#ffffff" opacity="0.4"/>
  </g>`)

  ctx.add(roundCase(ctx, cy, rCase, rDial))
  ctx.add(
    dialFace(ctx, {
      idPrefix: 'thermo',
      cy,
      r: rDial,
      a0: 210,
      a1: -30,
      ticks: 33,
      redFrom: 0.86,
      pointerFrac,
      pointerLen: rDial * 0.78,
    })
  )
}

/* -------------------------------------------------------------------------- */
/* transmitter — cylindrical pressure transmitter with DIN plug               */
/* -------------------------------------------------------------------------- */

export const transmitter: ShapeRenderer = (ctx) => {
  const barrelW = 240
  const barrelTop = 452
  const barrelH = 315 + ctx.rng(-8, 10)
  const barrelBot = barrelTop + barrelH
  const [, aHi, aMid, , aDark] = tones(ctx.accent)
  const accentSheet = sheet(ctx, ctx.accent)
  const barrelFill = metal(ctx, ctx.finish, 'h')
  const [, , , , bodyDark] = tones(ctx.finish)

  ctx.add(groundShadow(ctx, cx, 1030, 235, 38))

  // Threaded process connection and pressure port tip.
  ctx.add(vThread(ctx, cx, barrelBot + 88, 128, 170, ctx.finish))
  ctx.add(`<polygon points="${cx - 62},${barrelBot + 214} ${cx + 62},${barrelBot + 214} ${cx + 40},${barrelBot + 238} ${cx - 40},${barrelBot + 238}" fill="${metal(ctx, ctx.finish, 'h')}" stroke="#33383f" stroke-width="1.5"/>`)

  // Wrench hex between barrel and threads.
  ctx.add(vHexFlats(ctx, cx, barrelBot - 4, 94, 310, ctx.finish))

  // Cable gland stub on top of the DIN plug.
  ctx.add(`<g>
    <rect x="${cx - 34}" y="168" width="68" height="42" rx="10" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <rect x="${cx - 46}" y="200" width="92" height="30" rx="8" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <rect x="${cx - 27}" y="172" width="12" height="34" rx="6" fill="${aHi}" opacity="0.4"/>
  </g>`)

  // DIN 43650 connector block.
  ctx.add(`<g>
    <rect x="${cx - 128}" y="224" width="256" height="212" rx="20" fill="${accentSheet}" stroke="${aDark}" stroke-width="2.5"/>
    <line x1="${cx - 118}" y1="278" x2="${cx + 118}" y2="278" stroke="${aDark}" stroke-width="2" opacity="0.6"/>
    <line x1="${cx - 118}" y1="382" x2="${cx + 118}" y2="382" stroke="${aDark}" stroke-width="2" opacity="0.6"/>
    <circle cx="${cx}" cy="330" r="24" fill="${metalRadial(ctx, 'steel')}" stroke="#22262b" stroke-width="2"/>
    <rect x="${cx - 20}" y="327" width="40" height="6" rx="3" fill="#22262b" opacity="0.85"/>
    <rect x="${cx - 116}" y="232" width="232" height="18" rx="9" fill="${aHi}" opacity="0.35"/>
  </g>`)

  // Neck between connector and barrel.
  ctx.add(`<rect x="${cx - 62}" y="432" width="124" height="26" rx="6" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>`)

  // Stainless barrel with a laser-etched spec label.
  ctx.add(`<g>
    <rect x="${cx - barrelW / 2}" y="${barrelTop}" width="${barrelW}" height="${barrelH}" rx="16" fill="${barrelFill}" stroke="${bodyDark}" stroke-width="2.5"/>
    <rect x="${cx - barrelW / 2 + 16}" y="${barrelTop + 8}" width="26" height="${barrelH - 16}" rx="13" fill="#ffffff" opacity="0.35"/>
    <rect x="${cx - 78}" y="${barrelTop + 52}" width="156" height="${barrelH - 118}" rx="10" fill="#eef1f3" opacity="0.9" stroke="#c3c9cf" stroke-width="1.5"/>
    <rect x="${cx - 60}" y="${barrelTop + 74}" width="120" height="10" rx="5" fill="#7c848c" opacity="0.75"/>
    <rect x="${cx - 60}" y="${barrelTop + 100}" width="92" height="8" rx="4" fill="#8b929a" opacity="0.6"/>
    <rect x="${cx - 60}" y="${barrelTop + 122}" width="104" height="8" rx="4" fill="#8b929a" opacity="0.6"/>
    <rect x="${cx - 60}" y="${barrelTop + 144}" width="76" height="8" rx="4" fill="#8b929a" opacity="0.6"/>
    <rect x="${cx + 24}" y="${barrelTop + 96}" width="38" height="38" rx="4" fill="#5b636b" opacity="0.55"/>
  </g>`)
}

/* -------------------------------------------------------------------------- */
/* flow-meter — DN50 electromagnetic flow meter with converter head           */
/* -------------------------------------------------------------------------- */

export const flowMeter: ShapeRenderer = (ctx) => {
  const axis = 690
  const tubeDia = 260
  const tubeL = 430
  const tubeR = 1170
  const body = metal(ctx, ctx.finish, 'v')
  const [, , , , bodyDark] = tones(ctx.finish)
  const [, aHi, aMid, , aDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, cx, 915, 470, 56))

  // Measuring tube between the flanges.
  ctx.add(`<rect x="${tubeL}" y="${axis - tubeDia / 2}" width="${tubeR - tubeL}" height="${tubeDia}" rx="24" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<rect x="${tubeL + 14}" y="${axis - tubeDia / 2 + 14}" width="${tubeR - tubeL - 28}" height="${tubeDia * 0.18}" rx="${tubeDia * 0.09}" fill="#ffffff" opacity="0.3"/>`)

  // End flanges with bolt heads.
  ctx.add(flange(ctx, tubeL, axis, 96, 400, ctx.finish))
  ctx.add(flange(ctx, tubeR, axis, 96, 400, ctx.finish))

  // Converter neck, painted before the coil housing so the joint tucks in.
  ctx.add(`<rect x="${cx - 55}" y="415" width="110" height="150" rx="10" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2.5"/>`)

  // Coil housing: the fatter centre band with seam collars.
  ctx.add(`<g>
    <rect x="620" y="${axis - 165}" width="360" height="330" rx="42" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>
    <rect x="612" y="${axis - 171}" width="24" height="342" rx="10" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>
    <rect x="964" y="${axis - 171}" width="24" height="342" rx="10" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>
    <rect x="648" y="${axis - 148}" width="304" height="52" rx="26" fill="#ffffff" opacity="0.28"/>
    ${hexBolt(ctx, 680, axis + 110, 15)}
    ${hexBolt(ctx, 920, axis + 110, 15)}
  </g>`)

  // Converter head with display and keys.
  const headW = 400
  const headTop = 172
  const headH = 246 + ctx.rng(-6, 8)
  const lcd = ctx.def(
    'flowm-lcd',
    `<linearGradient id="flowm-lcd" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#31403a"/>
      <stop offset="0.5" stop-color="#22302a"/>
      <stop offset="1" stop-color="#182119"/>
    </linearGradient>`
  )
  ctx.add(`<g>
    <rect x="${cx - headW / 2}" y="${headTop}" width="${headW}" height="${headH}" rx="30" fill="${sheet(ctx, ctx.finish)}" stroke="${bodyDark}" stroke-width="3"/>
    <rect x="${cx - headW / 2 + 12}" y="${headTop + 10}" width="${headW - 24}" height="20" rx="10" fill="#ffffff" opacity="0.4"/>
    <line x1="${cx - headW / 2 + 10}" y1="${headTop + 44}" x2="${cx + headW / 2 - 10}" y2="${headTop + 44}" stroke="${bodyDark}" stroke-width="2" opacity="0.5"/>
    <rect x="${cx + headW / 2 - 6}" y="${headTop + 116}" width="52" height="34" rx="10" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <rect x="${cx + headW / 2 + 40}" y="${headTop + 120}" width="20" height="26" rx="6" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <rect x="${cx - 130}" y="${headTop + 64}" width="260" height="118" rx="14" fill="${aMid}" stroke="${aDark}" stroke-width="2.5"/>
    <rect x="${cx - 112}" y="${headTop + 78}" width="224" height="90" rx="8" fill="${lcd}"/>
    <rect x="${cx - 96}" y="${headTop + 92}" width="150" height="20" rx="5" fill="#9fd8ae" opacity="0.85"/>
    <rect x="${cx - 96}" y="${headTop + 126}" width="96" height="14" rx="4" fill="#7fb890" opacity="0.6"/>
    <rect x="${cx + 70}" y="${headTop + 92}" width="26" height="20" rx="4" fill="#9fd8ae" opacity="0.5"/>
    <circle cx="${cx - 64}" cy="${headTop + 208}" r="15" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <circle cx="${cx}" cy="${headTop + 208}" r="15" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <circle cx="${cx + 64}" cy="${headTop + 208}" r="15" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <circle cx="${cx - 68}" cy="${headTop + 203}" r="5" fill="${aHi}" opacity="0.5"/>
    <circle cx="${cx - 4}" cy="${headTop + 203}" r="5" fill="${aHi}" opacity="0.5"/>
    <circle cx="${cx + 60}" cy="${headTop + 203}" r="5" fill="${aHi}" opacity="0.5"/>
  </g>`)

  ctx.add(specular(tubeL + 44, axis + tubeDia * 0.28, 130, 12, 0.14))
}

/* -------------------------------------------------------------------------- */
/* clamp-meter — true-RMS clamp meter, jaw over a handheld body               */
/* -------------------------------------------------------------------------- */

export const clampMeter: ShapeRenderer = (ctx) => {
  const tilt = ctx.rng(-2.5, -0.8)
  const dialAngle = ctx.rng(-55, 40)
  const jawCy = 355
  const jawR = 125
  const jawT = 62
  const bodyTop = 458
  const bodyBot = 1008
  const bodyW = 330
  const jawFill = metal(ctx, ctx.accent, 'v')
  const [, aHi, aMid, , aDark] = tones(ctx.accent)
  const bodyFill = sheet(ctx, ctx.finish)
  const [, , , bodyLow, bodyDark] = tones(ctx.finish)
  const lcd = ctx.def(
    'clampm-lcd',
    `<linearGradient id="clampm-lcd" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c8d2c6"/>
      <stop offset="0.5" stop-color="#d8e0d4"/>
      <stop offset="1" stop-color="#bfc9bd"/>
    </linearGradient>`
  )

  ctx.add(groundShadow(ctx, cx, 1035, 260, 40))

  ctx.add(`<g transform="rotate(${tilt.toFixed(1)} ${cx} 720)">`)

  // Jaw: an orange split ring with a hinge boss at each root.
  ctx.add(`<g>
    <circle cx="${cx}" cy="${jawCy}" r="${jawR}" fill="none" stroke="${jawFill}" stroke-width="${jawT}"/>
    <circle cx="${cx}" cy="${jawCy}" r="${jawR + jawT / 2}" fill="none" stroke="${aDark}" stroke-width="3"/>
    <circle cx="${cx}" cy="${jawCy}" r="${jawR - jawT / 2}" fill="none" stroke="${aDark}" stroke-width="2.5"/>
    <path d="${arcPath(cx, jawCy, jawR + jawT * 0.22, 168, 82)}" fill="none" stroke="${aHi}" stroke-width="${jawT * 0.3}" stroke-linecap="round" opacity="0.42"/>
    <path d="${arcPath(cx, jawCy, jawR - jawT * 0.24, -30, -85)}" fill="none" stroke="${aDark}" stroke-width="${jawT * 0.28}" stroke-linecap="round" opacity="0.4"/>
    <line x1="${pt(cx, jawCy, jawR - jawT / 2 - 2, 102)[0].toFixed(1)}" y1="${pt(cx, jawCy, jawR - jawT / 2 - 2, 102)[1].toFixed(1)}" x2="${pt(cx, jawCy, jawR + jawT / 2 + 2, 102)[0].toFixed(1)}" y2="${pt(cx, jawCy, jawR + jawT / 2 + 2, 102)[1].toFixed(1)}" stroke="${aDark}" stroke-width="5"/>
    <line x1="${pt(cx, jawCy, jawR - jawT / 2 - 2, 78)[0].toFixed(1)}" y1="${pt(cx, jawCy, jawR - jawT / 2 - 2, 78)[1].toFixed(1)}" x2="${pt(cx, jawCy, jawR + jawT / 2 + 2, 78)[0].toFixed(1)}" y2="${pt(cx, jawCy, jawR + jawT / 2 + 2, 78)[1].toFixed(1)}" stroke="${aDark}" stroke-width="3" opacity="0.5"/>
  </g>`)

  // Jaw roots: fat moulded shoulders hugging the ring down into the case.
  ctx.add(`<path d="${arcPath(cx, jawCy, 140, 244, 214)}" fill="none" stroke="${aDark}" stroke-width="86" stroke-linecap="round"/>`)
  ctx.add(`<path d="${arcPath(cx, jawCy, 140, 243, 215)}" fill="none" stroke="${jawFill}" stroke-width="78" stroke-linecap="round"/>`)
  ctx.add(`<path d="${arcPath(cx, jawCy, 140, 326, 296)}" fill="none" stroke="${aDark}" stroke-width="86" stroke-linecap="round"/>`)
  ctx.add(`<path d="${arcPath(cx, jawCy, 140, 325, 297)}" fill="none" stroke="${jawFill}" stroke-width="78" stroke-linecap="round"/>`)

  // Trigger lever, tucked behind the case on the left.
  ctx.add(`<g>
    <rect x="${cx - 218}" y="472" width="110" height="62" rx="24" fill="${jawFill}" stroke="${aDark}" stroke-width="2.5"/>
    <rect x="${cx - 208}" y="479" width="66" height="11" rx="5.5" fill="${aHi}" opacity="0.5"/>
    <line x1="${cx - 200}" y1="504" x2="${cx - 168}" y2="504" stroke="${aDark}" stroke-width="3" opacity="0.5"/>
    <line x1="${cx - 200}" y1="516" x2="${cx - 168}" y2="516" stroke="${aDark}" stroke-width="3" opacity="0.5"/>
  </g>`)

  // Body shell.
  ctx.add(`<g>
    <rect x="${cx - bodyW / 2}" y="${bodyTop}" width="${bodyW}" height="${bodyBot - bodyTop}" rx="64" fill="${bodyFill}" stroke="${bodyLow}" stroke-width="3"/>
    <rect x="${cx - bodyW / 2 + 12}" y="${bodyTop + 12}" width="34" height="${bodyBot - bodyTop - 24}" rx="17" fill="#ffffff" opacity="0.45"/>
    <line x1="${cx - bodyW / 2 + 6}" y1="${bodyTop + 90}" x2="${cx - bodyW / 2 + 6}" y2="${bodyBot - 90}" stroke="${bodyLow}" stroke-width="2" opacity="0.5"/>
    <line x1="${cx + bodyW / 2 - 6}" y1="${bodyTop + 90}" x2="${cx + bodyW / 2 - 6}" y2="${bodyBot - 90}" stroke="${bodyLow}" stroke-width="2" opacity="0.5"/>
  </g>`)

  // Display: dark bezel, pale reflective LCD, segment bars suggesting digits.
  ctx.add(`<g>
    <rect x="${cx - 118}" y="492" width="236" height="140" rx="16" fill="#2a2e33" stroke="#191c20" stroke-width="2.5"/>
    <rect x="${cx - 102}" y="506" width="204" height="112" rx="8" fill="${lcd}"/>
    <rect x="${cx - 84}" y="530" width="26" height="60" rx="6" fill="#2c322e" opacity="0.85"/>
    <rect x="${cx - 46}" y="530" width="26" height="60" rx="6" fill="#2c322e" opacity="0.85"/>
    <rect x="${cx - 8}" y="530" width="26" height="60" rx="6" fill="#2c322e" opacity="0.85"/>
    <rect x="${cx + 30}" y="530" width="26" height="60" rx="6" fill="#2c322e" opacity="0.85"/>
    <rect x="${cx + 66}" y="536" width="22" height="16" rx="4" fill="#2c322e" opacity="0.6"/>
    <rect x="${cx - 98}" y="510" width="196" height="14" rx="7" fill="#ffffff" opacity="0.35"/>
  </g>`)

  // Function buttons.
  ctx.add(`<g>
    <rect x="${cx - 110}" y="656" width="86" height="42" rx="21" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>
    <rect x="${cx + 24}" y="656" width="86" height="42" rx="21" fill="#3a3f45" stroke="#22262b" stroke-width="2"/>
    <rect x="${cx - 100}" y="662" width="66" height="10" rx="5" fill="${aHi}" opacity="0.5"/>
    <rect x="${cx + 34}" y="662" width="66" height="10" rx="5" fill="#ffffff" opacity="0.25"/>
  </g>`)

  // Rotary range selector with a pointer stripe and tick dots.
  const dialCy = 800
  ctx.add(`<g>
    <circle cx="${cx}" cy="${dialCy}" r="86" fill="#33383e" stroke="#1e2226" stroke-width="2.5"/>
    <circle cx="${cx}" cy="${dialCy}" r="70" fill="${metalRadial(ctx, ctx.accent)}" stroke="${aDark}" stroke-width="2.5"/>
    <g transform="rotate(${dialAngle.toFixed(1)} ${cx} ${dialCy})">
      <rect x="${cx - 8}" y="${dialCy - 64}" width="16" height="52" rx="8" fill="#f4f6f8" stroke="#22262b" stroke-width="1.5"/>
    </g>
    <circle cx="${cx - 22}" cy="${dialCy - 24}" r="16" fill="#ffffff" opacity="0.28"/>
  </g>`)
  const dotAngles = [150, 115, 80, 45, 10, -25]
  for (const a of dotAngles) {
    const [dx, dy] = pt(cx, dialCy, 102, a)
    ctx.add(`<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="6" fill="${bodyDark}" opacity="0.75"/>`)
  }

  // Test-lead jacks: COM black, V/Ω red.
  ctx.add(`<g>
    <circle cx="${cx - 62}" cy="944" r="28" fill="#22262b" stroke="#101215" stroke-width="2.5"/>
    <circle cx="${cx - 62}" cy="944" r="14" fill="#0c0e10"/>
    <circle cx="${cx - 70}" cy="936" r="6" fill="#ffffff" opacity="0.3"/>
    <circle cx="${cx + 62}" cy="944" r="28" fill="#a02024" stroke="#5e0e10" stroke-width="2.5"/>
    <circle cx="${cx + 62}" cy="944" r="14" fill="#3a0a0b"/>
    <circle cx="${cx + 54}" cy="936" r="6" fill="#ffffff" opacity="0.35"/>
  </g>`)

  // Case screws at the bottom corners.
  ctx.add(`<circle cx="${cx - 128}" cy="978" r="9" fill="${bodyLow}" stroke="${bodyDark}" stroke-width="1.5"/>`)
  ctx.add(`<circle cx="${cx + 128}" cy="978" r="9" fill="${bodyLow}" stroke="${bodyDark}" stroke-width="1.5"/>`)

  ctx.add('</g>')
}
