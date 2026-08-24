/**
 * HVAC renders: ahu, fcu, fan, filter, compressor.
 *
 * Follow the `ballValve` reference in ./valves.ts for conventions:
 * groundShadow first, back-to-front, body = ctx.finish, trim = ctx.accent,
 * pose life only through ctx.rng.
 */

import { CANVAS, type FinishId, type RenderContext, type ShapeRenderer } from '../types'
import {
  groundShadow,
  handwheel,
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
/* Local helpers (this module only)                                           */
/* -------------------------------------------------------------------------- */

/** Lit top-face gradient for a parallel-projection cabinet. */
function boxTopFill(ctx: RenderContext, finish: FinishId): string {
  const [, hi, mid] = tones(finish)
  const id = `clim-top-${finish}`
  return ctx.def(
    id,
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hi}"/>
      <stop offset="1" stop-color="${mid}"/>
    </linearGradient>`
  )
}

/** Shaded right-side-face gradient for a parallel-projection cabinet. */
function boxSideFill(ctx: RenderContext, finish: FinishId): string {
  const [, , , low, dark] = tones(finish)
  const id = `clim-side-${finish}`
  return ctx.def(
    id,
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${low}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>`
  )
}

/**
 * Sheet-metal cabinet in parallel projection: front face at (x,y,w,h) with a
 * lit top face and a shaded right side face offset by (dx,dy), dy negative.
 */
function cabinet(
  ctx: RenderContext,
  x: number,
  y: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  finish: FinishId
): string {
  const [, , , , dark] = tones(finish)
  return `<g>
    <polygon points="${x},${y} ${x + dx},${y + dy} ${x + w + dx},${y + dy} ${x + w},${y}" fill="${boxTopFill(ctx, finish)}" stroke="${dark}" stroke-width="2"/>
    <polygon points="${x + w},${y} ${x + w + dx},${y + dy} ${x + w + dx},${y + h + dy} ${x + w},${y + h}" fill="${boxSideFill(ctx, finish)}" stroke="${dark}" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${sheet(ctx, finish)}" stroke="${dark}" stroke-width="2.5"/>
  </g>`
}

/** Small domed rivet / screw head. */
function rivet(x: number, y: number, r = 5): string {
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#9aa2ab" stroke="#4d545c" stroke-width="1.2"/>
    <circle cx="${x - r * 0.3}" cy="${y - r * 0.32}" r="${r * 0.34}" fill="#ffffff" opacity="0.7"/>
  </g>`
}

/** Vertical black bar door handle with a brushed centre line. */
function doorHandle(x: number, y: number, len = 66): string {
  return `<g>
    <rect x="${x - 8}" y="${y}" width="16" height="${len}" rx="8" fill="#22262b" stroke="#101317" stroke-width="1.5"/>
    <rect x="${x - 4}" y="${y + 5}" width="4.5" height="${len - 10}" rx="2.2" fill="#6a727c" opacity="0.85"/>
  </g>`
}

/** Slotted mounting hole. */
function slot(x: number, y: number, w: number, h: number): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#181c20" stroke="#565c66" stroke-width="1.5"/>`
}

/** Inspection porthole: aluminium bezel, dark glass, arc highlight. */
function porthole(ctx: RenderContext, x: number, y: number, r: number): string {
  const glass = ctx.def(
    'clim-glass',
    `<radialGradient id="clim-glass" cx="0.36" cy="0.3" r="0.95">
      <stop offset="0" stop-color="#5a6672"/>
      <stop offset="0.55" stop-color="#2b333c"/>
      <stop offset="1" stop-color="#12171d"/>
    </radialGradient>`
  )
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r + 11}" fill="${metalRadial(ctx, 'aluminium')}" stroke="#565c66" stroke-width="2.5"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${glass}" stroke="#1c2127" stroke-width="3"/>
    <path d="M ${x - r * 0.62} ${y - r * 0.28} A ${r * 0.72} ${r * 0.72} 0 0 1 ${x - r * 0.05} ${y - r * 0.68}" stroke="#dfe8f0" stroke-width="7" fill="none" opacity="0.5" stroke-linecap="round"/>
  </g>`
}

/** Sickle-bladed axial impeller, blades only. */
function fanBlades(
  ctx: RenderContext,
  cx0: number,
  cy0: number,
  rIn: number,
  rOut: number,
  count: number,
  offsetDeg: number,
  fill: string,
  stroke: string
): string {
  const pt = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return `${(cx0 + Math.cos(a) * r).toFixed(1)} ${(cy0 + Math.sin(a) * r).toFixed(1)}`
  }
  const rMid = (rIn + rOut) / 2
  const lead = 40
  const tip = 24
  const root = 30
  const blades: string[] = []
  for (let i = 0; i < count; i++) {
    const a0 = offsetDeg + (i * 360) / count
    const d = [
      `M ${pt(rIn, a0)}`,
      `Q ${pt(rMid, a0 + lead * 0.62)} ${pt(rOut, a0 + lead)}`,
      `A ${rOut} ${rOut} 0 0 1 ${pt(rOut, a0 + lead + tip)}`,
      `Q ${pt(rMid + 18, a0 + lead * 0.62 + root * 0.55)} ${pt(rIn, a0 + root)}`,
      `A ${rIn} ${rIn} 0 0 0 ${pt(rIn, a0)}`,
      'Z',
    ].join(' ')
    blades.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`)
    blades.push(
      `<path d="M ${pt(rIn + 16, a0 + 4)} Q ${pt(rMid, a0 + lead * 0.62 + 2)} ${pt(rOut - 14, a0 + lead - 2)}" stroke="#ffffff" stroke-width="7" fill="none" opacity="0.26" stroke-linecap="round"/>`
    )
  }
  return blades.join('')
}

