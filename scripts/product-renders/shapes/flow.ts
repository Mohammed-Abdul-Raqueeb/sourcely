/**
 * Pump and piping renders: pump, pump-submersible, pump-dosing, booster-set,
 * pipe, insulation, clamp.
 *
 * Follow the `ballValve` reference in ./valves.ts for conventions:
 * paint back-to-front (shadow → far parts → body → highlights), body material
 * from ctx.finish, trims from ctx.accent, pose life via ctx.rng only.
 */

import { CANVAS, type FinishId, type RenderContext, type ShapeRenderer } from '../types'
import {
  flange,
  groundShadow,
  hexBolt,
  metal,
  metalRadial,
  ribs,
  specular,
  tones,
} from '../style'

const { cx } = CANVAS

/* -------------------------------------------------------------------------- */
/* Local helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Circular arc path (angles in degrees, SVG y-down, 0° = 3 o'clock). */
function arcPath(cxp: number, cyp: number, r: number, a0: number, a1: number): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const x0 = cxp + Math.cos(rad(a0)) * r
  const y0 = cyp + Math.sin(rad(a0)) * r
  const x1 = cxp + Math.cos(rad(a1)) * r
  const y1 = cyp + Math.sin(rad(a1)) * r
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}`
}

/** Side-view hex nut / bolt head: a small block with three visible facets. */
function hexSide(ctx: RenderContext, x: number, y: number, w: number, h: number, finish: FinishId = 'steel'): string {
  const fill = metal(ctx, finish, 'v')
  const [, hi, , , dark] = tones(finish)
  const f = h / 3
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.14}" fill="${fill}" stroke="${dark}" stroke-width="2"/>
    <line x1="${x}" y1="${y + f}" x2="${x + w}" y2="${y + f}" stroke="${dark}" stroke-width="1.4" opacity="0.55"/>
    <line x1="${x}" y1="${y + f * 2}" x2="${x + w}" y2="${y + f * 2}" stroke="${dark}" stroke-width="1.4" opacity="0.55"/>
    <rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${f * 0.7}" rx="${f * 0.3}" fill="${hi}" opacity="0.35"/>
  </g>`
}

/** Threaded rod segment (vertical), ridges as horizontal lines. */
function threadedRodV(ctx: RenderContext, x: number, y0: number, y1: number, w: number): string {
  const fill = metal(ctx, 'steel', 'h')
  const ridges: string[] = []
  const step = 9
  for (let y = y0 + step; y < y1 - 3; y += step) {
    ridges.push(`<line x1="${x + 1.5}" y1="${y}" x2="${x + w - 1.5}" y2="${y}" stroke="#3a4048" stroke-width="2" opacity="0.6"/>`)
  }
  return `<g>
    <rect x="${x}" y="${y0}" width="${w}" height="${y1 - y0}" rx="${w * 0.22}" fill="${fill}" stroke="#33383f" stroke-width="1.5"/>
    ${ridges.join('')}
  </g>`
}

/** Open pipe end facing the viewer: cut face ring + dark bore. */
function pipeBore(
  ctx: RenderContext,
  x: number,
  cy: number,
  rx: number,
  ry: number,
  finish: FinishId,
  wall: number
): string {
  const [edge, hi, mid, , dark] = tones(finish)
  const boreFill = ctx.def(
    'flow-bore',
    `<radialGradient id="flow-bore" cx="0.42" cy="0.4" r="0.9">
      <stop offset="0" stop-color="#3a3f45"/>
      <stop offset="0.55" stop-color="#1b1e22"/>
      <stop offset="1" stop-color="#0a0b0d"/>
    </radialGradient>`
  )
  return `<g>
    <ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${mid}" stroke="${edge}" stroke-width="2.5"/>
    <ellipse cx="${x}" cy="${cy}" rx="${rx - wall}" ry="${ry - wall}" fill="${boreFill}" stroke="${dark}" stroke-width="1.5"/>
    <ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${hi}" stroke-width="1.6" opacity="0.5"/>
  </g>`
}

/* -------------------------------------------------------------------------- */
/* pump — end-suction centrifugal pump with motor on a baseplate              */
/* -------------------------------------------------------------------------- */

