/**
 * Fire-fighting renders: sprinkler, hydrant, hose, flow-switch.
 *
 * Follow the `ballValve` reference in ./valves.ts for conventions.
 */

import { CANVAS, type FinishId, type RenderContext, type ShapeRenderer } from '../types'
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

/** ctx.add for several fragments at once, painted in order. */
function put(ctx: RenderContext, ...fragments: string[]): void {
  ctx.add(fragments.join('\n  '))
}

/** Vertical threaded stub: cylinder with horizontal thread ridges. */
function vThread(
  ctx: RenderContext,
  centerX: number,
  yTop: number,
  len: number,
  dia: number,
  finish: FinishId
): string {
  const fill = metal(ctx, finish, 'h')
  const [, , , , dark] = tones(finish)
  const ridges: string[] = []
  const step = len / 7
  for (let i = 1; i < 7; i++) {
    const ry = yTop + i * step
    ridges.push(
      `<line x1="${centerX - dia / 2 + 3}" y1="${ry}" x2="${centerX + dia / 2 - 3}" y2="${ry}" stroke="${dark}" stroke-width="3" opacity="0.5"/>`
    )
  }
  return `<g>
    <rect x="${centerX - dia / 2}" y="${yTop}" width="${dia}" height="${len}" rx="${dia * 0.1}" fill="${fill}" stroke="${dark}" stroke-width="2"/>
    ${ridges.join('')}
    <rect x="${centerX - dia / 2 + dia * 0.12}" y="${yTop + 3}" width="${dia * 0.14}" height="${len - 6}" rx="${dia * 0.07}" fill="#ffffff" opacity="0.28"/>
  </g>`
}

/**
 * Hex boss with a VERTICAL axis seen side-on: three vertical facet bands.
 * (The valves.ts hexCap is the horizontal-axis version.)
 */
function hexBossV(
  ctx: RenderContext,
  centerX: number,
  yTop: number,
  w: number,
  h: number,
  finish: FinishId
): string {
  const fill = metal(ctx, finish, 'h')
  const [, hi, , , dark] = tones(finish)
  const x = centerX - w / 2
  const facet = w / 3
  return `<g>
    <rect x="${x}" y="${yTop}" width="${w}" height="${h}" rx="${w * 0.06}" fill="${fill}" stroke="${dark}" stroke-width="2.5"/>
    <rect x="${x}" y="${yTop}" width="${facet}" height="${h}" fill="${hi}" opacity="0.26"/>
    <rect x="${x + facet * 2}" y="${yTop}" width="${facet}" height="${h}" fill="${dark}" opacity="0.3"/>
    <line x1="${x + facet}" y1="${yTop}" x2="${x + facet}" y2="${yTop + h}" stroke="${dark}" stroke-width="1.6" opacity="0.5"/>
    <line x1="${x + facet * 2}" y1="${yTop}" x2="${x + facet * 2}" y2="${yTop + h}" stroke="${dark}" stroke-width="1.6" opacity="0.5"/>
    <rect x="${x + 3}" y="${yTop + 2}" width="${w * 0.1}" height="${h - 4}" rx="${w * 0.05}" fill="#ffffff" opacity="0.22"/>
  </g>`
}

/* -------------------------------------------------------------------------- */
/* Sprinkler — upright head: threaded shank, hex boss, frame arms, glass      */
/* bulb, serrated deflector.                                                  */
/* -------------------------------------------------------------------------- */