/* -------------------------------------------------------------------------- */
/* AHU — long double-skin panelled cabinet on a plinth base                   */
/* -------------------------------------------------------------------------- */

export const ahu: ShapeRenderer = (ctx) => {
  const x = 250
  const w = 1060
  const y = 340
  const h = 470
  const dx = 66
  const dy = -44
  const [, fHi, , fLow, fDark] = tones(ctx.finish)
  const [, aHi, aMid, , aDark] = tones(ctx.accent)
  const baseY = y + h
  const baseH = 54
  const collarLen = 78 + ctx.rng(-8, 8)
  const portR = 58 + ctx.rng(0, 6)

  ctx.add(groundShadow(ctx, cx + 20, 894, 620, 60))

  // Plinth base channel, with its shaded depth face and forklift slots.
  ctx.add(
    `<polygon points="${x + w},${baseY} ${x + w + dx},${baseY + dy} ${x + w + dx},${baseY + baseH + dy} ${x + w},${baseY + baseH}" fill="#31353b" stroke="#1c1f23" stroke-width="2"/>`
  )
  ctx.add(
    `<rect x="${x - 8}" y="${baseY}" width="${w + 16}" height="${baseH}" rx="6" fill="${metal(ctx, 'plasticBlack', 'v')}" stroke="#14171a" stroke-width="2.5"/>`
  )
  ctx.add(`<rect x="${x + 130}" y="${baseY + 18}" width="124" height="${baseH - 30}" rx="5" fill="#0c0e10"/>`)
  ctx.add(`<rect x="${x + w - 254}" y="${baseY + 18}" width="124" height="${baseH - 30}" rx="5" fill="#0c0e10"/>`)

  // Supply-duct collar on the left wall, flanged at the outer end.
  const collarX = x - collarLen
  ctx.add(
    `<rect x="${collarX}" y="${y + 88}" width="${collarLen + 12}" height="192" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="2.5"/>`
  )
  ctx.add(
    `<rect x="${collarX - 12}" y="${y + 76}" width="20" height="216" rx="6" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="2.5"/>`
  )
  ctx.add(rivet(collarX - 2, y + 96, 4.5))
  ctx.add(rivet(collarX - 2, y + 272, 4.5))

  // Cabinet shell.
  ctx.add(cabinet(ctx, x, y, w, h, dx, dy, ctx.finish))

  // Frame relief line inset on the front face.
  ctx.add(
    `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" fill="none" stroke="${fLow}" stroke-width="2" opacity="0.55"/>`
  )

  // Brand stripe along the top of the front face, wrapping onto the side face.
  ctx.add(`<rect x="${x + 4}" y="${y + 22}" width="${w - 8}" height="24" fill="${aMid}"/>`)
  ctx.add(`<rect x="${x + 4}" y="${y + 22}" width="${w - 8}" height="8" fill="${aHi}" opacity="0.6"/>`)
  ctx.add(
    `<polygon points="${x + w},${y + 22} ${x + w + dx - 2},${y + 24 + dy} ${x + w + dx - 2},${y + 48 + dy} ${x + w},${y + 46}" fill="${aDark}" opacity="0.9"/>`
  )

  // Section seams (filter | coil | fan), echoed on the top face.
  const s1 = x + w * 0.36
  const s2 = x + w * 0.68
  for (const sx of [s1, s2]) {
    ctx.add(`<line x1="${sx}" y1="${y + 6}" x2="${sx}" y2="${y + h - 6}" stroke="${fDark}" stroke-width="3" opacity="0.6"/>`)
    ctx.add(`<line x1="${sx + 3}" y1="${y + 6}" x2="${sx + 3}" y2="${y + h - 6}" stroke="${fHi}" stroke-width="1.6" opacity="0.7"/>`)
    ctx.add(`<line x1="${sx}" y1="${y}" x2="${sx + dx}" y2="${y + dy}" stroke="${fDark}" stroke-width="2" opacity="0.4"/>`)
  }

  // Fastener rows along the top and bottom frame rails.
  for (let rx = x + 60; rx < x + w - 30; rx += 140) {
    ctx.add(rivet(rx, y + 15, 4.5))
    ctx.add(rivet(rx, y + h - 15, 4.5))
  }

  // Left section: control pod + fresh-air louvre.
  ctx.add(
    `<rect x="${x + 46}" y="${y + 66}" width="138" height="58" rx="8" fill="${sheet(ctx, 'plasticGray')}" stroke="#33373d" stroke-width="2.5"/>`
  )
  ctx.add(`<rect x="${x + 56}" y="${y + 78}" width="76" height="34" rx="4" fill="#161a1f"/>`)
  ctx.add(`<rect x="${x + 60}" y="${y + 82}" width="68" height="10" rx="3" fill="#3d5a75" opacity="0.9"/>`)
  ctx.add(`<rect x="${x + 142}" y="${y + 80}" width="12" height="12" rx="3" fill="#3fae5c"/>`)
  ctx.add(`<rect x="${x + 160}" y="${y + 80}" width="12" height="12" rx="3" fill="#e8a020"/>`)

  const gx = x + 44
  const gy = y + 158
  const gw = s1 - x - 88
  const gh = 252
  ctx.add(
    `<rect x="${gx - 9}" y="${gy - 9}" width="${gw + 18}" height="${gh + 18}" rx="9" fill="${metal(ctx, 'aluminium', 'v')}" stroke="#565c66" stroke-width="2.5"/>`
  )
  ctx.add(`<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="#22262b"/>`)
  for (let ly = gy + 12; ly < gy + gh - 10; ly += 20) {
    ctx.add(`<rect x="${gx + 4}" y="${ly}" width="${gw - 8}" height="7" rx="3.5" fill="#aeb6bf"/>`)
    ctx.add(`<rect x="${gx + 4}" y="${ly + 5.5}" width="${gw - 8}" height="2.5" fill="#111417" opacity="0.8"/>`)
  }

  // Middle section: hinged access door with two bar handles.
  const doorPad = 28
  const d1x = s1 + doorPad
  const d1w = s2 - s1 - doorPad * 2
  const dTop = y + 78
  const dBot = y + h - 38
  ctx.add(
    `<rect x="${d1x}" y="${dTop}" width="${d1w}" height="${dBot - dTop}" rx="10" fill="${sheet(ctx, ctx.finish)}" stroke="${fDark}" stroke-width="2.5"/>`
  )
  ctx.add(`<rect x="${d1x}" y="${dTop}" width="${d1w}" height="12" fill="#000000" opacity="0.10"/>`)
  ctx.add(`<line x1="${d1x + 4}" y1="${dBot - 3}" x2="${d1x + d1w - 4}" y2="${dBot - 3}" stroke="#ffffff" stroke-width="2" opacity="0.45"/>`)
  ctx.add(`<rect x="${d1x - 7}" y="${dTop + 40}" width="13" height="54" rx="4" fill="#2a2e34"/>`)
  ctx.add(`<rect x="${d1x - 7}" y="${dBot - 94}" width="13" height="54" rx="4" fill="#2a2e34"/>`)
  ctx.add(doorHandle(d1x + d1w - 40, dTop + 64))
  ctx.add(doorHandle(d1x + d1w - 40, dBot - 138))

  // Right section: fan access door with inspection porthole.
  const d2x = s2 + doorPad
  const d2w = x + w - s2 - doorPad * 2
  ctx.add(
    `<rect x="${d2x}" y="${dTop}" width="${d2w}" height="${dBot - dTop}" rx="10" fill="${sheet(ctx, ctx.finish)}" stroke="${fDark}" stroke-width="2.5"/>`
  )
  ctx.add(`<rect x="${d2x}" y="${dTop}" width="${d2w}" height="12" fill="#000000" opacity="0.10"/>`)
  ctx.add(`<rect x="${d2x + d2w - 6}" y="${dTop + 40}" width="13" height="54" rx="4" fill="#2a2e34"/>`)
  ctx.add(`<rect x="${d2x + d2w - 6}" y="${dBot - 94}" width="13" height="54" rx="4" fill="#2a2e34"/>`)
  ctx.add(doorHandle(d2x + 34, dTop + 64))
  ctx.add(doorHandle(d2x + 34, dBot - 138))
  ctx.add(porthole(ctx, d2x + d2w * 0.58, (dTop + dBot) / 2, portR))

  // Soft sheen sweeping the front face.
  ctx.add(specular(x + 30, y + 56, w * 0.52, 12, 0.18))
}