export const pump: ShapeRenderer = (ctx) => {
  const axis = 620
  const volCx = 455
  const volR = 192 + ctx.rng(-5, 5)
  const motorX0 = 640
  const motorX1 = 1204 + ctx.rng(-8, 8)
  const body = metal(ctx, ctx.finish, 'v')
  const [bodyEdge, bodyHi, bodyMid, bodyLow, bodyDark] = tones(ctx.finish)
  const [, accHi, accMid, , accDark] = tones(ctx.accent)

  ctx.add(groundShadow(ctx, 790, 892, 545, 64))

  // Baseplate with anti-vibration pads.
  ctx.add(`<rect x="285" y="872" width="90" height="20" rx="6" fill="#26292e"/>`)
  ctx.add(`<rect x="1205" y="872" width="90" height="20" rx="6" fill="#26292e"/>`)
  ctx.add(`<rect x="270" y="830" width="1040" height="42" rx="8" fill="${metal(ctx, 'machineGray', 'v')}" stroke="#41454c" stroke-width="2.5"/>`)
  ctx.add(`<rect x="270" y="856" width="1040" height="16" rx="6" fill="#41454c" opacity="0.55"/>`)
  ctx.add(hexBolt(ctx, 330, 850, 13))
  ctx.add(hexBolt(ctx, 1250, 850, 13))

  // Motor drive-end bell (slightly proud), then the finned body.
  ctx.add(`<rect x="840" y="750" width="240" height="84" rx="10" fill="${metal(ctx, 'castIron', 'v')}" stroke="#2b2f34" stroke-width="2.5"/>`)
  ctx.add(`<rect x="618" y="472" width="52" height="296" rx="16" fill="${bodyLow}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${motorX0}" y="485" width="${motorX1 - motorX0}" height="270" rx="30" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>`)
  {
    // Longitudinal cooling fins read as horizontal lines in side view.
    const fins: string[] = []
    for (let y = 512; y <= 738; y += 25) {
      fins.push(`<line x1="${motorX0 + 22}" y1="${y}" x2="${motorX1 - 14}" y2="${y}" stroke="${bodyDark}" stroke-width="2.5" opacity="0.34"/>`)
    }
    ctx.add(fins.join(''))
  }
  ctx.add(specular(motorX0 + 24, 498, motorX1 - motorX0 - 60, 20, 0.3))

  // Fan cowl with intake louvres and end disc.
  ctx.add(`<rect x="${motorX1}" y="478" width="70" height="284" rx="20" fill="${metal(ctx, 'machineGray', 'v')}" stroke="#41454c" stroke-width="2.5"/>`)
  ctx.add(ribs(motorX1 + 6, 500, 58, 240, 4, '#33383f', 0.5, 3))
  ctx.add(`<ellipse cx="${motorX1 + 70}" cy="620" rx="13" ry="138" fill="${metal(ctx, 'machineGray', 'h')}" stroke="#41454c" stroke-width="2"/>`)

  // Terminal box on top of the motor, with a cable gland.
  ctx.add(`<rect x="878" y="424" width="150" height="72" rx="10" fill="${accMid}" stroke="${accDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="888" y="432" width="130" height="14" rx="6" fill="${accHi}" opacity="0.4"/>`)
  ctx.add(`<circle cx="1042" cy="460" r="13" fill="${metalRadial(ctx, 'plasticBlack')}" stroke="#08090b" stroke-width="2"/>`)

  // Nameplate — a shaded plate, no text.
  ctx.add(`<rect x="900" y="562" width="116" height="52" rx="6" fill="#dfe3e8" opacity="0.9" stroke="#6e767f" stroke-width="1.5"/>`)
  ctx.add(`<rect x="910" y="574" width="96" height="7" rx="3" fill="#6e767f" opacity="0.55"/>`)
  ctx.add(`<rect x="910" y="588" width="70" height="7" rx="3" fill="#6e767f" opacity="0.45"/>`)

  // Coupling housing between motor and volute.
  ctx.add(`<rect x="560" y="512" width="104" height="216" rx="14" fill="${metal(ctx, 'castIron', 'v')}" stroke="#2b2f34" stroke-width="2.5"/>`)
  ctx.add(ribs(572, 528, 82, 184, 3, '#1f2226', 0.4, 3))

  // Discharge branch on top of the volute, flange face up.
  ctx.add(`<rect x="411" y="296" width="88" height="180" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="380" y="262" width="150" height="34" rx="8" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(hexBolt(ctx, 400, 279, 13))
  ctx.add(hexBolt(ctx, 510, 279, 13))
  ctx.add(specular(418, 306, 16, 150, 0.2, 8))

  // Suction flange on the axis, pointing left.
  ctx.add(`<rect x="286" y="${axis - 62}" width="80" height="124" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(flange(ctx, 268, axis, 56, 250, ctx.finish))

  // Volute pedestal, then the volute casing itself.
  ctx.add(`<rect x="413" y="796" width="84" height="40" rx="6" fill="${bodyLow}" stroke="${bodyDark}" stroke-width="2"/>`)
  ctx.add(`<circle cx="${volCx}" cy="${axis}" r="${volR.toFixed(1)}" fill="${metalRadial(ctx, ctx.finish)}" stroke="${bodyDark}" stroke-width="3.5"/>`)
  ctx.add(`<circle cx="${volCx}" cy="${axis}" r="${(volR - 32).toFixed(1)}" fill="none" stroke="${bodyDark}" stroke-width="2.5" opacity="0.55"/>`)
  ctx.add(`<circle cx="${volCx}" cy="${axis}" r="${(volR * 0.47).toFixed(1)}" fill="none" stroke="${bodyDark}" stroke-width="2" opacity="0.35"/>`)
  ctx.add(`<circle cx="${volCx}" cy="${axis}" r="46" fill="${metalRadial(ctx, 'steel')}" stroke="#33383f" stroke-width="2.5"/>`)
  ctx.add(`<circle cx="${volCx - 12}" cy="${axis - 14}" r="11" fill="#ffffff" opacity="0.5"/>`)
  {
    // Casing cover bolt circle.
    const parts: string[] = []
    for (let i = 0; i < 8; i++) {
      const a = ((i * 45 - 67) * Math.PI) / 180
      parts.push(hexBolt(ctx, volCx + Math.cos(a) * (volR - 45), axis + Math.sin(a) * (volR - 45), 15))
    }
    ctx.add(parts.join(''))
  }
  // Drain plug at the bottom of the casing.
  ctx.add(hexBolt(ctx, volCx, axis + volR - 22, 13))
  // Volute rim highlight, upper left.
  ctx.add(`<path d="${arcPath(volCx, axis, volR - 12, 150, 245)}" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" opacity="0.28"/>`)
  ctx.add(`<path d="${arcPath(volCx, axis, volR - 10, 20, 80)}" fill="none" stroke="${bodyDark}" stroke-width="10" stroke-linecap="round" opacity="0.3"/>`)

  void bodyEdge
  void bodyHi
  void bodyMid
}

/* -------------------------------------------------------------------------- */
/* pump-submersible — vertical dewatering pump with handle, cable, strainer   */
/* -------------------------------------------------------------------------- */

export const pumpSubmersible: ShapeRenderer = (ctx) => {
  const bw = 320 + ctx.rng(-8, 8) // main body width
  const bx0 = cx - bw / 2
  const bx1 = cx + bw / 2
  const body = metal(ctx, ctx.finish, 'h')
  const [, , , bodyLow, bodyDark] = tones(ctx.finish)
  const [, , accMid, accLow, accDark] = tones(ctx.accent)
  const cableBend = ctx.rng(-18, 18)

  ctx.add(groundShadow(ctx, cx, 905, 350, 52))

  // Carry handle (behind the cap) and cable, painted first.
  ctx.add(`<path d="M ${cx - 100} 272 C ${cx - 78} 196, ${cx + 78} 196, ${cx + 100} 272" fill="none" stroke="#3a4048" stroke-width="30" stroke-linecap="round"/>`)
  ctx.add(`<path d="M ${cx - 100} 268 C ${cx - 78} 194, ${cx + 78} 194, ${cx + 100} 268" fill="none" stroke="${metal(ctx, 'steel', 'v')}" stroke-width="22" stroke-linecap="round"/>`)
  ctx.add(`<path d="M ${cx - 92} 258 C ${cx - 72} 202, ${cx + 60} 198, ${cx + 88} 250" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.4"/>`)
  {
    // Power cable from the gland, curling down beside the pump.
    const c1x = cx + 290 + cableBend
    const path = `M ${cx + 82} 240 C ${cx + 170} 190, ${c1x} 250, ${c1x + 18} 400 C ${(c1x + 28).toFixed(0)} 520, ${c1x - 30} 600, ${c1x - 78} 636`
    ctx.add(`<path d="${path}" fill="none" stroke="#08090b" stroke-width="24" stroke-linecap="round"/>`)
    ctx.add(`<path d="${path}" fill="none" stroke="#26292e" stroke-width="18" stroke-linecap="round"/>`)
    ctx.add(`<path d="${path}" fill="none" stroke="#4a4f56" stroke-width="6" stroke-linecap="round" opacity="0.8"/>`)
  }
  // Cable gland on the cap.
  ctx.add(`<rect x="${cx + 62}" y="216" width="40" height="52" rx="8" fill="${metal(ctx, 'steel', 'h')}" stroke="#2d3238" stroke-width="2"/>`)
  ctx.add(`<rect x="${cx + 58}" y="238" width="48" height="14" rx="5" fill="#33383f"/>`)

  // Base plate under the strainer.
  ctx.add(`<rect x="${cx - 200}" y="862" width="400" height="36" rx="14" fill="${metal(ctx, 'plasticBlack', 'v')}" stroke="#08090b" stroke-width="2.5"/>`)

  // Strainer skirt with intake slots.
  ctx.add(`<rect x="${cx - 190}" y="760" width="380" height="112" rx="18" fill="${metal(ctx, ctx.accent, 'h')}" stroke="${accDark}" stroke-width="3"/>`)
  {
    const slots: string[] = []
    for (let i = 0; i < 9; i++) {
      const sx = cx - 158 + i * 39
      slots.push(`<rect x="${sx}" y="782" width="15" height="68" rx="7" fill="#101216" opacity="0.85"/>`)
      slots.push(`<rect x="${sx + 2}" y="784" width="4" height="64" rx="2" fill="#4a4f56" opacity="0.5"/>`)
    }
    ctx.add(slots.join(''))
  }
  ctx.add(specular(cx - 176, 766, 340, 12, 0.2))

  // Main motor body.
  ctx.add(`<rect x="${bx0}" y="320" width="${bw}" height="452" rx="26" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>`)
  {
    // Fine horizontal cooling ribs.
    const fins: string[] = []
    for (let y = 396; y <= 660; y += 26) {
      fins.push(`<line x1="${bx0 + 12}" y1="${y}" x2="${bx1 - 12}" y2="${y}" stroke="${bodyDark}" stroke-width="2.5" opacity="0.3"/>`)
    }
    ctx.add(fins.join(''))
  }
  // Seam bands: oil-chamber joint and clamp ring.
  ctx.add(`<rect x="${bx0 - 8}" y="688" width="${bw + 16}" height="26" rx="10" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${bx0 - 8}" y="348" width="${bw + 16}" height="24" rx="10" fill="${body}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="${bx0 + 14}" y="332" width="34" height="430" rx="16" fill="#ffffff" opacity="0.22"/>`)
  ctx.add(`<rect x="${bx1 - 44}" y="332" width="30" height="430" rx="14" fill="${bodyDark}" opacity="0.3"/>`)

  // Discharge stub with hose tail, right side near the top.
  ctx.add(`<rect x="${bx1 - 12}" y="386" width="102" height="82" rx="10" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(hexSide(ctx, bx1 + 84, 378, 30, 98, 'steel'))
  {
    // Barbed hose tail.
    const hx = bx1 + 114
    ctx.add(`<path d="M ${hx} 392 L ${hx + 78} 402 L ${hx + 78} 452 L ${hx} 462 Z" fill="${metal(ctx, 'steel', 'v')}" stroke="#33383f" stroke-width="2"/>`)
    for (let i = 0; i < 3; i++) {
      const rx = hx + 16 + i * 22
      ctx.add(`<line x1="${rx}" y1="${398 - i}" x2="${rx}" y2="${458 + i}" stroke="#33383f" stroke-width="3" opacity="0.6"/>`)
    }
    ctx.add(specular(hx + 4, 400, 66, 9, 0.3))
  }

  // Top cap over the handle roots.
  ctx.add(`<rect x="${cx - 145}" y="256" width="290" height="76" rx="32" fill="${metal(ctx, ctx.accent, 'h')}" stroke="${accDark}" stroke-width="3"/>`)
  ctx.add(`<rect x="${cx - 120}" y="264" width="240" height="14" rx="7" fill="#ffffff" opacity="0.3"/>`)
  ctx.add(`<rect x="${cx - 145}" y="312" width="290" height="12" fill="${accLow}" opacity="0.6"/>`)

  void accMid
  void bodyLow
}

/* -------------------------------------------------------------------------- */
/* pump-dosing — solenoid metering pump with PVDF head and tubing             */
/* -------------------------------------------------------------------------- */

export const pumpDosing: ShapeRenderer = (ctx) => {
  const body = metal(ctx, ctx.finish, 'v')
  const [, , , bodyLow, bodyDark] = tones(ctx.finish)
  const [, accHi, , , accDark] = tones(ctx.accent)
  const headCx = 445
  const headCy = 618
  const knobA = ctx.rng(-70, 30) // pointer angle

  ctx.add(groundShadow(ctx, 800, 882, 440, 56))

  // Feet.
  ctx.add(`<rect x="608" y="806" width="92" height="38" rx="10" fill="#26292e" stroke="#08090b" stroke-width="2"/>`)
  ctx.add(`<rect x="1066" y="806" width="92" height="38" rx="10" fill="#26292e" stroke="#08090b" stroke-width="2"/>`)

  // Suction and discharge tubing (behind the head/fittings).
  const tube = ctx.def(
    'flow-dose-tube',
    `<linearGradient id="flow-dose-tube" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#c8d2d8"/>
      <stop offset="0.35" stop-color="#f2f7f9"/>
      <stop offset="1" stop-color="#aeb9c0"/>
    </linearGradient>`
  )
  ctx.add(`<rect x="${headCx - 9}" y="300" width="18" height="168" rx="8" fill="${tube}" stroke="#8d9aa2" stroke-width="1.5" opacity="0.95"/>`)
  ctx.add(`<rect x="${headCx - 9}" y="772" width="18" height="96" rx="8" fill="${tube}" stroke="#8d9aa2" stroke-width="1.5" opacity="0.95"/>`)

  // Drive housing.
  ctx.add(`<rect x="560" y="386" width="650" height="426" rx="38" fill="${body}" stroke="${bodyDark}" stroke-width="3"/>`)
  ctx.add(`<rect x="586" y="394" width="600" height="20" rx="10" fill="#ffffff" opacity="0.28"/>`)
  ctx.add(`<rect x="1176" y="410" width="26" height="380" rx="12" fill="${bodyDark}" opacity="0.3"/>`)

  // Front control panel inset.
  ctx.add(`<rect x="606" y="430" width="574" height="348" rx="24" fill="${bodyLow}" opacity="0.5" stroke="${bodyDark}" stroke-width="2" />`)

  // Display window with segment bars (no text).
  const lcd = ctx.def(
    'flow-dose-lcd',
    `<linearGradient id="flow-dose-lcd" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0e2033"/>
      <stop offset="0.5" stop-color="#1a3a5c"/>
      <stop offset="1" stop-color="#0b1826"/>
    </linearGradient>`
  )
  ctx.add(`<rect x="650" y="466" width="300" height="96" rx="12" fill="${lcd}" stroke="#0a121c" stroke-width="3"/>`)
  ctx.add(`<rect x="656" y="472" width="288" height="26" rx="8" fill="#3a5b78" opacity="0.35"/>`)
  ctx.add(`<rect x="678" y="500" width="64" height="30" rx="5" fill="#79e0f2" opacity="0.85"/>`)
  ctx.add(`<rect x="756" y="500" width="64" height="30" rx="5" fill="#79e0f2" opacity="0.75"/>`)
  ctx.add(`<circle cx="838" cy="526" r="5" fill="#79e0f2" opacity="0.8"/>`)
  ctx.add(`<rect x="852" y="500" width="64" height="30" rx="5" fill="#79e0f2" opacity="0.8"/>`)

  // Status LEDs.
  ctx.add(`<circle cx="986" cy="492" r="10" fill="#3ddc84" stroke="#1c7a49" stroke-width="2"/>`)
  ctx.add(`<circle cx="986" cy="530" r="10" fill="#ff5b4d" stroke="#8f2a22" stroke-width="2"/>`)
  ctx.add(`<circle cx="983" cy="489" r="3.5" fill="#ffffff" opacity="0.7"/>`)

  // Buttons.
  for (let i = 0; i < 4; i++) {
    const bx = 656 + i * 76
    ctx.add(`<rect x="${bx}" y="596" width="58" height="44" rx="10" fill="${metal(ctx, 'plasticBlack', 'v')}" stroke="#08090b" stroke-width="2"/>`)
    ctx.add(`<rect x="${bx + 8}" y="602" width="42" height="9" rx="4" fill="#4a4f56" opacity="0.8"/>`)
  }

  // Stroke-adjust knob.
  ctx.add(`<circle cx="1058" cy="648" r="82" fill="${metalRadial(ctx, ctx.accent)}" stroke="${accDark}" stroke-width="3.5"/>`)
  {
    const ticks: string[] = []
    for (let i = 0; i < 24; i++) {
      const a = ((i * 15) * Math.PI) / 180
      const x0 = 1058 + Math.cos(a) * 70
      const y0 = 648 + Math.sin(a) * 70
      const x1 = 1058 + Math.cos(a) * 80
      const y1 = 648 + Math.sin(a) * 80
      ticks.push(`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${accDark}" stroke-width="4" opacity="0.55"/>`)
    }
    ctx.add(ticks.join(''))
  }
  ctx.add(`<g transform="rotate(${knobA.toFixed(1)} 1058 648)">
    <rect x="1050" y="586" width="16" height="60" rx="8" fill="#ffffff" opacity="0.92"/>
  </g>`)
  ctx.add(`<circle cx="1032" cy="620" r="16" fill="#ffffff" opacity="0.3"/>`)

  // Pump head standoff, then the PVDF liquid end.
  ctx.add(`<rect x="528" y="560" width="60" height="118" rx="8" fill="${bodyLow}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(`<circle cx="${headCx}" cy="${headCy}" r="102" fill="${metalRadial(ctx, 'plasticWhite')}" stroke="#82888e" stroke-width="3"/>`)
  ctx.add(`<circle cx="${headCx}" cy="${headCy}" r="66" fill="none" stroke="#9aa0a6" stroke-width="2.5" opacity="0.6"/>`)
  {
    // Socket-head screws around the head.
    const parts: string[] = []
    for (let i = 0; i < 6; i++) {
      const a = ((i * 60 - 90 + 12) * Math.PI) / 180
      const sx = headCx + Math.cos(a) * 82
      const sy = headCy + Math.sin(a) * 82
      parts.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="9" fill="#63686f" stroke="#383c42" stroke-width="2"/>`)
      parts.push(`<circle cx="${(sx - 2).toFixed(1)}" cy="${(sy - 2).toFixed(1)}" r="3" fill="#ffffff" opacity="0.5"/>`)
    }
    ctx.add(parts.join(''))
  }
  ctx.add(`<circle cx="${headCx - 30}" cy="${headCy - 34}" r="22" fill="#ffffff" opacity="0.4"/>`)

  // Valve fittings, top (discharge) and bottom (suction), with tube nuts.
  ctx.add(`<rect x="${headCx - 20}" y="466" width="40" height="58" rx="8" fill="${metal(ctx, 'plasticWhite', 'h')}" stroke="#82888e" stroke-width="2.5"/>`)
  ctx.add(hexSide(ctx, headCx - 27, 442, 54, 30, 'plasticWhite'))
  ctx.add(`<rect x="${headCx - 20}" y="712" width="40" height="58" rx="8" fill="${metal(ctx, 'plasticWhite', 'h')}" stroke="#82888e" stroke-width="2.5"/>`)
  ctx.add(hexSide(ctx, headCx - 27, 764, 54, 30, 'plasticWhite'))

  ctx.add(specular(600, 402, 380, 14, 0.22))
  void accHi
}