export const sprinkler: ShapeRenderer = (ctx) => {
  const tilt = ctx.rng(-1.6, 1.6)
  const [, hiT, midT, lowT, darkT] = tones(ctx.finish)

  put(ctx,groundShadow(ctx, cx, 908, 280, 44))

  const parts: string[] = []

  // Threaded inlet shank (bottom).
  parts.push(vThread(ctx, cx, 762, 150, 186, ctx.finish))

  // Wrench boss — the big hex flats.
  parts.push(hexBossV(ctx, cx, 640, 372, 124, ctx.finish))

  // Seat collar and gland step above the boss.
  parts.push(
    `<rect x="${cx - 106}" y="590" width="212" height="52" rx="12" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${darkT}" stroke-width="2.5"/>`,
    `<rect x="${cx - 72}" y="560" width="144" height="32" rx="9" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${darkT}" stroke-width="2"/>`,
    `<rect x="${cx - 96}" y="594" width="24" height="44" rx="10" fill="#ffffff" opacity="0.25"/>`
  )

  // Frame arms — cast, tapering toward the crown. Painted as layered strokes.
  const armPath = (sx: number, qx: number, ex: number) =>
    `M ${sx} 640 Q ${qx} 410 ${ex} 258`
  const left = armPath(cx - 138, cx - 152, cx - 28)
  const right = armPath(cx + 138, cx + 152, cx + 28)
  for (const d of [left, right]) {
    parts.push(
      `<path d="${d}" fill="none" stroke="${darkT}" stroke-width="32" stroke-linecap="round"/>`,
      `<path d="${d}" fill="none" stroke="${midT}" stroke-width="23" stroke-linecap="round"/>`,
      `<path d="${d}" fill="none" stroke="${lowT}" stroke-width="10" stroke-linecap="round" opacity="0.7"/>`,
      `<path d="${d}" fill="none" stroke="${hiT}" stroke-width="6" stroke-linecap="round" opacity="0.5" transform="translate(-4 0)"/>`
    )
  }

  // Bulb seat cup.
  parts.push(
    `<rect x="${cx - 48}" y="576" width="96" height="26" rx="9" fill="${metal(ctx, ctx.accent, 'h')}" stroke="${darkT}" stroke-width="2"/>`
  )

  // Glass bulb with red thermal liquid.
  const bulbFill = ctx.def(
    'fire-sprk-bulb',
    `<linearGradient id="fire-sprk-bulb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8f0d12"/>
      <stop offset="0.3" stop-color="#e8352d"/>
      <stop offset="0.52" stop-color="#ff6a52"/>
      <stop offset="0.72" stop-color="#d31f24"/>
      <stop offset="1" stop-color="#6f090e"/>
    </linearGradient>`
  )
  parts.push(
    `<ellipse cx="${cx}" cy="440" rx="46" ry="152" fill="${bulbFill}" stroke="#5c070b" stroke-width="2" opacity="0.96"/>`,
    // glass wall sheen + trapped air bubble
    `<ellipse cx="${cx - 20}" cy="408" rx="9" ry="98" fill="#ffffff" opacity="0.45"/>`,
    `<ellipse cx="${cx + 24}" cy="480" rx="5" ry="60" fill="#ffffff" opacity="0.18"/>`,
    `<circle cx="${cx + 4}" cy="336" r="9" fill="#ffd9cf" opacity="0.85"/>`
  )

  // Crown boss the arms converge into, with the compression screw and the
  // stem that carries the deflector.
  parts.push(
    `<rect x="${cx - 13}" y="184" width="26" height="52" rx="6" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${darkT}" stroke-width="2"/>`,
    `<rect x="${cx - 52}" y="216" width="104" height="64" rx="14" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${darkT}" stroke-width="2.5"/>`,
    `<rect x="${cx - 42}" y="222" width="16" height="52" rx="8" fill="#ffffff" opacity="0.25"/>`,
    `<rect x="${cx - 16}" y="272" width="32" height="24" rx="6" fill="${metal(ctx, ctx.accent, 'h')}" stroke="${darkT}" stroke-width="2"/>`
  )

  // Deflector: serrated disc seen edge-on with upturned tips.
  const defY = 166
  parts.push(
    `<rect x="${cx - 178}" y="${defY}" width="356" height="26" rx="10" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${darkT}" stroke-width="2.5"/>`,
    ribs(cx - 162, defY + 3, 324, 20, 10, darkT, 0.45, 3),
    `<rect x="${cx - 166}" y="${defY + 3}" width="332" height="6" rx="3" fill="#ffffff" opacity="0.35"/>`
  )

  put(ctx,`<g transform="rotate(${tilt.toFixed(1)} ${cx} 800)">${parts.join('')}</g>`)
}