/* -------------------------------------------------------------------------- */
/* FCU — shallow ceiling-hung chassis with coil tails and duct collar         */
/* -------------------------------------------------------------------------- */

export const fcu: ShapeRenderer = (ctx) => {
  const x = 290
  const w = 1000
  const y = 468
  const h = 330
  const dx = 62
  const dy = -42
  const [, fHi, , , fDark] = tones(ctx.finish)
  const [, aHi, aMid, , aDark] = tones(ctx.accent)
  const pipeLen = 86 + ctx.rng(-8, 10)

  ctx.add(groundShadow(ctx, cx + 10, 882, 600, 56))

  // Hanger straps rising behind the top face.
  for (const hx of [x + 96, x + w - 128]) {
    const sxc = hx + dx / 2
    ctx.add(
      `<rect x="${sxc}" y="${y + dy / 2 - 86}" width="30" height="100" rx="6" fill="${metal(ctx, 'galvanized', 'h')}" stroke="#4d545c" stroke-width="2"/>`
    )
    ctx.add(slot(sxc + 7, y + dy / 2 - 68, 16, 36))
  }

  // Discharge duct collar out of the right wall, flanged.
  const collarY = y + h / 2 + dy / 2
  ctx.add(
    `<rect x="${x + w + 24}" y="${collarY - 94}" width="106" height="188" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="2.5"/>`
  )
  ctx.add(
    `<rect x="${x + w + 124}" y="${collarY - 106}" width="18" height="212" rx="5" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="2.5"/>`
  )

  // Chilled-water coil tails on the left wall: copper with brass flare nuts.
  const pxe = x - pipeLen
  const tails: Array<[number, number]> = [
    [y + h - 106, 30],
    [y + h - 58, 24],
  ]
  for (const [py, dia] of tails) {
    ctx.add(
      `<rect x="${pxe}" y="${py - dia / 2}" width="${pipeLen + 16}" height="${dia}" rx="${dia / 2 - 3}" fill="${metal(ctx, 'copper', 'v')}" stroke="#5e3018" stroke-width="2"/>`
    )
    ctx.add(
      `<rect x="${pxe - 5}" y="${py - dia / 2 - 5}" width="24" height="${dia + 10}" rx="6" fill="${metal(ctx, 'brass', 'v')}" stroke="#6b5316" stroke-width="2"/>`
    )
    ctx.add(specular(pxe + 22, py - dia / 2 + 4, pipeLen - 26, 6, 0.35))
  }

  // Chassis body.
  ctx.add(cabinet(ctx, x, y, w, h, dx, dy, ctx.finish))

  // Condensate drain pan lip under the body, with a PVC drain stub.
  ctx.add(
    `<rect x="${x - 10}" y="${y + h}" width="${w + 20}" height="26" rx="9" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="2.5"/>`
  )
  ctx.add(`<rect x="${x - 6}" y="${y + h + 3}" width="${w + 12}" height="6" rx="3" fill="#ffffff" opacity="0.28"/>`)
  ctx.add(
    `<rect x="${x - 62}" y="${y + h + 4}" width="66" height="19" rx="9" fill="${metal(ctx, 'plasticWhite', 'v')}" stroke="#82888e" stroke-width="2"/>`
  )

  // Frame relief + stiffening beads across the front.
  ctx.add(
    `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" fill="none" stroke="${fHi}" stroke-width="1.6" opacity="0.5"/>`
  )
  for (const by of [y + h * 0.32, y + h * 0.64]) {
    ctx.add(`<line x1="${x + 16}" y1="${by.toFixed(1)}" x2="${x + w - 16}" y2="${by.toFixed(1)}" stroke="${fHi}" stroke-width="2" opacity="0.65"/>`)
    ctx.add(`<line x1="${x + 16}" y1="${(by + 2.6).toFixed(1)}" x2="${x + w - 16}" y2="${(by + 2.6).toFixed(1)}" stroke="${fDark}" stroke-width="1.6" opacity="0.5"/>`)
  }

  // Panel seam and bolted access panel on the right section.
  const s = x + w * 0.6
  ctx.add(`<line x1="${s}" y1="${y + 8}" x2="${s}" y2="${y + h - 8}" stroke="${fDark}" stroke-width="3" opacity="0.6"/>`)
  ctx.add(`<line x1="${s + 3}" y1="${y + 8}" x2="${s + 3}" y2="${y + h - 8}" stroke="${fHi}" stroke-width="1.6" opacity="0.7"/>`)
  const apx = s + 26
  const apw = x + w - s - 52
  ctx.add(
    `<rect x="${apx}" y="${y + 30}" width="${apw}" height="${h - 60}" rx="8" fill="none" stroke="${fDark}" stroke-width="2" opacity="0.55"/>`
  )
  ctx.add(rivet(apx + 12, y + 42))
  ctx.add(rivet(apx + apw - 12, y + 42))
  ctx.add(rivet(apx + 12, y + h - 42))
  ctx.add(rivet(apx + apw - 12, y + h - 42))

  // Electrical junction box on the access panel, gland on its underside.
  const jx = apx + apw / 2 - 78
  const jy = y + h * 0.3
  ctx.add(
    `<rect x="${jx}" y="${jy}" width="156" height="104" rx="9" fill="${sheet(ctx, 'plasticGray')}" stroke="#33373d" stroke-width="2.5"/>`
  )
  ctx.add(`<line x1="${jx + 8}" y1="${jy + 30}" x2="${jx + 148}" y2="${jy + 30}" stroke="#33373d" stroke-width="1.8" opacity="0.6"/>`)
  ctx.add(rivet(jx + 12, jy + 12, 4))
  ctx.add(rivet(jx + 144, jy + 12, 4))
  ctx.add(rivet(jx + 12, jy + 92, 4))
  ctx.add(rivet(jx + 144, jy + 92, 4))
  ctx.add(`<circle cx="${jx + 42}" cy="${jy + 104}" r="10" fill="#16191d" stroke="#4a5058" stroke-width="2"/>`)

  // Brand badge on the left section.
  ctx.add(`<rect x="${x + 36}" y="${y + 28}" width="128" height="36" rx="6" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>`)
  ctx.add(`<rect x="${x + 44}" y="${y + 38}" width="82" height="7" rx="3.5" fill="${aHi}" opacity="0.85"/>`)
  ctx.add(`<rect x="${x + 44}" y="${y + 50}" width="56" height="5" rx="2.5" fill="${aHi}" opacity="0.55"/>`)

  // Corner fasteners and top sheen.
  ctx.add(rivet(x + 18, y + 18))
  ctx.add(rivet(x + w - 18, y + 18))
  ctx.add(rivet(x + 18, y + h - 18))
  ctx.add(rivet(x + w - 18, y + h - 18))
  ctx.add(specular(x + 24, y + 14, w * 0.58, 11, 0.22))
}