/* -------------------------------------------------------------------------- */
/* booster-set — three vertical multistage pumps on a skid with manifold      */
/* -------------------------------------------------------------------------- */

export const boosterSet: ShapeRenderer = (ctx) => {
  const [, , , bodyLow, bodyDark] = tones(ctx.finish)
  const [, , accMid, accLow, accDark] = tones(ctx.accent)
  const pumpXs = [500, 790, 1080]
  const lean = ctx.rng(-4, 4)

  ctx.add(groundShadow(ctx, 800, 908, 580, 66))

  // Skid base with forklift cutouts.
  ctx.add(`<rect x="240" y="842" width="1120" height="48" rx="8" fill="${metal(ctx, 'machineGray', 'v')}" stroke="#41454c" stroke-width="3"/>`)
  ctx.add(`<rect x="500" y="858" width="74" height="32" rx="4" fill="#26292e" opacity="0.85"/>`)
  ctx.add(`<rect x="1030" y="858" width="74" height="32" rx="4" fill="#26292e" opacity="0.85"/>`)
  ctx.add(specular(260, 848, 500, 8, 0.2))

  // Rear discharge manifold, visible between the pump stacks.
  ctx.add(`<rect x="330" y="706" width="930" height="52" rx="24" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(specular(350, 714, 880, 10, 0.3))

  // Diaphragm accumulator vessel (real-world red), behind the right pump edge.
  ctx.add(`<rect x="${1265 + lean}" y="598" width="30" height="48" rx="8" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="2"/>`)
  ctx.add(`<rect x="1215" y="628" width="130" height="224" rx="56" fill="${metal(ctx, 'epoxyRed', 'h')}" stroke="#5e0e10" stroke-width="3"/>`)
  ctx.add(`<rect x="1230" y="640" width="24" height="196" rx="12" fill="#ffffff" opacity="0.3"/>`)
  ctx.add(`<rect x="1226" y="846" width="108" height="20" rx="6" fill="#26292e"/>`)
  // Braided hose from vessel port down to the manifold.
  ctx.add(`<path d="M ${1280 + lean} 606 C ${1214 + lean} 570, 1180 620, 1196 700 C 1202 726, 1220 732, 1246 732" fill="none" stroke="#565c66" stroke-width="17" stroke-linecap="round"/>`)
  ctx.add(`<path d="M ${1280 + lean} 606 C ${1214 + lean} 570, 1180 620, 1196 700 C 1202 726, 1220 732, 1246 732" fill="none" stroke="#c3c9d1" stroke-width="9" stroke-linecap="round" opacity="0.8"/>`)

  // Three pump units: base volute, multistage sleeve, motor, fan cowl.
  for (const px of pumpXs) {
    // Cast pump base.
    ctx.add(`<rect x="${px - 78}" y="745" width="156" height="100" rx="10" fill="${metal(ctx, ctx.accent, 'v')}" stroke="${accDark}" stroke-width="2.5"/>`)
    ctx.add(`<rect x="${px - 78}" y="826" width="156" height="19" rx="6" fill="${accLow}" opacity="0.7"/>`)
    ctx.add(hexBolt(ctx, px - 56, 786, 10))
    ctx.add(hexBolt(ctx, px + 56, 786, 10))
    // Stack sleeve.
    ctx.add(`<rect x="${px - 50}" y="470" width="100" height="285" rx="12" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
    ctx.add(`<rect x="${px - 38}" y="480" width="18" height="265" rx="9" fill="#ffffff" opacity="0.4"/>`)
    ctx.add(`<rect x="${px + 24}" y="480" width="14" height="265" rx="7" fill="${bodyDark}" opacity="0.3"/>`)
    // Motor stool / top collar.
    ctx.add(`<rect x="${px - 58}" y="448" width="116" height="28" rx="8" fill="${metal(ctx, ctx.accent, 'v')}" stroke="${accDark}" stroke-width="2"/>`)
    // Motor with vertical fins.
    ctx.add(`<rect x="${px - 64}" y="318" width="128" height="134" rx="16" fill="${metal(ctx, ctx.accent, 'h')}" stroke="${accDark}" stroke-width="2.5"/>`)
    ctx.add(ribs(px - 56, 330, 112, 110, 6, accDark, 0.4, 2.5))
    // Terminal box.
    ctx.add(`<rect x="${px + 52}" y="348" width="42" height="52" rx="7" fill="${metal(ctx, 'plasticGray', 'v')}" stroke="#383c42" stroke-width="2"/>`)
    // Fan cowl.
    ctx.add(`<rect x="${px - 68}" y="288" width="136" height="34" rx="14" fill="${metal(ctx, 'machineGray', 'v')}" stroke="#41454c" stroke-width="2"/>`)
    ctx.add(`<ellipse cx="${px}" cy="288" rx="66" ry="11" fill="${metal(ctx, 'machineGray', 'h')}" stroke="#41454c" stroke-width="2"/>`)
    ctx.add(ribs(px - 52, 292, 104, 26, 7, '#33383f', 0.45, 2.5))
  }

  // Control panel on a stand at the left.
  ctx.add(`<rect x="322" y="500" width="20" height="342" fill="${metal(ctx, 'machineGray', 'h')}" stroke="#41454c" stroke-width="2"/>`)
  ctx.add(`<rect x="252" y="356" width="180" height="204" rx="14" fill="${metal(ctx, 'plasticGray', 'v')}" stroke="#383c42" stroke-width="3"/>`)
  ctx.add(`<line x1="404" y1="366" x2="404" y2="550" stroke="#383c42" stroke-width="2" opacity="0.6"/>`)
  ctx.add(`<rect x="272" y="380" width="110" height="52" rx="8" fill="#10233a" stroke="#0a121c" stroke-width="2.5"/>`)
  ctx.add(`<rect x="280" y="392" width="52" height="18" rx="4" fill="#79e0f2" opacity="0.8"/>`)
  ctx.add(`<circle cx="286" cy="466" r="9" fill="#3ddc84" stroke="#1c7a49" stroke-width="2"/>`)
  ctx.add(`<circle cx="316" cy="466" r="9" fill="#f0b90b" stroke="#8f6d0a" stroke-width="2"/>`)
  ctx.add(`<circle cx="346" cy="466" r="9" fill="#ff5b4d" stroke="#8f2a22" stroke-width="2"/>`)
  ctx.add(`<rect x="272" y="498" width="72" height="36" rx="6" fill="${metal(ctx, 'plasticBlack', 'v')}" stroke="#08090b" stroke-width="2"/>`)
  ctx.add(specular(262, 366, 120, 12, 0.25))

  // Front suction manifold with flanged ends and riser tees.
  for (const px of pumpXs) {
    ctx.add(`<rect x="${px - 26}" y="768" width="52" height="50" fill="${metal(ctx, ctx.finish, 'h')}" stroke="${bodyDark}" stroke-width="2"/>`)
  }
  ctx.add(`<rect x="316" y="784" width="880" height="58" rx="27" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${bodyDark}" stroke-width="2.5"/>`)
  ctx.add(flange(ctx, 306, 813, 34, 96, ctx.finish))
  ctx.add(flange(ctx, 1206, 813, 34, 96, ctx.finish))
  ctx.add(specular(350, 792, 800, 11, 0.32))

  // Small pressure gauge on the manifold.
  ctx.add(`<rect x="1136" y="746" width="14" height="42" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="1.5"/>`)
  ctx.add(`<circle cx="1143" cy="722" r="30" fill="${metalRadial(ctx, 'steel')}" stroke="#2d3238" stroke-width="2.5"/>`)
  ctx.add(`<circle cx="1143" cy="722" r="22" fill="#f4f6f8" stroke="#8e959e" stroke-width="1.5"/>`)
  ctx.add(`<line x1="1143" y1="722" x2="${(1143 + 13 * Math.cos((-125 * Math.PI) / 180)).toFixed(1)}" y2="${(722 + 13 * Math.sin((-125 * Math.PI) / 180)).toFixed(1)}" stroke="#1a1c20" stroke-width="3" stroke-linecap="round"/>`)

  void bodyLow
  void accMid
}