/* -------------------------------------------------------------------------- */
/* Hydrant — pillar hydrant: base flange, tapered barrel, capped side         */
/* outlets with chains, bolted bonnet, operating nut.                         */
/* -------------------------------------------------------------------------- */

export const hydrant: ShapeRenderer = (ctx) => {
  const body = metal(ctx, ctx.finish, 'h')
  const [, bodyHi, , , bodyDark] = tones(ctx.finish)
  const [, , capMid, , capDark] = tones(ctx.accent)
  const capFill = metal(ctx, ctx.accent, 'h')
  const chainSag = ctx.rng(-8, 10)

  put(ctx,groundShadow(ctx, cx, 906, 350, 52))

  // Base: ground flange and collar.
  put(ctx,
    `<rect x="${cx - 210}" y="872" width="420" height="42" rx="10" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="3"/>`,
    `<rect x="${cx - 168}" y="838" width="336" height="44" rx="12" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>`
  )
  for (const dx of [-160, -55, 55, 160]) {
    put(ctx,hexBolt(ctx, cx + dx, 893, 12))
  }

  // Barrel — gently tapered cylinder.
  put(ctx,
    `<path d="M ${cx - 150} 852 L ${cx - 132} 448 L ${cx + 132} 448 L ${cx + 150} 852 Z" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>`,
    `<rect x="${cx - 122}" y="470" width="30" height="370" rx="15" fill="#ffffff" opacity="0.22"/>`,
    `<rect x="${cx + 78}" y="470" width="34" height="370" rx="17" fill="${bodyDark}" opacity="0.22"/>`
  )

  // Cast shield plate on the barrel front (raised oval, no lettering).
  put(ctx,
    `<ellipse cx="${cx}" cy="672" rx="80" ry="96" fill="${bodyHi}" opacity="0.10"/>`,
    `<ellipse cx="${cx}" cy="672" rx="80" ry="96" fill="none" stroke="${bodyDark}" stroke-width="3.5" opacity="0.45"/>`,
    `<ellipse cx="${cx}" cy="672" rx="62" ry="76" fill="none" stroke="${bodyDark}" stroke-width="2" opacity="0.3"/>`,
    `<rect x="${cx - 44}" y="648" width="88" height="12" rx="6" fill="${bodyDark}" opacity="0.32"/>`,
    `<rect x="${cx - 34}" y="672" width="68" height="10" rx="5" fill="${bodyDark}" opacity="0.28"/>`
  )

  // Cap security chains — behind the caps.
  const chain = (sx: number, sy: number, ex: number, ey: number, mx: number): string => {
    const links: string[] = []
    for (let i = 0; i <= 9; i++) {
      const t = i / 9
      const omt = 1 - t
      const px = omt * omt * sx + 2 * omt * t * mx + t * t * ex
      const py = omt * omt * sy + 2 * omt * t * (Math.max(sy, ey) + 58 + chainSag) + t * t * ey
      links.push(
        `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="none" stroke="#6d6f72" stroke-width="3.4"/>`
      )
    }
    return `<g opacity="0.9">${links.join('')}</g>`
  }
  put(ctx,chain(cx - 258, 630, cx - 130, 700, cx - 210))
  put(ctx,chain(cx + 258, 630, cx + 130, 700, cx + 210))

  // Side outlets: nozzle stubs + instantaneous blank caps (accent metal).
  for (const side of [-1, 1]) {
    const sx = cx + side * 128
    const capX = cx + side * 250
    put(ctx,
      `<rect x="${side < 0 ? sx - 88 : sx}" y="512" width="88" height="100" rx="10" fill="${capFill}" stroke="${capDark}" stroke-width="2.5"/>`,
      `<rect x="${capX - 36}" y="490" width="72" height="144" rx="16" fill="${capFill}" stroke="${capDark}" stroke-width="3"/>`,
      `<rect x="${capX - 36}" y="490" width="72" height="48" fill="#ffffff" opacity="0.2"/>`,
      `<rect x="${capX - 36}" y="586" width="72" height="48" fill="${capDark}" opacity="0.28"/>`,
      `<line x1="${capX - 36}" y1="538" x2="${capX + 36}" y2="538" stroke="${capDark}" stroke-width="1.6" opacity="0.5"/>`,
      `<line x1="${capX - 36}" y1="586" x2="${capX + 36}" y2="586" stroke="${capDark}" stroke-width="1.6" opacity="0.5"/>`,
      `<ellipse cx="${capX + side * 32}" cy="562" rx="17" ry="72" fill="${metalRadial(ctx, ctx.accent)}" stroke="${capDark}" stroke-width="2.5"/>`,
      `<rect x="${capX + side * 26 - 8}" y="540" width="16" height="44" rx="6" fill="${capMid}" stroke="${capDark}" stroke-width="2"/>`
    )
  }

  // Bonnet flange with bolts along the visible front arc.
  put(ctx,
    `<rect x="${cx - 172}" y="424" width="344" height="38" rx="11" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="3"/>`
  )
  for (const dx of [-138, -70, 0, 70, 138]) {
    const dip = 10 - (Math.abs(dx) / 138) * 10
    put(ctx,hexBolt(ctx, cx + dx, 466 + dip, 13))
  }

  // Pentagon operating nut (accent) on the crown — behind the dome apex.
  put(ctx,
    `<path d="M ${cx - 46} 330 L ${cx - 32} 262 L ${cx + 32} 262 L ${cx + 46} 330 Z" fill="${capFill}" stroke="${capDark}" stroke-width="2.5"/>`,
    `<ellipse cx="${cx}" cy="262" rx="32" ry="9" fill="${metalRadial(ctx, ctx.accent)}" stroke="${capDark}" stroke-width="2"/>`,
    `<line x1="${cx - 38}" y1="298" x2="${cx + 38}" y2="298" stroke="${capDark}" stroke-width="1.6" opacity="0.5"/>`
  )

  // Bonnet dome.
  put(ctx,
    `<path d="M ${cx - 150} 428 Q ${cx} 208 ${cx + 150} 428 Z" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>`,
    `<path d="M ${cx - 102} 386 Q ${cx - 42} 292 ${cx + 28} 302" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" opacity="0.28"/>`
  )

  put(ctx,specular(cx - 118, 486, 22, 330, 0.16, 11))
}