/* -------------------------------------------------------------------------- */
/* FAN — plate-mounted axial fan, face on                                     */
/* -------------------------------------------------------------------------- */

export const fan: ShapeRenderer = (ctx) => {
  const fx = cx
  const fy = 533
  const half = 372
  const ringOuter = 336
  const ringInner = 306
  const hubR = 118
  const rot = ctx.rng(0, 51)
  const [, , , , fDark] = tones(ctx.finish)
  const [, aHi, , , aDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, fx, 916, 480, 46))

  // Square mounting plate with corner holes and pressing creases.
  ctx.add(
    `<rect x="${fx - half}" y="${fy - half}" width="${half * 2}" height="${half * 2}" rx="46" fill="${sheet(ctx, ctx.finish)}" stroke="${fDark}" stroke-width="3"/>`
  )
  const holeFill = ctx.def(
    'fan-hole',
    `<radialGradient id="fan-hole" cx="0.4" cy="0.35" r="0.95">
      <stop offset="0" stop-color="#3c434b"/>
      <stop offset="1" stop-color="#0e1114"/>
    </radialGradient>`
  )
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]
  for (const [sx, sy] of corners) {
    ctx.add(
      `<line x1="${fx + sx * (half - 60)}" y1="${fy + sy * (half - 60)}" x2="${fx + sx * ringOuter * 0.73}" y2="${fy + sy * ringOuter * 0.73}" stroke="${fDark}" stroke-width="2.5" opacity="0.18"/>`
    )
    ctx.add(
      `<circle cx="${fx + sx * (half - 58)}" cy="${fy + sy * (half - 58)}" r="17" fill="${holeFill}" stroke="#565c66" stroke-width="2"/>`
    )
  }

  // Cavity behind the impeller.
  const cav = ctx.def(
    'fan-cavity',
    `<radialGradient id="fan-cavity" cx="0.42" cy="0.38" r="0.95">
      <stop offset="0" stop-color="#484f58"/>
      <stop offset="0.55" stop-color="#2a3037"/>
      <stop offset="1" stop-color="#101317"/>
    </radialGradient>`
  )
  ctx.add(`<circle cx="${fx}" cy="${fy}" r="${ringInner}" fill="${cav}"/>`)

  // Motor support struts and the cable conduit along one of them.
  for (const deg of [45, 135, 225, 315]) {
    const a = ((deg - 90) * Math.PI) / 180
    ctx.add(
      `<line x1="${fx}" y1="${fy}" x2="${(fx + Math.cos(a) * (ringInner - 6)).toFixed(1)}" y2="${(fy + Math.sin(a) * (ringInner - 6)).toFixed(1)}" stroke="#22262b" stroke-width="17" opacity="0.92" stroke-linecap="round"/>`
    )
  }

  // Venturi ring over the cavity edge, riveted.
  ctx.add(
    `<circle cx="${fx}" cy="${fy}" r="${(ringOuter + ringInner) / 2}" fill="none" stroke="${metal(ctx, ctx.finish, 'v')}" stroke-width="${ringOuter - ringInner}"/>`
  )
  ctx.add(`<circle cx="${fx}" cy="${fy}" r="${ringOuter}" fill="none" stroke="${fDark}" stroke-width="2.5" opacity="0.8"/>`)
  ctx.add(`<circle cx="${fx}" cy="${fy}" r="${ringInner}" fill="none" stroke="#14181d" stroke-width="3" opacity="0.85"/>`)
  for (let i = 0; i < 8; i++) {
    const a = ((i * 45 - 67.5) * Math.PI) / 180
    ctx.add(rivet(fx + Math.cos(a) * ((ringOuter + ringInner) / 2), fy + Math.sin(a) * ((ringOuter + ringInner) / 2), 5))
  }

  // Conduit from the hub to the terminal box, strapped across the ring.
  const ca = ((137 - 90) * Math.PI) / 180
  ctx.add(
    `<line x1="${(fx + Math.cos(ca) * 92).toFixed(1)}" y1="${(fy + Math.sin(ca) * 92).toFixed(1)}" x2="${(fx + 278).toFixed(1)}" y2="${(fy + 292).toFixed(1)}" stroke="#191d21" stroke-width="10" stroke-linecap="round"/>`
  )

  // Impeller.
  ctx.add(fanBlades(ctx, fx, fy, 96, 288, 7, rot, metal(ctx, ctx.finish, 'v'), fDark))

  // Motor hub: dome, bolt circle, nameplate, centre cap.
  ctx.add(`<circle cx="${fx}" cy="${fy}" r="${hubR}" fill="${metalRadial(ctx, ctx.accent)}" stroke="${aDark}" stroke-width="3"/>`)
  ctx.add(`<circle cx="${fx - 40}" cy="${fy - 46}" r="30" fill="#ffffff" opacity="0.22"/>`)
  for (const deg of [45, 135, 225, 315]) {
    const a = ((deg - 90) * Math.PI) / 180
    ctx.add(hexBolt(ctx, fx + Math.cos(a) * 82, fy + Math.sin(a) * 82, 11))
  }
  ctx.add(`<rect x="${fx - 52}" y="${fy + 20}" width="104" height="30" rx="6" fill="${aHi}" stroke="${aDark}" stroke-width="2"/>`)
  ctx.add(`<rect x="${fx - 40}" y="${fy + 28}" width="66" height="5" rx="2.5" fill="${aDark}" opacity="0.7"/>`)
  ctx.add(`<rect x="${fx - 40}" y="${fy + 38}" width="44" height="4" rx="2" fill="${aDark}" opacity="0.5"/>`)
  ctx.add(`<circle cx="${fx}" cy="${fy - 24}" r="30" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2.5"/>`)
  ctx.add(`<circle cx="${fx - 9}" cy="${fy - 33}" r="8" fill="#ffffff" opacity="0.5"/>`)

  // Terminal box on the plate, lower right, where the conduit lands.
  ctx.add(
    `<rect x="${fx + 232}" y="${fy + 282}" width="104" height="76" rx="10" fill="${sheet(ctx, 'plasticGray')}" stroke="#33373d" stroke-width="2.5"/>`
  )
  ctx.add(`<line x1="${fx + 240}" y1="${fy + 304}" x2="${fx + 328}" y2="${fy + 304}" stroke="#33373d" stroke-width="1.6" opacity="0.6"/>`)
  ctx.add(rivet(fx + 244, fy + 294, 4))
  ctx.add(rivet(fx + 324, fy + 294, 4))
  ctx.add(rivet(fx + 244, fy + 346, 4))
  ctx.add(rivet(fx + 324, fy + 346, 4))
}