/* -------------------------------------------------------------------------- */
/* pipe — straight tube lengths, open end toward the viewer                   */
/* -------------------------------------------------------------------------- */

export const pipe: ShapeRenderer = (ctx) => {
  const tilt = ctx.rng(-1.2, 1.2)
  const [, hi, , , dark] = tones(ctx.finish)
  const body = metal(ctx, ctx.finish, 'v')

  ctx.add(groundShadow(ctx, 800, 880, 570, 58))

  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} 800 650)">`)

  // Back pipe (smaller bore, resting behind).
  ctx.add(`<ellipse cx="322" cy="585" rx="24" ry="68" fill="${tones(ctx.finish)[3]}" stroke="${dark}" stroke-width="2"/>`)
  ctx.add(`<rect x="322" y="517" width="948" height="136" fill="${body}" stroke="${dark}" stroke-width="2.5"/>`)
  ctx.add(specular(360, 534, 850, 16, 0.3))
  ctx.add(`<rect x="360" y="620" width="850" height="12" rx="6" fill="${hi}" opacity="0.14"/>`)
  ctx.add(pipeBore(ctx, 1270, 585, 25, 70, ctx.finish, 9))

  // Front pipe.
  ctx.add(`<ellipse cx="248" cy="700" rx="33" ry="97" fill="${tones(ctx.finish)[3]}" stroke="${dark}" stroke-width="2.5"/>`)
  ctx.add(`<rect x="248" y="603" width="1082" height="194" fill="${body}" stroke="${dark}" stroke-width="3"/>`)
  ctx.add(specular(300, 626, 980, 24, 0.34))
  ctx.add(`<rect x="300" y="756" width="980" height="16" rx="8" fill="${hi}" opacity="0.15"/>`)
  ctx.add(`<rect x="248" y="770" width="1082" height="10" fill="${dark}" opacity="0.4"/>`)
  ctx.add(pipeBore(ctx, 1330, 700, 34, 98, ctx.finish, 11))

  ctx.add(`</g>`)
}