/* -------------------------------------------------------------------------- */
/* Hose — rolled fire hose standing on edge, tail run to a stainless          */
/* instantaneous coupling on the floor.                                       */
/* -------------------------------------------------------------------------- */

export const hose: ShapeRenderer = (ctx) => {
  const ccx = cx - 60
  const ccy = 540
  const R = 348
  const spiralDrift = ctx.rng(1, 3)
  const [, hoseHi, hoseMid, hoseLow, hoseDark] = tones(ctx.finish)
  const [, , , , trimDark] = tones(ctx.accent)

  put(ctx,groundShadow(ctx, ccx + 40, 898, 360, 44))
  put(ctx,groundShadow(ctx, ccx + 500, 890, 190, 26, 0.15))

  // Tail: flat hose lying on the floor from under the coil to the coupling.
  const tailTopY = 846
  put(ctx,
    `<path d="M ${ccx + 150} 812 Q ${ccx + 260} ${tailTopY} ${ccx + 400} ${tailTopY + 4} L ${ccx + 560} ${tailTopY + 6} L ${ccx + 560} ${tailTopY + 42} L ${ccx + 380} ${tailTopY + 40} Q ${ccx + 240} ${tailTopY + 36} ${ccx + 130} 852 Z" fill="${hoseMid}" stroke="${hoseDark}" stroke-width="2.5"/>`,
    `<path d="M ${ccx + 160} 824 Q ${ccx + 270} ${tailTopY + 10} ${ccx + 556} ${tailTopY + 16}" fill="none" stroke="${hoseHi}" stroke-width="6" opacity="0.5"/>`,
    `<path d="M ${ccx + 170} 840 Q ${ccx + 280} ${tailTopY + 26} ${ccx + 556} ${tailTopY + 30}" fill="none" stroke="${hoseDark}" stroke-width="4" opacity="0.4"/>`
  )

  // Binding collar where the coupling is wired on.
  put(ctx,
    `<rect x="${ccx + 552}" y="${tailTopY - 6}" width="52" height="58" rx="10" fill="${hoseLow}" stroke="${hoseDark}" stroke-width="2.5"/>`,
    ribs(ccx + 556, tailTopY - 4, 44, 54, 4, hoseDark, 0.5, 3)
  )

  // Instantaneous male coupling (accent metal) at the end of the tail.
  const coupFill = metal(ctx, ctx.accent, 'v')
  put(ctx,
    `<rect x="${ccx + 602}" y="${tailTopY - 12}" width="96" height="70" rx="10" fill="${coupFill}" stroke="${trimDark}" stroke-width="2.5"/>`,
    `<rect x="${ccx + 640}" y="${tailTopY - 20}" width="26" height="86" rx="8" fill="${coupFill}" stroke="${trimDark}" stroke-width="2.5"/>`,
    `<rect x="${ccx + 694}" y="${tailTopY - 6}" width="34" height="58" rx="8" fill="${metal(ctx, ctx.accent, 'v')}" stroke="${trimDark}" stroke-width="2.5"/>`,
    `<rect x="${ccx + 606}" y="${tailTopY - 4}" width="88" height="10" rx="5" fill="#ffffff" opacity="0.4"/>`
  )

  // Coil drum depth cue: back rim peeking out to the right.
  put(ctx,
    `<circle cx="${ccx + 16}" cy="${ccy}" r="${R}" fill="${hoseDark}"/>`
  )

  // Coil face: radial-lit disc of wound hose.
  put(ctx,
    `<circle cx="${ccx}" cy="${ccy}" r="${R}" fill="${metalRadial(ctx, ctx.finish)}" stroke="${hoseDark}" stroke-width="4"/>`
  )

  // Wrap boundaries — slightly drifting centres read as a spiral.
  const wraps = 7
  const hubR = 96
  const step = (R - hubR) / wraps
  for (let i = 1; i <= wraps; i++) {
    const r = hubR + step * i - step / 2 + 6
    const ox = spiralDrift * i * 0.9
    const oy = spiralDrift * i * 0.35
    put(ctx,
      `<circle cx="${(ccx + ox - spiralDrift * 3).toFixed(1)}" cy="${(ccy + oy - spiralDrift).toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${hoseDark}" stroke-width="9" opacity="0.62"/>`,
      `<circle cx="${(ccx + ox - spiralDrift * 3).toFixed(1)}" cy="${(ccy + oy - spiralDrift - 6).toFixed(1)}" r="${(r - 6).toFixed(1)}" fill="none" stroke="${hoseHi}" stroke-width="5" opacity="0.22"/>`
    )
  }

  // Woven-jacket texture.
  const weave = ctx.def(
    'fire-hose-weave',
    `<pattern id="fire-hose-weave" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(48)">
      <line x1="0" y1="3" x2="13" y2="3" stroke="#000000" stroke-width="2.4"/>
      <line x1="0" y1="9.5" x2="13" y2="9.5" stroke="#ffffff" stroke-width="1.6"/>
    </pattern>`
  )
  put(ctx,`<circle cx="${ccx}" cy="${ccy}" r="${R - 3}" fill="${weave}" opacity="0.07"/>`)

  // Hub: female instantaneous coupling seen end-on at the coil centre.
  const boreFill = ctx.def(
    'fire-hose-bore',
    `<radialGradient id="fire-hose-bore" cx="0.42" cy="0.38" r="0.75">
      <stop offset="0" stop-color="#3a3f46"/>
      <stop offset="0.55" stop-color="#16181c"/>
      <stop offset="1" stop-color="#060708"/>
    </radialGradient>`
  )
  put(ctx,
    `<circle cx="${ccx}" cy="${ccy}" r="${hubR}" fill="${metalRadial(ctx, ctx.accent)}" stroke="${trimDark}" stroke-width="3"/>`,
    `<circle cx="${ccx}" cy="${ccy}" r="${hubR - 22}" fill="none" stroke="${trimDark}" stroke-width="3" opacity="0.6"/>`,
    `<circle cx="${ccx}" cy="${ccy}" r="56" fill="${boreFill}" stroke="#0c0d0f" stroke-width="2.5"/>`,
    `<rect x="${ccx - 10}" y="${ccy - hubR - 4}" width="20" height="18" rx="5" fill="${hoseLow}" stroke="${trimDark}" stroke-width="2"/>`,
    `<rect x="${ccx - 10}" y="${ccy + hubR - 14}" width="20" height="18" rx="5" fill="${hoseLow}" stroke="${trimDark}" stroke-width="2"/>`,
    `<circle cx="${ccx - 26}" cy="${ccy - 28}" r="10" fill="#ffffff" opacity="0.4"/>`
  )

  // Studio highlight sweeping the upper-left of the coil face.
  put(ctx,
    `<path d="M ${ccx - R + 40} ${ccy - 120} A ${R - 42} ${R - 42} 0 0 1 ${ccx + 60} ${ccy - R + 44}" fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round" opacity="0.14"/>`
  )
}