/* -------------------------------------------------------------------------- */
/* FILTER — pleated panel filter in a riveted frame                           */
/* -------------------------------------------------------------------------- */

export const filter: ShapeRenderer = (ctx) => {
  const w = 740
  const h = 560
  const x = 380
  const y = 322
  const dx = 78
  const dy = -50
  const frame = 46
  const tilt = ctx.rng(-1.2, 1.2)
  const pleats = 12 + Math.round(ctx.rng(0, 2))
  const [, fHi, , fLow, fDark] = tones(ctx.finish)
  const [, aHi, aMid, , aDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, x + (w + dx) / 2, 896, 470, 52))

  const pleatFill = ctx.def(
    'filter-pleat',
    `<linearGradient id="filter-pleat" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#b6b1a0"/>
      <stop offset="0.42" stop-color="#faf8f0"/>
      <stop offset="0.58" stop-color="#efece1"/>
      <stop offset="1" stop-color="#a9a493"/>
    </linearGradient>`
  )
  const mediaShade = ctx.def(
    'filter-shade',
    `<linearGradient id="filter-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/>
      <stop offset="0.25" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="0.72" stop-color="#3a382f" stop-opacity="0"/>
      <stop offset="1" stop-color="#3a382f" stop-opacity="0.32"/>
    </linearGradient>`
  )

  const parts: string[] = []
  parts.push(cabinet(ctx, x, y, w, h, dx, dy, ctx.finish))

  // Top-face centre seam.
  parts.push(
    `<line x1="${x + w * 0.5}" y1="${y}" x2="${x + w * 0.5 + dx}" y2="${y + dy}" stroke="${fDark}" stroke-width="2" opacity="0.4"/>`
  )

  // Media cavity with a deep lip shadow, then the pleat pack.
  const ix = x + frame
  const iy = y + frame
  const iw = w - frame * 2
  const ih = h - frame * 2
  parts.push(`<rect x="${ix - 7}" y="${iy - 7}" width="${iw + 14}" height="${ih + 14}" fill="#1e2126"/>`)
  const pw = iw / pleats
  for (let i = 0; i < pleats; i++) {
    parts.push(`<rect x="${(ix + i * pw).toFixed(2)}" y="${iy}" width="${pw.toFixed(2)}" height="${ih}" fill="${pleatFill}"/>`)
  }
  for (let i = 1; i < pleats; i++) {
    const lx = (ix + i * pw).toFixed(2)
    parts.push(`<line x1="${lx}" y1="${iy}" x2="${lx}" y2="${iy + ih}" stroke="#8f8a79" stroke-width="1.6" opacity="0.65"/>`)
  }

  // Wire media retainer: horizontal wires over the pleats.
  for (let wy = iy + 58; wy < iy + ih - 20; wy += 62) {
    parts.push(`<line x1="${ix}" y1="${wy}" x2="${ix + iw}" y2="${wy}" stroke="#767b83" stroke-width="2.2" opacity="0.4"/>`)
    parts.push(`<line x1="${ix}" y1="${wy + 2.2}" x2="${ix + iw}" y2="${wy + 2.2}" stroke="#ffffff" stroke-width="1" opacity="0.25"/>`)
  }

  // Light falling across the media, then the frame lip over the media edge.
  parts.push(`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" fill="${mediaShade}"/>`)
  parts.push(
    `<rect x="${ix - 4}" y="${iy - 4}" width="${iw + 8}" height="${ih + 8}" fill="none" stroke="${fDark}" stroke-width="3.5"/>`
  )
  parts.push(
    `<rect x="${ix - 9}" y="${iy - 9}" width="${iw + 18}" height="${ih + 18}" fill="none" stroke="${fHi}" stroke-width="1.6" opacity="0.6"/>`
  )

  // Frame face details: rivets, brand label, top-rail sheen.
  parts.push(rivet(x + 22, y + 22))
  parts.push(rivet(x + w - 22, y + 22))
  parts.push(rivet(x + 22, y + h - 22))
  parts.push(rivet(x + w - 22, y + h - 22))
  parts.push(rivet(x + w / 2, y + 22, 4.5))
  parts.push(rivet(x + w / 2, y + h - 22, 4.5))
  parts.push(`<rect x="${x + 42}" y="${y + h - frame + 7}" width="150" height="30" rx="5" fill="${aMid}" stroke="${aDark}" stroke-width="2"/>`)
  parts.push(`<rect x="${x + 52}" y="${y + h - frame + 15}" width="96" height="6" rx="3" fill="${aHi}" opacity="0.85"/>`)
  parts.push(`<rect x="${x + 52}" y="${y + h - frame + 25}" width="64" height="4.5" rx="2.2" fill="${aHi}" opacity="0.55"/>`)
  parts.push(specular(x + 16, y + 9, w * 0.5, 10, 0.26))

  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} ${x + w / 2} ${y + h / 2})">${parts.join('')}</g>`)
  void fLow
}