/* -------------------------------------------------------------------------- */
/* insulation — closed-cell foam tube slipped over a pipe stub                */
/* -------------------------------------------------------------------------- */

export const insulation: ShapeRenderer = (ctx) => {
  const tilt = ctx.rng(-1, 1)
  const [edge, hiT, midT, lowT] = tones(ctx.finish)
  const foamBody = ctx.def(
    `flow-foam-${ctx.finish}`,
    `<linearGradient id="flow-foam-${ctx.finish}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${lowT}"/>
      <stop offset="0.2" stop-color="${hiT}"/>
      <stop offset="0.55" stop-color="${midT}"/>
      <stop offset="1" stop-color="${lowT}"/>
    </linearGradient>`
  )
  const foamFace = ctx.def(
    `flow-foamface-${ctx.finish}`,
    `<radialGradient id="flow-foamface-${ctx.finish}" cx="0.42" cy="0.42" r="0.9">
      <stop offset="0" stop-color="${hiT}"/>
      <stop offset="0.7" stop-color="${midT}"/>
      <stop offset="1" stop-color="${lowT}"/>
    </radialGradient>`
  )
  const foamBore = ctx.def(
    'flow-foam-bore',
    `<radialGradient id="flow-foam-bore" cx="0.45" cy="0.42" r="0.95">
      <stop offset="0" stop-color="#33373d"/>
      <stop offset="0.6" stop-color="#1b1e22"/>
      <stop offset="1" stop-color="#0c0d0f"/>
    </radialGradient>`
  )

  ctx.add(groundShadow(ctx, 780, 890, 530, 58))
  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} 760 640)">`)

  // Foam tube body.
  ctx.add(`<rect x="360" y="505" width="850" height="270" fill="${foamBody}" stroke="${lowT}" stroke-width="2.5"/>`)
  // Left end face annulus, with the bore that the pipe enters.
  ctx.add(`<ellipse cx="360" cy="640" rx="48" ry="135" fill="${foamFace}" stroke="${lowT}" stroke-width="2.5"/>`)
  ctx.add(`<ellipse cx="360" cy="640" rx="24" ry="58" fill="${foamBore}"/>`)

  // Copper pipe emerging from the left end.
  ctx.add(`<ellipse cx="208" cy="640" rx="17" ry="48" fill="${tones('copper')[3]}" stroke="#5e3018" stroke-width="2"/>`)
  ctx.add(`<rect x="208" y="592" width="164" height="96" fill="${metal(ctx, 'copper', 'v')}" stroke="#5e3018" stroke-width="2.5"/>`)
  ctx.add(specular(216, 604, 148, 11, 0.35))

  // Circumferential wrinkles along the foam.
  for (const wx of [480, 610, 740, 870, 1000, 1120]) {
    ctx.add(`<path d="M ${wx} 508 Q ${wx - 12} 640 ${wx} 772" fill="none" stroke="${lowT}" stroke-width="4" opacity="0.14"/>`)
  }
  // Self-seal slit along the top.
  ctx.add(`<path d="M 380 514 C 620 506, 950 506, 1198 516" fill="none" stroke="${lowT}" stroke-width="3.5" opacity="0.6"/>`)
  ctx.add(`<path d="M 380 518 C 620 510, 950 510, 1198 520" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.35"/>`)

  // Right end: full cross-section face with thick wall and bore.
  ctx.add(`<ellipse cx="1210" cy="640" rx="56" ry="135" fill="${foamFace}" stroke="${lowT}" stroke-width="3"/>`)
  {
    // Speckled cell texture on the cut face, deterministic golden-angle spread.
    const dots: string[] = []
    for (let i = 0; i < 34; i++) {
      const a = i * 2.39996
      const rr = 0.42 + 0.55 * ((i * 0.618034) % 1)
      const dx = Math.cos(a) * 42 * rr
      const dy = Math.sin(a) * 118 * rr
      const big = i % 5 === 0
      dots.push(
        `<circle cx="${(1210 + dx).toFixed(1)}" cy="${(640 + dy).toFixed(1)}" r="${big ? 3 : 1.8}" fill="${i % 3 === 0 ? '#ffffff' : lowT}" opacity="${i % 3 === 0 ? 0.35 : 0.25}"/>`
      )
    }
    ctx.add(dots.join(''))
  }
  ctx.add(`<ellipse cx="1210" cy="640" rx="24" ry="58" fill="${foamBore}" stroke="#0c0d0f" stroke-width="1.5"/>`)
  ctx.add(`<ellipse cx="1204" cy="628" rx="10" ry="26" fill="#565c66" opacity="0.5"/>`)

  // Soft matte sheen on top of the tube.
  ctx.add(`<rect x="420" y="528" width="720" height="30" rx="15" fill="#ffffff" opacity="0.18"/>`)

  ctx.add(`</g>`)
  void edge
}

