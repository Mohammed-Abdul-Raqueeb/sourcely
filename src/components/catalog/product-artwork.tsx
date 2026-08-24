import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Product imagery.
 *
 * The catalogue ships with generated technical line-art rather than stock
 * photography. This is a deliberate design decision, not a shortcut:
 *
 *   - Sixty products photographed by sixty different suppliers look like a
 *     scraped directory. One drawing system looks like a catalogue.
 *   - Line art scales, themes, and stays crisp at any density with no image
 *     payload and no layout shift.
 *   - An engineering drawing is the visual language this buyer already reads.
 *
 * Real photography drops in without touching this component: any image URL
 * that is not an `artwork:` descriptor falls through to `next/image` in
 * `<ProductMedia />`.
 *
 * Descriptor format: `artwork:<shape>:<view>:<seed>`
 */

export type ArtworkView = 'front' | 'section' | 'detail' | 'scale'

export interface ArtworkDescriptor {
  shape: string
  view: ArtworkView
  seed: number
}

export function parseArtwork(url: string): ArtworkDescriptor | null {
  if (!url.startsWith('artwork:')) return null
  const [, shape, view, seed] = url.split(':')
  if (!shape) return null
  return {
    shape,
    view: (view as ArtworkView) ?? 'front',
    seed: Number.parseInt(seed ?? '0', 10) || 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Drawing primitives                                                         */
/* -------------------------------------------------------------------------- */

/**
 * All shapes are drawn inside a 200 × 150 viewBox with the origin at the
 * top-left, so every drawing shares one coordinate system and one stroke
 * weight. Strokes use `currentColor` so the theme drives the palette.
 */

const S = { w: 200, h: 150, cx: 100, cy: 75 } as const

/** Flange pair — the end connections common to most inline products. */
function Flanges({ y = S.cy, height = 26, offset = 62 }: { y?: number; height?: number; offset?: number }) {
  return (
    <>
      <rect x={S.cx - offset - 6} y={y - height / 2 - 4} width={7} height={height + 8} rx={1} />
      <rect x={S.cx + offset - 1} y={y - height / 2 - 4} width={7} height={height + 8} rx={1} />
    </>
  )
}

/** Threaded end connections — hatched stubs. */
function Threads({ y = S.cy, height = 20, offset = 62 }: { y?: number; height?: number; offset?: number }) {
  const lines = []
  for (let i = 0; i < 5; i++) {
    lines.push(
      <line key={`l${i}`} x1={S.cx - offset - 2 + i * 4} y1={y - height / 2} x2={S.cx - offset - 6 + i * 4} y2={y + height / 2} />,
      <line key={`r${i}`} x1={S.cx + offset + 2 - i * 4} y1={y - height / 2} x2={S.cx + offset + 6 - i * 4} y2={y + height / 2} />
    )
  }
  return <g strokeWidth={0.8} opacity={0.65}>{lines}</g>
}

function Body({ width = 100, height = 44, rx = 6 }: { width?: number; height?: number; rx?: number }) {
  return <rect x={S.cx - width / 2} y={S.cy - height / 2} width={width} height={height} rx={rx} />
}

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

const SHAPES: Record<string, ReactNode> = {
  'ball-valve': (
    <>
      <Threads />
      <Body width={92} height={46} rx={7} />
      <circle cx={S.cx} cy={S.cy} r={17} />
      <circle cx={S.cx} cy={S.cy} r={9} className="text-accent" strokeWidth={2} />
      <line x1={S.cx - 46} y1={S.cy} x2={S.cx + 46} y2={S.cy} strokeDasharray="3 3" opacity={0.45} />
      {/* stem and lever */}
      <rect x={S.cx - 4} y={S.cy - 40} width={8} height={19} rx={2} />
      <rect x={S.cx - 34} y={S.cy - 48} width={62} height={9} rx={4} className="text-accent" strokeWidth={1.6} />
      <circle cx={S.cx} cy={S.cy - 43.5} r={2.5} />
    </>
  ),

  'butterfly-valve': (
    <>
      <circle cx={S.cx} cy={S.cy + 4} r={38} />
      <circle cx={S.cx} cy={S.cy + 4} r={30} strokeDasharray="2 3" opacity={0.5} />
      <ellipse cx={S.cx} cy={S.cy + 4} rx={9} ry={29} className="text-accent" strokeWidth={1.8} />
      <line x1={S.cx} y1={S.cy - 34} x2={S.cx} y2={S.cy + 42} strokeWidth={2.4} />
      <rect x={S.cx - 5} y={S.cy - 56} width={10} height={22} rx={2} />
      <rect x={S.cx - 26} y={S.cy - 64} width={52} height={10} rx={3} />
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180
        return (
          <circle
            key={angle}
            cx={S.cx + Math.cos(rad) * 34}
            cy={S.cy + 4 + Math.sin(rad) * 34}
            r={2.4}
            opacity={0.7}
          />
        )
      })}
    </>
  ),

  'gate-valve': (
    <>
      <Flanges />
      <Body width={80} height={40} rx={4} />
      <path d={`M ${S.cx - 16} ${S.cy - 20} L ${S.cx - 16} ${S.cy - 44} L ${S.cx + 16} ${S.cy - 44} L ${S.cx + 16} ${S.cy - 20}`} />
      <line x1={S.cx} y1={S.cy - 44} x2={S.cx} y2={S.cy + 14} strokeWidth={2.2} />
      <line x1={S.cx - 14} y1={S.cy + 12} x2={S.cx + 14} y2={S.cy + 12} className="text-accent" strokeWidth={2.4} />
      <circle cx={S.cx} cy={S.cy - 52} r={16} strokeWidth={2} />
      <line x1={S.cx - 16} y1={S.cy - 52} x2={S.cx + 16} y2={S.cy - 52} />
      <line x1={S.cx} y1={S.cy - 68} x2={S.cx} y2={S.cy - 36} />
    </>
  ),

  'check-valve': (
    <>
      <Threads />
      <Body width={90} height={42} rx={5} />
      <line x1={S.cx - 45} y1={S.cy} x2={S.cx + 45} y2={S.cy} strokeDasharray="3 3" opacity={0.4} />
      <path d={`M ${S.cx - 14} ${S.cy - 19} L ${S.cx - 14} ${S.cy + 19}`} strokeWidth={2} />
      <path d={`M ${S.cx - 13} ${S.cy - 17} L ${S.cx + 16} ${S.cy - 5} L ${S.cx + 16} ${S.cy + 5} L ${S.cx - 13} ${S.cy + 17}`} className="text-accent" strokeWidth={1.8} />
      <path d={`M ${S.cx + 22} ${S.cy - 7} l 10 7 l -10 7`} strokeWidth={1.6} opacity={0.75} />
      {/* spring */}
      <path
        d={`M ${S.cx + 17} ${S.cy} q 4 -7 8 0 q 4 7 8 0 q 4 -7 8 0`}
        strokeWidth={1}
        opacity={0.55}
      />
    </>
  ),

  strainer: (
    <>
      <Threads />
      <Body width={86} height={40} rx={5} />
      <path d={`M ${S.cx + 4} ${S.cy + 18} L ${S.cx + 34} ${S.cy + 52} L ${S.cx + 12} ${S.cy + 52} L ${S.cx - 12} ${S.cy + 18}`} />
      <g className="text-accent" strokeWidth={1} opacity={0.9}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={S.cx - 6 + i * 7} y1={S.cy + 20} x2={S.cx + 12 + i * 5} y2={S.cy + 48} />
        ))}
      </g>
      <rect x={S.cx + 14} y={S.cy + 50} width={18} height={8} rx={2} />
    </>
  ),

  'control-valve': (
    <>
      <Flanges y={S.cy + 22} height={22} offset={54} />
      <Body width={78} height={34} rx={4} />
      <rect x={S.cx - 39} y={S.cy + 8} width={78} height={28} rx={4} />
      <line x1={S.cx} y1={S.cy + 8} x2={S.cx} y2={S.cy - 18} strokeWidth={2.2} />
      <rect x={S.cx - 30} y={S.cy - 56} width={60} height={38} rx={5} className="text-accent" strokeWidth={1.8} />
      <line x1={S.cx - 22} y1={S.cy - 46} x2={S.cx + 22} y2={S.cy - 46} strokeWidth={1} opacity={0.6} />
      <line x1={S.cx - 22} y1={S.cy - 38} x2={S.cx + 8} y2={S.cy - 38} strokeWidth={1} opacity={0.6} />
      <line x1={S.cx - 22} y1={S.cy - 30} x2={S.cx + 14} y2={S.cy - 30} strokeWidth={1} opacity={0.6} />
    </>
  ),

  pump: (
    <>
      {/* volute */}
      <circle cx={S.cx - 22} cy={S.cy} r={30} />
      <circle cx={S.cx - 22} cy={S.cy} r={15} strokeDasharray="2 3" opacity={0.55} />
      <path
        d={`M ${S.cx - 22} ${S.cy} m -9 0 a 9 9 0 1 1 9 9`}
        className="text-accent"
        strokeWidth={1.8}
      />
      {/* discharge */}
      <rect x={S.cx - 34} y={S.cy - 56} width={24} height={28} rx={2} />
      <rect x={S.cx - 38} y={S.cy - 60} width={32} height={6} rx={1} />
      {/* motor */}
      <rect x={S.cx + 8} y={S.cy - 22} width={62} height={44} rx={6} />
      <g strokeWidth={0.9} opacity={0.5}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={S.cx + 18 + i * 9} y1={S.cy - 22} x2={S.cx + 18 + i * 9} y2={S.cy + 22} />
        ))}
      </g>
      <rect x={S.cx - 10} y={S.cy - 9} width={20} height={18} rx={2} />
      {/* baseplate */}
      <line x1={S.cx - 58} y1={S.cy + 40} x2={S.cx + 76} y2={S.cy + 40} strokeWidth={2.2} />
      <line x1={S.cx + 30} y1={S.cy + 22} x2={S.cx + 30} y2={S.cy + 40} opacity={0.6} />
    </>
  ),

  'pump-submersible': (
    <>
      <rect x={S.cx - 24} y={S.cy - 56} width={48} height={72} rx={8} />
      <g strokeWidth={0.9} opacity={0.5}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={S.cx - 24} y1={S.cy - 46 + i * 12} x2={S.cx + 24} y2={S.cy - 46 + i * 12} />
        ))}
      </g>
      <path d={`M ${S.cx - 28} ${S.cy + 16} L ${S.cx + 28} ${S.cy + 16} L ${S.cx + 20} ${S.cy + 46} L ${S.cx - 20} ${S.cy + 46} Z`} className="text-accent" strokeWidth={1.8} />
      <g strokeWidth={0.9} opacity={0.7}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={S.cx - 22 + i * 14} y1={S.cy + 20} x2={S.cx - 18 + i * 13} y2={S.cy + 42} />
        ))}
      </g>
      <rect x={S.cx - 8} y={S.cy - 68} width={16} height={12} rx={2} />
      <path d={`M ${S.cx} ${S.cy - 68} q 22 -8 30 6`} strokeWidth={1.4} opacity={0.7} />
    </>
  ),

  'pump-dosing': (
    <>
      <rect x={S.cx - 40} y={S.cy - 34} width={62} height={50} rx={6} />
      <circle cx={S.cx + 34} cy={S.cy - 4} r={18} className="text-accent" strokeWidth={1.8} />
      <circle cx={S.cx + 34} cy={S.cy - 4} r={9} opacity={0.6} />
      <line x1={S.cx + 34} y1={S.cy - 22} x2={S.cx + 34} y2={S.cy - 40} />
      <line x1={S.cx + 34} y1={S.cy + 14} x2={S.cx + 34} y2={S.cy + 34} />
      <rect x={S.cx - 30} y={S.cy - 24} width={42} height={16} rx={2} opacity={0.7} />
      <g strokeWidth={0.9} opacity={0.55}>
        <line x1={S.cx - 30} y1={S.cy + 2} x2={S.cx + 6} y2={S.cy + 2} />
        <line x1={S.cx - 30} y1={S.cy + 9} x2={S.cx - 6} y2={S.cy + 9} />
      </g>
    </>
  ),

  'booster-set': (
    <>
      <line x1={S.cx - 66} y1={S.cy + 34} x2={S.cx + 66} y2={S.cy + 34} strokeWidth={2.4} />
      {[-44, 0, 44].map((dx) => (
        <g key={dx}>
          <rect x={S.cx + dx - 13} y={S.cy - 34} width={26} height={54} rx={4} />
          <circle cx={S.cx + dx} cy={S.cy - 20} r={6} opacity={0.6} />
          <line x1={S.cx + dx} y1={S.cy + 20} x2={S.cx + dx} y2={S.cy + 34} />
        </g>
      ))}
      <line x1={S.cx - 62} y1={S.cy - 44} x2={S.cx + 62} y2={S.cy - 44} strokeWidth={2.4} className="text-accent" />
      {[-44, 0, 44].map((dx) => (
        <line key={dx} x1={S.cx + dx} y1={S.cy - 44} x2={S.cx + dx} y2={S.cy - 34} />
      ))}
      <rect x={S.cx + 52} y={S.cy - 58} width={20} height={16} rx={2} />
    </>
  ),

  ahu: (
    <>
      <rect x={22} y={S.cy - 42} width={156} height={84} rx={4} />
      {[62, 100, 138].map((x) => (
        <line key={x} x1={x} y1={S.cy - 42} x2={x} y2={S.cy + 42} opacity={0.55} />
      ))}
      {/* filter section */}
      <g strokeWidth={0.9} opacity={0.6}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M ${30 + i * 5} ${S.cy - 34} l 4 8 l -4 8 l 4 8 l -4 8 l 4 8 l -4 8`} />
        ))}
      </g>
      {/* coil section */}
      <g className="text-accent" strokeWidth={1.2}>
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M 68 ${S.cy - 32 + i * 18} q 12 -9 24 0 q 12 9 24 0`} />
        ))}
      </g>
      {/* fan section */}
      <circle cx={158} cy={S.cy} r={24} />
      <circle cx={158} cy={S.cy} r={6} />
      {[0, 72, 144, 216, 288].map((angle) => {
        const rad = (angle * Math.PI) / 180
        return (
          <line key={angle} x1={158} y1={S.cy} x2={158 + Math.cos(rad) * 22} y2={S.cy + Math.sin(rad) * 22} opacity={0.7} />
        )
      })}
      {/* ducts */}
      <rect x={6} y={S.cy - 18} width={16} height={36} rx={2} opacity={0.8} />
      <rect x={178} y={S.cy - 18} width={16} height={36} rx={2} opacity={0.8} />
    </>
  ),

  fcu: (
    <>
      <rect x={26} y={S.cy - 28} width={148} height={56} rx={4} />
      <line x1={26} y1={S.cy + 14} x2={174} y2={S.cy + 14} opacity={0.5} />
      <g className="text-accent" strokeWidth={1.2}>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M 44 ${S.cy - 20 + i * 12} q 14 -8 28 0 q 14 8 28 0 q 14 -8 28 0`} />
        ))}
      </g>
      <circle cx={140} cy={S.cy - 4} r={14} />
      <circle cx={140} cy={S.cy - 4} r={4} />
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180
        return <line key={angle} x1={140} y1={S.cy - 4} x2={140 + Math.cos(rad) * 12} y2={S.cy - 4 + Math.sin(rad) * 12} opacity={0.65} />
      })}
      <g strokeWidth={1} opacity={0.6}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={i} x1={40 + i * 16} y1={S.cy + 18} x2={36 + i * 16} y2={S.cy + 26} />
        ))}
      </g>
      <line x1={30} y1={S.cy - 34} x2={30} y2={S.cy - 44} />
      <line x1={170} y1={S.cy - 34} x2={170} y2={S.cy - 44} />
    </>
  ),

  fan: (
    <>
      <circle cx={S.cx} cy={S.cy} r={46} />
      <circle cx={S.cx} cy={S.cy} r={38} strokeDasharray="2 4" opacity={0.45} />
      <circle cx={S.cx} cy={S.cy} r={13} />
      {[0, 60, 120, 180, 240, 300].map((angle) => {
        const rad = (angle * Math.PI) / 180
        const rad2 = ((angle + 34) * Math.PI) / 180
        return (
          <path
            key={angle}
            d={`M ${S.cx + Math.cos(rad) * 13} ${S.cy + Math.sin(rad) * 13}
                Q ${S.cx + Math.cos(rad2) * 30} ${S.cy + Math.sin(rad2) * 30}
                  ${S.cx + Math.cos(rad2) * 37} ${S.cy + Math.sin(rad2) * 37}`}
            className="text-accent"
            strokeWidth={1.5}
          />
        )
      })}
      <rect x={S.cx - 52} y={S.cy - 16} width={8} height={32} rx={1} opacity={0.75} />
      <rect x={S.cx + 44} y={S.cy - 16} width={8} height={32} rx={1} opacity={0.75} />
    </>
  ),

  filter: (
    <>
      <rect x={38} y={S.cy - 44} width={124} height={88} rx={3} />
      <rect x={44} y={S.cy - 38} width={112} height={76} rx={2} opacity={0.5} />
      <g className="text-accent" strokeWidth={1.3}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path key={i} d={`M ${52 + i * 13} ${S.cy - 32} l 6 12 l -6 12 l 6 12 l -6 12 l 6 12`} />
        ))}
      </g>
      <line x1={38} y1={S.cy - 44} x2={162} y2={S.cy - 44} strokeWidth={2} />
      <line x1={38} y1={S.cy + 44} x2={162} y2={S.cy + 44} strokeWidth={2} />
    </>
  ),

  breaker: (
    <>
      <rect x={S.cx - 40} y={S.cy - 50} width={80} height={100} rx={5} />
      <rect x={S.cx - 26} y={S.cy - 22} width={52} height={30} rx={3} className="text-accent" strokeWidth={1.8} />
      <line x1={S.cx - 14} y1={S.cy - 7} x2={S.cx + 14} y2={S.cy - 7} strokeWidth={2.4} />
      {[-24, 0, 24].map((dx) => (
        <g key={dx}>
          <rect x={S.cx + dx - 8} y={S.cy - 50} width={16} height={14} rx={1} opacity={0.75} />
          <rect x={S.cx + dx - 8} y={S.cy + 36} width={16} height={14} rx={1} opacity={0.75} />
        </g>
      ))}
      <g strokeWidth={0.9} opacity={0.5}>
        <line x1={S.cx - 30} y1={S.cy + 18} x2={S.cx + 30} y2={S.cy + 18} />
        <line x1={S.cx - 30} y1={S.cy + 26} x2={S.cx + 12} y2={S.cy + 26} />
      </g>
    </>
  ),

  'breaker-mcb': (
    <>
      <path d={`M ${S.cx - 22} ${S.cy - 52} L ${S.cx + 22} ${S.cy - 52} L ${S.cx + 22} ${S.cy + 30} L ${S.cx + 10} ${S.cy + 42} L ${S.cx + 10} ${S.cy + 52} L ${S.cx - 22} ${S.cy + 52} Z`} />
      <rect x={S.cx - 10} y={S.cy - 30} width={20} height={26} rx={2} className="text-accent" strokeWidth={1.8} />
      <line x1={S.cx - 4} y1={S.cy - 17} x2={S.cx + 4} y2={S.cy - 17} strokeWidth={2.2} />
      <rect x={S.cx - 16} y={S.cy - 60} width={12} height={10} rx={1} opacity={0.75} />
      <rect x={S.cx - 16} y={S.cy + 52} width={12} height={10} rx={1} opacity={0.75} />
      <g strokeWidth={0.9} opacity={0.45}>
        <line x1={S.cx - 16} y1={S.cy + 6} x2={S.cx + 16} y2={S.cy + 6} />
        <line x1={S.cx - 16} y1={S.cy + 14} x2={S.cx + 8} y2={S.cy + 14} />
      </g>
    </>
  ),

  contactor: (
    <>
      <rect x={S.cx - 34} y={S.cy - 40} width={68} height={80} rx={4} />
      <rect x={S.cx - 24} y={S.cy - 16} width={48} height={32} rx={2} className="text-accent" strokeWidth={1.6} />
      {[-20, 0, 20].map((dx) => (
        <g key={dx}>
          <line x1={S.cx + dx} y1={S.cy - 40} x2={S.cx + dx} y2={S.cy - 16} strokeWidth={1.6} />
          <line x1={S.cx + dx} y1={S.cy + 16} x2={S.cx + dx} y2={S.cy + 40} strokeWidth={1.6} />
        </g>
      ))}
      <g strokeWidth={1} opacity={0.6}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={S.cx - 20 + i * 10} y1={S.cy - 10} x2={S.cx - 20 + i * 10} y2={S.cy + 10} />
        ))}
      </g>
    </>
  ),

  'distribution-board': (
    <>
      <rect x={26} y={S.cy - 52} width={148} height={104} rx={4} />
      <rect x={34} y={S.cy - 44} width={132} height={88} rx={2} opacity={0.5} />
      <line x1={100} y1={S.cy - 44} x2={100} y2={S.cy + 44} className="text-accent" strokeWidth={2} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <rect x={44 + i * 8} y={S.cy - 34} width={6} height={22} rx={1} opacity={0.8} />
          <rect x={112 + i * 8} y={S.cy - 34} width={6} height={22} rx={1} opacity={0.8} />
        </g>
      ))}
      <line x1={40} y1={S.cy + 6} x2={160} y2={S.cy + 6} strokeWidth={1.6} opacity={0.7} />
      <line x1={40} y1={S.cy + 20} x2={160} y2={S.cy + 20} strokeWidth={1.6} opacity={0.7} />
      <circle cx={170} cy={S.cy} r={3} />
    </>
  ),

  'cable-tray': (
    <>
      <path d={`M 24 ${S.cy - 26} L 24 ${S.cy + 22} L 176 ${S.cy + 4} L 176 ${S.cy - 44}`} />
      <path d={`M 24 ${S.cy - 26} L 176 ${S.cy - 44}`} opacity={0.5} />
      <path d={`M 34 ${S.cy + 21} L 34 ${S.cy - 5} M 176 ${S.cy + 4} L 176 ${S.cy - 44}`} opacity={0.6} />
      <g className="text-accent" strokeWidth={1.1} opacity={0.85}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <ellipse key={i} cx={38 + i * 16} cy={S.cy + 16 - i * 2.6} rx={3.4} ry={2.2} />
        ))}
      </g>
      <g strokeWidth={0.9} opacity={0.45}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={50 + i * 34} y1={S.cy + 19 - i * 5.6} x2={50 + i * 34} y2={S.cy - 3 - i * 5.6} />
        ))}
      </g>
    </>
  ),

  sprinkler: (
    <>
      <rect x={S.cx - 12} y={S.cy - 56} width={24} height={26} rx={2} />
      <Threads y={S.cy - 43} height={18} offset={0} />
      <path d={`M ${S.cx - 16} ${S.cy - 30} L ${S.cx - 16} ${S.cy + 8} M ${S.cx + 16} ${S.cy - 30} L ${S.cx + 16} ${S.cy + 8}`} />
      <line x1={S.cx - 28} y1={S.cy + 8} x2={S.cx + 28} y2={S.cy + 8} strokeWidth={2.2} />
      <path d={`M ${S.cx - 22} ${S.cy + 8} l -6 10 M ${S.cx + 22} ${S.cy + 8} l 6 10`} strokeWidth={1.6} />
      {/* glass bulb */}
      <ellipse cx={S.cx} cy={S.cy - 12} rx={4.5} ry={13} className="text-accent" strokeWidth={1.8} />
      <line x1={S.cx} y1={S.cy - 30} x2={S.cx} y2={S.cy - 25} />
      <g strokeWidth={0.9} opacity={0.4}>
        {[-34, -18, 18, 34].map((dx) => (
          <path key={dx} d={`M ${S.cx + dx} ${S.cy + 22} q ${dx / 4} 12 ${dx / 2.5} 20`} />
        ))}
      </g>
    </>
  ),

  hydrant: (
    <>
      <rect x={S.cx - 14} y={S.cy - 4} width={28} height={50} rx={3} />
      <rect x={S.cx - 26} y={S.cy + 42} width={52} height={8} rx={1} />
      <g>
        <rect x={S.cx - 62} y={S.cy - 26} width={44} height={26} rx={4} className="text-accent" strokeWidth={1.8} />
        <rect x={S.cx + 18} y={S.cy - 26} width={44} height={26} rx={4} className="text-accent" strokeWidth={1.8} />
        <circle cx={S.cx - 40} cy={S.cy - 13} r={7} />
        <circle cx={S.cx + 40} cy={S.cy - 13} r={7} />
      </g>
      <line x1={S.cx - 18} y1={S.cy - 13} x2={S.cx - 14} y2={S.cy - 13} />
      <line x1={S.cx + 14} y1={S.cy - 13} x2={S.cx + 18} y2={S.cy - 13} />
      <circle cx={S.cx} cy={S.cy - 40} r={15} strokeWidth={1.8} />
      <line x1={S.cx - 15} y1={S.cy - 40} x2={S.cx + 15} y2={S.cy - 40} />
      <line x1={S.cx} y1={S.cy - 25} x2={S.cx} y2={S.cy - 4} />
    </>
  ),

  hose: (
    <>
      <circle cx={S.cx} cy={S.cy} r={46} />
      <circle cx={S.cx} cy={S.cy} r={34} opacity={0.6} />
      <circle cx={S.cx} cy={S.cy} r={22} opacity={0.45} />
      <circle cx={S.cx} cy={S.cy} r={11} className="text-accent" strokeWidth={1.8} />
      <path d={`M ${S.cx + 46} ${S.cy} q 20 4 26 22`} strokeWidth={2.4} />
      <rect x={S.cx + 66} y={S.cy + 20} width={14} height={10} rx={2} className="text-accent" strokeWidth={1.6} />
      <g strokeWidth={0.8} opacity={0.35}>
        {[0, 45, 90, 135].map((angle) => {
          const rad = (angle * Math.PI) / 180
          return (
            <line
              key={angle}
              x1={S.cx + Math.cos(rad) * 11}
              y1={S.cy + Math.sin(rad) * 11}
              x2={S.cx + Math.cos(rad) * 46}
              y2={S.cy + Math.sin(rad) * 46}
            />
          )
        })}
      </g>
    </>
  ),

  'flow-switch': (
    <>
      <line x1={16} y1={S.cy + 20} x2={184} y2={S.cy + 20} strokeWidth={2.4} />
      <line x1={16} y1={S.cy + 46} x2={184} y2={S.cy + 46} strokeWidth={2.4} />
      <rect x={S.cx - 26} y={S.cy - 46} width={52} height={50} rx={4} />
      <line x1={S.cx} y1={S.cy + 4} x2={S.cx} y2={S.cy + 20} strokeWidth={2} />
      <path d={`M ${S.cx - 8} ${S.cy + 22} L ${S.cx + 8} ${S.cy + 22} L ${S.cx + 4} ${S.cy + 42} L ${S.cx - 4} ${S.cy + 42} Z`} className="text-accent" strokeWidth={1.6} />
      <g strokeWidth={0.9} opacity={0.5}>
        <line x1={S.cx - 18} y1={S.cy - 34} x2={S.cx + 18} y2={S.cy - 34} />
        <line x1={S.cx - 18} y1={S.cy - 26} x2={S.cx + 6} y2={S.cy - 26} />
      </g>
      <path d={`M 36 ${S.cy + 33} l 12 0 m 6 0 l 12 0`} className="text-accent" strokeWidth={1.4} opacity={0.8} />
      <path d={`M 62 ${S.cy + 29} l 6 4 l -6 4`} className="text-accent" strokeWidth={1.4} opacity={0.8} />
    </>
  ),

  gauge: (
    <>
      <circle cx={S.cx} cy={S.cy - 8} r={44} strokeWidth={2} />
      <circle cx={S.cx} cy={S.cy - 8} r={37} opacity={0.5} />
      {Array.from({ length: 11 }, (_, i) => {
        const angle = (225 - i * 27) * (Math.PI / 180)
        const long = i % 2 === 0
        return (
          <line
            key={i}
            x1={S.cx + Math.cos(angle) * 33}
            y1={S.cy - 8 - Math.sin(angle) * 33}
            x2={S.cx + Math.cos(angle) * (long ? 25 : 28)}
            y2={S.cy - 8 - Math.sin(angle) * (long ? 25 : 28)}
            strokeWidth={long ? 1.6 : 0.9}
            opacity={long ? 0.9 : 0.55}
          />
        )
      })}
      <line
        x1={S.cx}
        y1={S.cy - 8}
        x2={S.cx + Math.cos((225 - 5 * 27) * (Math.PI / 180)) * 28}
        y2={S.cy - 8 - Math.sin((225 - 5 * 27) * (Math.PI / 180)) * 28}
        className="text-accent"
        strokeWidth={2.4}
      />
      <circle cx={S.cx} cy={S.cy - 8} r={4} className="text-accent" strokeWidth={2} />
      <rect x={S.cx - 8} y={S.cy + 36} width={16} height={14} rx={1} />
      <Threads y={S.cy + 50} height={14} offset={0} />
    </>
  ),

  thermometer: (
    <>
      <circle cx={S.cx} cy={S.cy - 16} r={40} strokeWidth={2} />
      <circle cx={S.cx} cy={S.cy - 16} r={33} opacity={0.5} />
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (210 - i * 30) * (Math.PI / 180)
        return (
          <line
            key={i}
            x1={S.cx + Math.cos(angle) * 30}
            y1={S.cy - 16 - Math.sin(angle) * 30}
            x2={S.cx + Math.cos(angle) * 23}
            y2={S.cy - 16 - Math.sin(angle) * 23}
            strokeWidth={1.3}
            opacity={0.8}
          />
        )
      })}
      <line
        x1={S.cx}
        y1={S.cy - 16}
        x2={S.cx + Math.cos((210 - 3 * 30) * (Math.PI / 180)) * 25}
        y2={S.cy - 16 - Math.sin((210 - 3 * 30) * (Math.PI / 180)) * 25}
        className="text-accent"
        strokeWidth={2.2}
      />
      <rect x={S.cx - 5} y={S.cy + 24} width={10} height={40} rx={2} />
      <line x1={S.cx - 5} y1={S.cy + 36} x2={S.cx + 5} y2={S.cy + 36} opacity={0.6} />
      <line x1={S.cx - 5} y1={S.cy + 48} x2={S.cx + 5} y2={S.cy + 48} opacity={0.6} />
    </>
  ),

  transmitter: (
    <>
      <rect x={S.cx - 30} y={S.cy - 52} width={60} height={44} rx={6} />
      <rect x={S.cx - 20} y={S.cy - 44} width={40} height={20} rx={2} className="text-accent" strokeWidth={1.6} />
      <g strokeWidth={0.9} opacity={0.55}>
        <line x1={S.cx - 14} y1={S.cy - 18} x2={S.cx + 14} y2={S.cy - 18} />
      </g>
      <path d={`M ${S.cx - 16} ${S.cy - 8} L ${S.cx - 10} ${S.cy + 16} L ${S.cx + 10} ${S.cy + 16} L ${S.cx + 16} ${S.cy - 8} Z`} />
      <rect x={S.cx - 12} y={S.cy + 16} width={24} height={18} rx={2} />
      <Threads y={S.cy + 42} height={16} offset={0} />
      <path d={`M ${S.cx + 30} ${S.cy - 40} q 14 0 14 14`} strokeWidth={1.2} opacity={0.6} />
      <path d={`M ${S.cx + 30} ${S.cy - 46} q 22 0 22 20`} strokeWidth={1.2} opacity={0.4} />
    </>
  ),

  'flow-meter': (
    <>
      <Flanges height={44} offset={54} />
      <rect x={S.cx - 48} y={S.cy - 22} width={96} height={44} rx={3} />
      <line x1={S.cx - 48} y1={S.cy} x2={S.cx + 48} y2={S.cy} strokeDasharray="4 3" opacity={0.4} />
      <rect x={S.cx - 32} y={S.cy - 64} width={64} height={42} rx={5} />
      <rect x={S.cx - 22} y={S.cy - 56} width={44} height={20} rx={2} className="text-accent" strokeWidth={1.6} />
      <g strokeWidth={0.9} opacity={0.5}>
        <line x1={S.cx - 16} y1={S.cy - 30} x2={S.cx + 16} y2={S.cy - 30} />
      </g>
      <g className="text-accent" strokeWidth={1.4} opacity={0.85}>
        <path d={`M ${S.cx - 34} ${S.cy} l 16 0`} />
        <path d={`M ${S.cx - 22} ${S.cy - 4} l 5 4 l -5 4`} />
      </g>
    </>
  ),

  pipe: (
    <>
      <path d={`M 20 ${S.cy - 26} L 180 ${S.cy - 26}`} strokeWidth={2} />
      <path d={`M 20 ${S.cy + 26} L 180 ${S.cy + 26}`} strokeWidth={2} />
      <ellipse cx={20} cy={S.cy} rx={8} ry={26} />
      <ellipse cx={180} cy={S.cy} rx={8} ry={26} className="text-accent" strokeWidth={1.8} />
      <ellipse cx={180} cy={S.cy} rx={5} ry={19} opacity={0.55} />
      <line x1={20} y1={S.cy} x2={180} y2={S.cy} strokeDasharray="5 4" opacity={0.35} />
      <g strokeWidth={0.9} opacity={0.35}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={46 + i * 24} y1={S.cy - 26} x2={40 + i * 24} y2={S.cy - 20} />
        ))}
      </g>
    </>
  ),

  insulation: (
    <>
      <ellipse cx={S.cx} cy={S.cy} rx={54} ry={44} />
      <ellipse cx={S.cx} cy={S.cy} rx={34} ry={26} className="text-accent" strokeWidth={1.8} />
      <ellipse cx={S.cx} cy={S.cy} rx={28} ry={20} opacity={0.5} />
      <g strokeWidth={0.8} opacity={0.4}>
        {Array.from({ length: 16 }, (_, i) => {
          const angle = (i * 22.5 * Math.PI) / 180
          return (
            <line
              key={i}
              x1={S.cx + Math.cos(angle) * 34}
              y1={S.cy + Math.sin(angle) * 26}
              x2={S.cx + Math.cos(angle) * 54}
              y2={S.cy + Math.sin(angle) * 44}
            />
          )
        })}
      </g>
      <line x1={S.cx} y1={S.cy - 44} x2={S.cx} y2={S.cy - 26} strokeWidth={2} />
    </>
  ),

  clamp: (
    <>
      <path d={`M ${S.cx - 40} ${S.cy + 6} a 40 40 0 0 1 80 0`} strokeWidth={2.4} />
      <path d={`M ${S.cx - 40} ${S.cy + 6} a 40 40 0 0 0 80 0`} strokeWidth={2.4} />
      <circle cx={S.cx} cy={S.cy + 6} r={30} className="text-accent" strokeWidth={1.6} opacity={0.9} />
      <rect x={S.cx - 52} y={S.cy - 2} width={16} height={16} rx={2} />
      <rect x={S.cx + 36} y={S.cy - 2} width={16} height={16} rx={2} />
      <line x1={S.cx} y1={S.cy - 34} x2={S.cx} y2={S.cy - 58} strokeWidth={2.4} />
      <g strokeWidth={0.9} opacity={0.6}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={S.cx - 4} y1={S.cy - 54 + i * 5} x2={S.cx + 4} y2={S.cy - 56 + i * 5} />
        ))}
      </g>
    </>
  ),

  compressor: (
    <>
      <rect x={26} y={S.cy - 44} width={110} height={78} rx={6} />
      <g strokeWidth={0.9} opacity={0.45}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={i} x1={38 + i * 8} y1={S.cy - 34} x2={38 + i * 8} y2={S.cy + 24} />
        ))}
      </g>
      <circle cx={104} cy={S.cy - 8} r={20} className="text-accent" strokeWidth={1.8} />
      <circle cx={104} cy={S.cy - 8} r={7} />
      <ellipse cx={166} cy={S.cy - 2} rx={22} ry={36} />
      <line x1={166} y1={S.cy - 38} x2={166} y2={S.cy + 34} strokeDasharray="4 3" opacity={0.35} />
      <line x1={136} y1={S.cy - 20} x2={144} y2={S.cy - 20} strokeWidth={2} />
      <line x1={26} y1={S.cy + 34} x2={188} y2={S.cy + 34} strokeWidth={2.2} />
    </>
  ),

  motor: (
    <>
      <rect x={44} y={S.cy - 34} width={108} height={68} rx={10} />
      <g strokeWidth={1} opacity={0.5}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line key={i} x1={56 + i * 11} y1={S.cy - 34} x2={56 + i * 11} y2={S.cy + 34} />
        ))}
      </g>
      <rect x={152} y={S.cy - 8} width={30} height={16} rx={2} className="text-accent" strokeWidth={1.8} />
      <rect x={30} y={S.cy - 18} width={14} height={36} rx={2} />
      <rect x={72} y={S.cy - 50} width={40} height={18} rx={3} />
      <line x1={44} y1={S.cy + 40} x2={152} y2={S.cy + 40} strokeWidth={2.2} />
      <line x1={60} y1={S.cy + 34} x2={60} y2={S.cy + 40} />
      <line x1={136} y1={S.cy + 34} x2={136} y2={S.cy + 40} />
    </>
  ),

  vfd: (
    <>
      <rect x={S.cx - 38} y={S.cy - 54} width={76} height={108} rx={5} />
      <rect x={S.cx - 26} y={S.cy - 44} width={52} height={26} rx={2} className="text-accent" strokeWidth={1.8} />
      <g strokeWidth={1} opacity={0.55}>
        <line x1={S.cx - 18} y1={S.cy - 36} x2={S.cx + 6} y2={S.cy - 36} />
        <line x1={S.cx - 18} y1={S.cy - 28} x2={S.cx + 14} y2={S.cy - 28} />
      </g>
      {[0, 1].map((row) =>
        [0, 1, 2].map((col) => (
          <circle key={`${row}-${col}`} cx={S.cx - 18 + col * 18} cy={S.cy - 6 + row * 16} r={5} opacity={0.7} />
        ))
      )}
      <g strokeWidth={0.9} opacity={0.4}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={S.cx - 30} y1={S.cy + 28 + i * 4} x2={S.cx + 30} y2={S.cy + 28 + i * 4} />
        ))}
      </g>
    </>
  ),

  hoist: (
    <>
      <path d={`M ${S.cx} ${S.cy - 62} a 10 10 0 1 1 0 20`} strokeWidth={2.2} />
      <line x1={S.cx} y1={S.cy - 42} x2={S.cx} y2={S.cy - 30} />
      <rect x={S.cx - 30} y={S.cy - 30} width={60} height={44} rx={6} />
      <circle cx={S.cx} cy={S.cy - 8} r={13} className="text-accent" strokeWidth={1.8} />
      <circle cx={S.cx} cy={S.cy - 8} r={5} />
      <g strokeWidth={1.4} opacity={0.85}>
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={i} cx={S.cx - 14} cy={S.cy + 22 + i * 11} rx={4} ry={6} />
        ))}
      </g>
      <path d={`M ${S.cx + 14} ${S.cy + 14} l 0 34 a 9 9 0 1 0 12 0`} strokeWidth={2} />
    </>
  ),

  'torque-wrench': (
    <>
      <rect x={30} y={S.cy - 9} width={122} height={18} rx={9} />
      <g strokeWidth={0.9} opacity={0.5}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={i} x1={46 + i * 12} y1={S.cy - 9} x2={46 + i * 12} y2={S.cy - 2} />
        ))}
      </g>
      <rect x={36} y={S.cy - 5} width={34} height={10} rx={2} className="text-accent" strokeWidth={1.4} />
      <circle cx={162} cy={S.cy} r={22} strokeWidth={2} />
      <rect x={155} y={S.cy - 7} width={14} height={14} rx={2} className="text-accent" strokeWidth={1.8} />
      <line x1={140} y1={S.cy} x2={152} y2={S.cy} />
      <rect x={24} y={S.cy - 12} width={12} height={24} rx={3} />
    </>
  ),

  wrench: (
    <>
      <rect x={62} y={S.cy - 7} width={100} height={14} rx={4} transform={`rotate(-14 ${S.cx} ${S.cy})`} />
      <path
        d={`M 66 ${S.cy - 24} L 40 ${S.cy - 30} L 30 ${S.cy - 14} L 42 ${S.cy - 2} L 66 ${S.cy - 6} Z`}
        transform={`rotate(-14 ${S.cx} ${S.cy})`}
      />
      <path
        d={`M 52 ${S.cy + 6} L 30 ${S.cy + 12} L 34 ${S.cy + 26} L 58 ${S.cy + 22}`}
        className="text-accent"
        strokeWidth={1.8}
        transform={`rotate(-14 ${S.cx} ${S.cy})`}
      />
      <g strokeWidth={0.9} opacity={0.5} transform={`rotate(-14 ${S.cx} ${S.cy})`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={74 + i * 7} y1={S.cy - 7} x2={74 + i * 7} y2={S.cy + 7} />
        ))}
      </g>
    </>
  ),

  'clamp-meter': (
    <>
      <path d={`M ${S.cx - 26} ${S.cy - 18} a 28 28 0 1 1 52 0`} strokeWidth={2.4} className="text-accent" />
      <path d={`M ${S.cx - 26} ${S.cy - 18} l 0 12 M ${S.cx + 26} ${S.cy - 18} l 0 12`} strokeWidth={2.4} />
      <rect x={S.cx - 28} y={S.cy - 8} width={56} height={62} rx={7} />
      <rect x={S.cx - 19} y={S.cy + 2} width={38} height={22} rx={2} />
      <g strokeWidth={1.2} opacity={0.65}>
        <line x1={S.cx - 12} y1={S.cy + 13} x2={S.cx + 12} y2={S.cy + 13} />
      </g>
      <circle cx={S.cx} cy={S.cy + 38} r={9} />
      <line x1={S.cx} y1={S.cy + 29} x2={S.cx} y2={S.cy + 34} />
    </>
  ),

  gloves: (
    <>
      <path
        d={`M 72 ${S.cy + 48} L 72 ${S.cy - 6}
            q 0 -12 9 -12 q 9 0 9 12
            l 0 -22 q 0 -12 9 -12 q 9 0 9 12
            l 0 20 q 0 -14 9 -14 q 9 0 9 14
            l 0 8 q 2 -10 10 -8 q 8 2 6 14
            l -6 42 Z`}
        strokeWidth={1.8}
      />
      <path d={`M 72 ${S.cy + 30} L 128 ${S.cy + 30}`} className="text-accent" strokeWidth={1.8} />
      <g strokeWidth={0.8} opacity={0.4}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line key={i} x1={76} y1={S.cy + 34 + i * 3} x2={126} y2={S.cy + 34 + i * 3} />
        ))}
      </g>
      <path d={`M 68 ${S.cy + 48} L 132 ${S.cy + 48}`} strokeWidth={2.2} />
    </>
  ),

  helmet: (
    <>
      <path d={`M 48 ${S.cy + 18} a 52 52 0 0 1 104 0`} strokeWidth={2.2} />
      <path d={`M 34 ${S.cy + 18} L 166 ${S.cy + 18}`} strokeWidth={2.2} />
      <path d={`M 34 ${S.cy + 18} q 8 12 26 12 M 166 ${S.cy + 18} q -8 12 -26 12`} opacity={0.7} />
      <path d={`M ${S.cx} ${S.cy - 34} L ${S.cx} ${S.cy + 18}`} className="text-accent" strokeWidth={1.8} />
      <path d={`M 76 ${S.cy - 18} q 24 -10 48 0`} opacity={0.6} />
      <path d={`M 68 ${S.cy - 2} q 32 -12 64 0`} opacity={0.6} />
      <g className="text-accent" strokeWidth={1.4} opacity={0.85}>
        <line x1={62} y1={S.cy + 6} x2={62} y2={S.cy + 14} />
        <line x1={138} y1={S.cy + 6} x2={138} y2={S.cy + 14} />
      </g>
    </>
  ),

  goggles: (
    <>
      <path
        d={`M 34 ${S.cy - 14} q 66 -18 132 0 l 0 30 q -66 18 -132 0 Z`}
        strokeWidth={2}
      />
      <path d={`M 62 ${S.cy - 10} q 38 -10 76 0 l 0 22 q -38 10 -76 0 Z`} className="text-accent" strokeWidth={1.6} />
      <path d={`M 34 ${S.cy - 6} l -18 -6 M 166 ${S.cy - 6} l 18 -6`} strokeWidth={2} />
      <g strokeWidth={0.8} opacity={0.35}>
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={70 + i * 18} y1={S.cy - 8} x2={62 + i * 18} y2={S.cy + 10} />
        ))}
      </g>
    </>
  ),

  harness: (
    <>
      <path d={`M ${S.cx - 26} ${S.cy - 52} L ${S.cx} ${S.cy - 4} L ${S.cx + 26} ${S.cy - 52}`} strokeWidth={2.2} />
      <path d={`M ${S.cx - 26} ${S.cy - 52} L ${S.cx - 30} ${S.cy + 6} M ${S.cx + 26} ${S.cy - 52} L ${S.cx + 30} ${S.cy + 6}`} strokeWidth={2.2} />
      <path d={`M ${S.cx - 34} ${S.cy + 6} L ${S.cx + 34} ${S.cy + 6}`} strokeWidth={2.4} />
      <path d={`M ${S.cx - 30} ${S.cy + 6} L ${S.cx - 22} ${S.cy + 48} M ${S.cx + 30} ${S.cy + 6} L ${S.cx + 22} ${S.cy + 48}`} strokeWidth={2.2} />
      <path d={`M ${S.cx - 24} ${S.cy + 36} L ${S.cx + 24} ${S.cy + 36}`} opacity={0.6} />
      <circle cx={S.cx} cy={S.cy - 18} r={9} className="text-accent" strokeWidth={2} />
      <rect x={S.cx - 8} y={S.cy + 2} width={16} height={9} rx={2} className="text-accent" strokeWidth={1.6} />
    </>
  ),
}

/** Every shape a seed file can reference resolves through here. */
const SHAPE_ALIASES: Record<string, string> = {
  'balancing-valve': 'control-valve',
}

function resolveShape(key: string): ReactNode {
  const aliased = SHAPE_ALIASES[key] ?? key
  return SHAPES[aliased] ?? SHAPES['ball-valve']
}

/* -------------------------------------------------------------------------- */
/* Frame                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The technical-drawing frame: corner registration ticks, a centre line, and a
 * dimension rule. It is what turns a line drawing into something that reads as
 * a specification document rather than clip art.
 */
export function ProductArtwork({
  url,
  label,
  className,
  showFrame = true,
}: {
  url: string
  label: string
  className?: string
  showFrame?: boolean
}) {
  const descriptor = parseArtwork(url)
  if (!descriptor) return null

  const { shape, view, seed } = descriptor
  const gridId = `grid-${shape}-${view}-${seed}`

  // The four gallery views are presentation variants of one drawing, which is
  // what a real product gallery is: the same object, differently annotated.
  const zoom = view === 'detail' ? 1.42 : 1
  const showCentreLine = view === 'section' || view === 'scale'
  const showDimension = view === 'scale'
  const showHatch = view === 'section'

  return (
    <svg
      viewBox={`0 0 ${S.w} ${S.h}`}
      role="img"
      aria-label={label}
      className={cn('h-full w-full', className)}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={gridId} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.35" opacity="0.13" />
        </pattern>
        {showHatch && (
          <pattern id={`${gridId}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="0.7" opacity="0.22" />
          </pattern>
        )}
      </defs>

      <rect width={S.w} height={S.h} fill={`url(#${gridId})`} className="text-muted" />
      {showHatch && (
        <rect x={16} y={16} width={S.w - 32} height={S.h - 32} fill={`url(#${gridId}-hatch)`} className="text-muted" />
      )}

      {showFrame && (
        <g className="text-faint" stroke="currentColor" strokeWidth={0.9} opacity={0.55} fill="none">
          <path d="M 8 18 L 8 8 L 18 8" />
          <path d={`M ${S.w - 18} 8 L ${S.w - 8} 8 L ${S.w - 8} 18`} />
          <path d={`M 8 ${S.h - 18} L 8 ${S.h - 8} L 18 ${S.h - 8}`} />
          <path d={`M ${S.w - 18} ${S.h - 8} L ${S.w - 8} ${S.h - 8} L ${S.w - 8} ${S.h - 18}`} />
        </g>
      )}

      {showCentreLine && (
        <line
          x1={14}
          y1={S.cy}
          x2={S.w - 14}
          y2={S.cy}
          stroke="currentColor"
          className="text-faint"
          strokeWidth={0.6}
          strokeDasharray="8 3 2 3"
          opacity={0.6}
        />
      )}

      <g
        className="text-text-2"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform={zoom !== 1 ? `translate(${S.cx} ${S.cy}) scale(${zoom}) translate(${-S.cx} ${-S.cy})` : undefined}
      >
        {resolveShape(shape)}
      </g>

      {showDimension && (
        <g className="text-faint" stroke="currentColor" strokeWidth={0.7} fill="none" opacity={0.8}>
          <line x1={34} y1={S.h - 18} x2={S.w - 34} y2={S.h - 18} />
          <path d={`M 34 ${S.h - 22} l 0 8 M ${S.w - 34} ${S.h - 22} l 0 8`} />
          <path d={`M 38 ${S.h - 21} l -4 3 l 4 3 M ${S.w - 38} ${S.h - 21} l 4 3 l -4 3`} />
        </g>
      )}
    </svg>
  )
}