/* -------------------------------------------------------------------------- */
/* COMPRESSOR — semi-hermetic reciprocating compressor, side elevation        */
/* -------------------------------------------------------------------------- */

export const compressor: ShapeRenderer = (ctx) => {
  const axis = 635
  const bodyTop = 470
  const bodyBot = 800
  const bx = 330
  const bw = 840 + ctx.rng(-12, 12)
  const [, fHi, , fLow, fDark] = tones(ctx.finish)
  const [, aHi, aMid, , aDark] = tones(ctx.accent)
  const wheelTilt = ctx.rng(-14, 14)

  ctx.add(groundShadow(ctx, 785, 890, 560, 58))

  // Cast mounting feet (behind the body).
  for (const footX of [390, 930]) {
    ctx.add(
      `<polygon points="${footX + 14},${bodyBot - 20} ${footX + 166},${bodyBot - 20} ${footX + 180},${bodyBot + 48} ${footX},${bodyBot + 48}" fill="${metal(ctx, 'castIron', 'v')}" stroke="#26292e" stroke-width="2.5"/>`
    )
    ctx.add(
      `<rect x="${footX - 14}" y="${bodyBot + 44}" width="208" height="22" rx="6" fill="${metal(ctx, 'castIron', 'v')}" stroke="#1e2124" stroke-width="2.5"/>`
    )
    ctx.add(`<circle cx="${footX + 12}" cy="${bodyBot + 55}" r="6.5" fill="#101214" stroke="#4a5057" stroke-width="1.5"/>`)
    ctx.add(`<circle cx="${footX + 168}" cy="${bodyBot + 55}" r="6.5" fill="#101214" stroke="#4a5057" stroke-width="1.5"/>`)
  }

  // Suction service valve on top of the motor barrel (behind the barrel edge).
  ctx.add(`<rect x="${710}" y="${bodyTop - 52}" width="44" height="70" rx="8" fill="${metal(ctx, 'steel', 'h')}" stroke="#2d3238" stroke-width="2"/>`)
  ctx.add(`<rect x="${698}" y="${bodyTop - 64}" width="68" height="26" rx="7" fill="${metal(ctx, 'brass', 'v')}" stroke="#6b5316" stroke-width="2"/>`)

  // Motor barrel.
  ctx.add(
    `<rect x="${bx}" y="${bodyTop}" width="${bw}" height="${bodyBot - bodyTop}" rx="64" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="3"/>`
  )

  // Bolted motor end cover, left.
  ctx.add(
    `<rect x="${bx - 26}" y="${bodyTop - 14}" width="88" height="${bodyBot - bodyTop + 28}" rx="30" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="3"/>`
  )
  ctx.add(hexBolt(ctx, bx + 18, bodyTop + 42, 15))
  ctx.add(hexBolt(ctx, bx + 18, axis, 15))
  ctx.add(hexBolt(ctx, bx + 18, bodyBot - 42, 15))
  ctx.add(specular(bx - 16, bodyTop - 2, 24, bodyBot - bodyTop + 4, 0.14, 12))

  // Casting seam bands around the barrel.
  for (const sx of [560, 640]) {
    ctx.add(`<line x1="${sx}" y1="${bodyTop + 8}" x2="${sx}" y2="${bodyBot - 8}" stroke="${fDark}" stroke-width="2.5" opacity="0.45"/>`)
    ctx.add(`<line x1="${sx + 3}" y1="${bodyTop + 8}" x2="${sx + 3}" y2="${bodyBot - 8}" stroke="${fHi}" stroke-width="1.4" opacity="0.5"/>`)
  }

  // Nameplate on the motor barrel.
  ctx.add(`<rect x="${430}" y="${axis - 40}" width="180" height="86" rx="8" fill="${aMid}" stroke="${aDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${444}" y="${axis - 24}" width="118" height="8" rx="4" fill="${aHi}" opacity="0.85"/>`)
  ctx.add(`<rect x="${444}" y="${axis - 8}" width="150" height="6" rx="3" fill="${aHi}" opacity="0.6"/>`)
  ctx.add(`<rect x="${444}" y="${axis + 6}" width="150" height="6" rx="3" fill="${aHi}" opacity="0.6"/>`)
  ctx.add(`<rect x="${444}" y="${axis + 20}" width="96" height="6" rx="3" fill="${aHi}" opacity="0.6"/>`)
  ctx.add(rivet(442, axis - 28, 4))
  ctx.add(rivet(598, axis - 28, 4))
  ctx.add(rivet(442, axis + 34, 4))
  ctx.add(rivet(598, axis + 34, 4))

  // Terminal box on top of the motor end.
  ctx.add(
    `<rect x="${418}" y="${bodyTop - 96}" width="192" height="112" rx="12" fill="${sheet(ctx, 'plasticGray')}" stroke="#33373d" stroke-width="2.5"/>`
  )
  ctx.add(`<line x1="${428}" y1="${bodyTop - 64}" x2="${600}" y2="${bodyTop - 64}" stroke="#33373d" stroke-width="1.8" opacity="0.6"/>`)
  ctx.add(rivet(432, bodyTop - 82, 4.5))
  ctx.add(rivet(596, bodyTop - 82, 4.5))
  ctx.add(rivet(432, bodyTop - 4, 4.5))
  ctx.add(rivet(596, bodyTop - 4, 4.5))
  ctx.add(
    `<rect x="${388}" y="${bodyTop - 62}" width="32" height="30" rx="8" fill="${metal(ctx, 'plasticBlack', 'v')}" stroke="#101317" stroke-width="2"/>`
  )

  // Crankcase block, slightly taller, in front of the right half.
  ctx.add(
    `<rect x="${890}" y="${bodyTop - 16}" width="350" height="${bodyBot - bodyTop + 26}" rx="26" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="3"/>`
  )
  ctx.add(ribs(906, bodyTop + 44, 318, bodyBot - bodyTop - 96, 7, fDark, 0.22, 3))
  ctx.add(hexBolt(ctx, 916, bodyBot - 34, 13))
  ctx.add(hexBolt(ctx, 1214, bodyBot - 34, 13))

  // Finned cylinder head on top of the crankcase.
  ctx.add(
    `<rect x="${916}" y="${bodyTop - 100}" width="298" height="96" rx="16" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${fDark}" stroke-width="3"/>`
  )
  ctx.add(ribs(928, bodyTop - 92, 274, 80, 11, fDark, 0.45, 3.5))
  ctx.add(hexBolt(ctx, 936, bodyTop - 16, 12))
  ctx.add(hexBolt(ctx, 1065, bodyTop - 16, 12))
  ctx.add(hexBolt(ctx, 1194, bodyTop - 16, 12))
  ctx.add(specular(928, bodyTop - 94, 270, 10, 0.28))

  // Discharge service valve on the head, with a small handwheel.
  ctx.add(`<rect x="${1042}" y="${bodyTop - 158}" width="42" height="62" rx="9" fill="${metal(ctx, 'steel', 'h')}" stroke="#2d3238" stroke-width="2"/>`)
  ctx.add(`<rect x="${1030}" y="${bodyTop - 150}" width="66" height="24" rx="7" fill="${metal(ctx, 'brass', 'v')}" stroke="#6b5316" stroke-width="2"/>`)
  ctx.add(
    `<g transform="rotate(${wheelTilt.toFixed(1)} ${1063} ${bodyTop - 168})">${handwheel(ctx, 1063, bodyTop - 168, 34, 'steel')}</g>`
  )

  // Oil sight glass low on the crankcase: brass bezel, amber glass.
  const oil = ctx.def(
    'comp-oil',
    `<radialGradient id="comp-oil" cx="0.38" cy="0.32" r="0.95">
      <stop offset="0" stop-color="#f2ca74"/>
      <stop offset="0.6" stop-color="#c98f2e"/>
      <stop offset="1" stop-color="#6e4610"/>
    </radialGradient>`
  )
  ctx.add(`<circle cx="${1108}" cy="${bodyBot - 88}" r="34" fill="${metalRadial(ctx, 'brass')}" stroke="#6b5316" stroke-width="2.5"/>`)
  ctx.add(`<circle cx="${1108}" cy="${bodyBot - 88}" r="22" fill="${oil}" stroke="#3f2a08" stroke-width="2"/>`)
  ctx.add(`<circle cx="${1100}" cy="${bodyBot - 96}" r="6" fill="#ffffff" opacity="0.55"/>`)

  // Barrel highlight last.
  ctx.add(specular(bx + 50, bodyTop + 22, bw - 240, 26, 0.26))
  void fLow
}