/* -------------------------------------------------------------------------- */
/* clamp — two-part rubber-lined pipe clamp, face on, boss and stud on top    */
/* -------------------------------------------------------------------------- */

export const clamp: ShapeRenderer = (ctx) => {
  const ccx = 800
  const ccy = 575
  const R = 320
  const band = 62
  const tilt = ctx.rng(-2, 2)
  const [, , , , dark] = tones(ctx.finish)
  const ring = metal(ctx, ctx.finish, 'v')
  const [, rubHi, rubMid, , rubDark] = tones('plasticBlack')

  ctx.add(groundShadow(ctx, 800, 912, 400, 50))
  ctx.add(`<g transform="rotate(${tilt.toFixed(2)} ${ccx} ${ccy})">`)

  // Hanger stud, nut and welded boss on top.
  ctx.add(threadedRodV(ctx, ccx - 10, 128, 180, 20))
  ctx.add(hexSide(ctx, ccx - 26, 168, 52, 30, ctx.finish))
  ctx.add(`<rect x="${ccx - 32}" y="196" width="64" height="46" rx="5" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${dark}" stroke-width="2.5"/>`)

  // Flange ears at the 3 and 9 o'clock split: each band half ends in a flat
  // lug rooted INSIDE the band (painted before the ring, so the root tucks
  // behind it and metal meets metal at the split), with a vertical bolt
  // clamping the pair — head on the upper lug, nut and thread tip below.
  for (const side of [-1, 1]) {
    const earIn = ccx + side * (R - band / 2 - 10) // lug root, under the band
    const earOut = ccx + side * (R + band / 2 + 96) // lug tip
    const earX = Math.min(earIn, earOut)
    const earW = Math.abs(earOut - earIn)
    const ex = ccx + side * (R + band / 2 + 50) // bolt centre-line on the lug
    // Bolt shaft behind the lugs, visible through the split gap.
    ctx.add(`<rect x="${ex - 9}" y="${ccy - 48}" width="18" height="96" fill="${metal(ctx, 'steel', 'h')}" stroke="#33383f" stroke-width="1.5"/>`)
    // Upper and lower lugs meeting at the split line.
    ctx.add(`<rect x="${earX}" y="${ccy - 40}" width="${earW}" height="34" rx="6" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${dark}" stroke-width="2.5"/>`)
    ctx.add(`<rect x="${earX + 5}" y="${ccy - 36}" width="${earW - 10}" height="8" rx="4" fill="#ffffff" opacity="0.32"/>`)
    ctx.add(`<rect x="${earX}" y="${ccy + 6}" width="${earW}" height="34" rx="6" fill="${metal(ctx, ctx.finish, 'v')}" stroke="${dark}" stroke-width="2.5"/>`)
    ctx.add(`<rect x="${earX + 5}" y="${ccy + 32}" width="${earW - 10}" height="6" rx="3" fill="${dark}" opacity="0.35"/>`)
    // Bolt head seated on the upper lug; nut and protruding thread below.
    ctx.add(hexSide(ctx, ex - 24, ccy - 68, 48, 28, 'steel'))
    ctx.add(hexSide(ctx, ex - 24, ccy + 40, 48, 26, 'steel'))
    ctx.add(threadedRodV(ctx, ex - 8, ccy + 66, ccy + 102, 16))
  }

  // Outer galvanised band.
  ctx.add(`<circle cx="${ccx}" cy="${ccy}" r="${R}" fill="none" stroke="${ring}" stroke-width="${band}"/>`)
  ctx.add(`<circle cx="${ccx}" cy="${ccy}" r="${R + band / 2}" fill="none" stroke="${dark}" stroke-width="2.5"/>`)
  ctx.add(`<circle cx="${ccx}" cy="${ccy}" r="${R - band / 2}" fill="none" stroke="${dark}" stroke-width="2"/>`)

  // Bonded rubber lining inside the band.
  ctx.add(`<circle cx="${ccx}" cy="${ccy}" r="268" fill="none" stroke="${rubMid}" stroke-width="40"/>`)
  ctx.add(`<circle cx="${ccx}" cy="${ccy}" r="248" fill="none" stroke="${rubDark}" stroke-width="3"/>`)
  ctx.add(`<path d="${arcPath(ccx, ccy, 268, 195, 255)}" fill="none" stroke="${rubHi}" stroke-width="10" stroke-linecap="round" opacity="0.35"/>`)

  // Split lines between the two halves, left and right.
  ctx.add(`<line x1="${ccx - R - band / 2 - 2}" y1="${ccy}" x2="${ccx - 246}" y2="${ccy}" stroke="${dark}" stroke-width="4" opacity="0.9"/>`)
  ctx.add(`<line x1="${ccx + 246}" y1="${ccy}" x2="${ccx + R + band / 2 + 2}" y2="${ccy}" stroke="${dark}" stroke-width="4" opacity="0.9"/>`)
  ctx.add(`<line x1="${ccx - R - band / 2}" y1="${ccy + 4}" x2="${ccx - 250}" y2="${ccy + 4}" stroke="#ffffff" stroke-width="2" opacity="0.4"/>`)
  ctx.add(`<line x1="${ccx + 250}" y1="${ccy + 4}" x2="${ccx + R + band / 2}" y2="${ccy + 4}" stroke="#ffffff" stroke-width="2" opacity="0.4"/>`)

  // Zinc sheen: bright arc upper-left, shade arc lower-right.
  ctx.add(`<path d="${arcPath(ccx, ccy, R, 185, 260)}" fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.35"/>`)
  ctx.add(`<path d="${arcPath(ccx, ccy, R, 15, 70)}" fill="none" stroke="#1c2430" stroke-width="14" stroke-linecap="round" opacity="0.22"/>`)

  ctx.add(`</g>`)
}