/* -------------------------------------------------------------------------- */
/* Flow switch — vane type strapped to a grooved sprinkler main: pipe,        */
/* saddle with U-bolt straps, hex bushing, red switch enclosure.              */
/* -------------------------------------------------------------------------- */

export const floSwitch: ShapeRenderer = (ctx) => {
  const axis = 720
  const dia = 190
  const pipeL = 250
  const pipeR = 1350
  const tilt = ctx.rng(-1.1, 1.1)

  const pipeFill = metal(ctx, ctx.finish, 'v')
  const [, , , , pipeDark] = tones(ctx.finish)
  const [, , , boxLow, boxDark] = tones(ctx.accent)

  put(ctx,groundShadow(ctx, cx, 898, 540, 56))

  // Sprinkler main: straight run of grooved pipe.
  put(ctx,
    `<rect x="${pipeL}" y="${axis - dia / 2}" width="${pipeR - pipeL}" height="${dia}" rx="14" fill="${pipeFill}" stroke="${pipeDark}" stroke-width="3"/>`
  )
  for (const gx of [pipeL + 64, pipeR - 64]) {
    put(ctx,
      `<line x1="${gx}" y1="${axis - dia / 2 + 4}" x2="${gx}" y2="${axis + dia / 2 - 4}" stroke="${pipeDark}" stroke-width="7" opacity="0.55"/>`,
      `<line x1="${gx + 10}" y1="${axis - dia / 2 + 4}" x2="${gx + 10}" y2="${axis + dia / 2 - 4}" stroke="#ffffff" stroke-width="3" opacity="0.25"/>`
    )
  }
  // Cut end faces.
  put(ctx,
    `<rect x="${pipeL}" y="${axis - dia / 2}" width="12" height="${dia}" rx="6" fill="${pipeDark}" opacity="0.55"/>`,
    `<rect x="${pipeR - 12}" y="${axis - dia / 2}" width="12" height="${dia}" rx="6" fill="${pipeDark}" opacity="0.55"/>`
  )
  put(ctx,specular(pipeL + 30, axis - dia / 2 + 16, pipeR - pipeL - 60, dia * 0.16, 0.3))

  // U-bolt straps wrapping the pipe.
  for (const sx of [cx - 96, cx + 96]) {
    put(ctx,
      `<rect x="${sx - 9}" y="${axis - dia / 2 + 3}" width="18" height="${dia - 6}" rx="9" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="2"/>`
    )
  }

  // Saddle plate on the pipe crown, strap nuts seated on it.
  put(ctx,
    `<rect x="${cx - 140}" y="${axis - dia / 2 - 40}" width="280" height="38" rx="10" fill="${sheet(ctx, 'machineGray')}" stroke="#41454c" stroke-width="2.5"/>`,
    `<rect x="${cx - 128}" y="${axis - dia / 2 - 36}" width="256" height="8" rx="4" fill="#ffffff" opacity="0.3"/>`,
    hexBolt(ctx, cx - 96, axis - dia / 2 - 21, 14),
    hexBolt(ctx, cx + 96, axis - dia / 2 - 21, 14)
  )

  // Everything above the saddle leans a touch for pose life.
  const boxX = cx - 175
  const boxY = 262
  const boxW = 350
  const boxH = 292
  const parts: string[] = []

  // Hex bushing between saddle and enclosure.
  parts.push(hexBossV(ctx, cx, boxY + boxH - 6, 100, (axis - dia / 2 - 40) - (boxY + boxH) + 10, 'steel'))

  // Switch enclosure (accent — epoxy red on a real vane switch).
  parts.push(
    `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="26" fill="${sheet(ctx, ctx.accent)}" stroke="${boxDark}" stroke-width="3.5"/>`,
    `<rect x="${boxX + 14}" y="${boxY + 12}" width="${boxW - 28}" height="${boxH - 24}" rx="18" fill="none" stroke="${boxDark}" stroke-width="2" opacity="0.4"/>`,
    `<rect x="${boxX + 20}" y="${boxY + 14}" width="${boxW - 40}" height="34" rx="16" fill="#ffffff" opacity="0.28"/>`,
    `<rect x="${boxX + 8}" y="${boxY + boxH - 46}" width="${boxW - 16}" height="30" rx="14" fill="${boxLow}" opacity="0.5"/>`
  )

  // Cover screws.
  const screwAt: [number, number][] = [
    [boxX + 34, boxY + 34],
    [boxX + boxW - 34, boxY + 34],
    [boxX + 34, boxY + boxH - 34],
    [boxX + boxW - 34, boxY + boxH - 34],
  ]
  for (const [sx, sy] of screwAt) {
    parts.push(
      `<circle cx="${sx}" cy="${sy}" r="11" fill="${metalRadial(ctx, 'steel')}" stroke="#2f343a" stroke-width="2"/>`,
      `<line x1="${sx - 6}" y1="${sy}" x2="${sx + 6}" y2="${sy}" stroke="#2f343a" stroke-width="2.5" transform="rotate(24 ${sx} ${sy})"/>`
    )
  }

  // Nameplate — shaded label, printed lines suggested with grey bars.
  const plateX = boxX + 72
  const plateY = boxY + 92
  parts.push(
    `<rect x="${plateX}" y="${plateY}" width="206" height="118" rx="10" fill="#eceff2" stroke="#9aa1a8" stroke-width="2"/>`,
    `<rect x="${plateX + 18}" y="${plateY + 20}" width="130" height="14" rx="7" fill="#5b636c" opacity="0.85"/>`,
    `<rect x="${plateX + 18}" y="${plateY + 48}" width="170" height="9" rx="4.5" fill="#8a929b" opacity="0.8"/>`,
    `<rect x="${plateX + 18}" y="${plateY + 68}" width="150" height="9" rx="4.5" fill="#8a929b" opacity="0.8"/>`,
    `<rect x="${plateX + 18}" y="${plateY + 88}" width="96" height="9" rx="4.5" fill="#8a929b" opacity="0.8"/>`,
    `<circle cx="${plateX + 178}" cy="${plateY + 26}" r="9" fill="#c3272b" opacity="0.9"/>`
  )

  // Conduit hub on the right-hand side.
  parts.push(
    `<rect x="${boxX + boxW - 4}" y="${boxY + 44}" width="58" height="52" rx="10" fill="${metal(ctx, 'steel', 'v')}" stroke="#33383f" stroke-width="2.5"/>`,
    `<line x1="${boxX + boxW + 14}" y1="${boxY + 48}" x2="${boxX + boxW + 14}" y2="${boxY + 92}" stroke="#33383f" stroke-width="2.5" opacity="0.6"/>`,
    `<line x1="${boxX + boxW + 30}" y1="${boxY + 48}" x2="${boxX + boxW + 30}" y2="${boxY + 92}" stroke="#33383f" stroke-width="2.5" opacity="0.6"/>`,
    `<rect x="${boxX + boxW + 42}" y="${boxY + 42}" width="14" height="56" rx="6" fill="${metal(ctx, 'steel', 'v')}" stroke="#33383f" stroke-width="2"/>`
  )

  put(ctx,`<g transform="rotate(${tilt.toFixed(1)} ${cx} ${axis - dia / 2 - 40})">${parts.join('')}</g>`)
}
