'use client'

import { useEffect, useReducer, useRef } from 'react'
import { ArrowRight, Check, Search, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MatchRing } from '@/components/ui/match-score'

/**
 * Hero demonstration.
 *
 * Types a real buyer request, resolves it into filter chips, then reveals the
 * products the ranking engine actually returned for that query. The data is
 * computed on the server at build time by the same engine the product uses —
 * nothing here is a mock-up of a result, which is the entire reason the
 * section is worth animating.
 *
 * Honours `prefers-reduced-motion` by jumping straight to the resolved state.
 */

export interface HeroResult {
  sku: string
  name: string
  price: string
  match: number
  spec: string
}

export interface HeroChip {
  qualifier: string
  label: string
}

export interface HeroScenario {
  query: string
  chips: HeroChip[]
  results: HeroResult[]
  totalMatches: number
}

type Phase = 'typing' | 'parsing' | 'results' | 'holding'

interface State {
  scenario: number
  phase: Phase
  typed: number
  chips: number
}

type Action =
  | { type: 'tick-type' }
  | { type: 'advance'; phase: Phase }
  | { type: 'tick-chip' }
  | { type: 'next-scenario' }
  | { type: 'resolve-all' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'tick-type':
      return { ...state, typed: state.typed + 1 }
    case 'advance':
      return { ...state, phase: action.phase }
    case 'tick-chip':
      return { ...state, chips: state.chips + 1 }
    case 'next-scenario':
      return { scenario: state.scenario + 1, phase: 'typing', typed: 0, chips: 0 }
    case 'resolve-all':
      return { ...state, phase: 'holding', typed: Number.MAX_SAFE_INTEGER, chips: Number.MAX_SAFE_INTEGER }
    default:
      return state
  }
}

const TYPE_MS = 26
const CHIP_MS = 130

export function HeroDemo({ scenarios }: { scenarios: HeroScenario[] }) {
  const [state, dispatch] = useReducer(reducer, {
    scenario: 0,
    phase: 'typing',
    typed: 0,
    chips: 0,
  })

  const reduced = useRef(false)

  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced.current) dispatch({ type: 'resolve-all' })
  }, [])

  const active = scenarios[state.scenario % scenarios.length]

  useEffect(() => {
    if (reduced.current || !active) return

    let timer: ReturnType<typeof setTimeout>

    if (state.phase === 'typing') {
      if (state.typed < active.query.length) {
        timer = setTimeout(() => dispatch({ type: 'tick-type' }), TYPE_MS)
      } else {
        timer = setTimeout(() => dispatch({ type: 'advance', phase: 'parsing' }), 420)
      }
    } else if (state.phase === 'parsing') {
      if (state.chips < active.chips.length) {
        timer = setTimeout(() => dispatch({ type: 'tick-chip' }), CHIP_MS)
      } else {
        timer = setTimeout(() => dispatch({ type: 'advance', phase: 'results' }), 380)
      }
    } else if (state.phase === 'results') {
      timer = setTimeout(() => dispatch({ type: 'advance', phase: 'holding' }), 900)
    } else {
      timer = setTimeout(() => dispatch({ type: 'next-scenario' }), 4200)
    }

    return () => clearTimeout(timer)
  }, [state, active])

  if (!active) return null

  const typedText = reduced.current ? active.query : active.query.slice(0, state.typed)
  const showChips = state.phase !== 'typing'
  const showResults = state.phase === 'results' || state.phase === 'holding'
  const visibleChips = reduced.current ? active.chips.length : state.chips

  return (
    <div className="relative">
      {/* Ambient glow, kept extremely low contrast — depth, not decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -top-10 -bottom-6 rounded-[2rem] bg-accent/[0.045] blur-2xl"
      />

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-float">
        {/* Window chrome ------------------------------------------------- */}
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
          <Sparkles className="size-3.5 text-accent" aria-hidden />
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            Sourcely Assistant
          </span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-faint tnum">
            <span
              className={cn(
                'size-1.5 rounded-full',
                showResults ? 'bg-success' : 'bg-accent animate-pulse'
              )}
              aria-hidden
            />
            {showResults ? 'ranked' : state.phase === 'parsing' ? 'parsing' : 'listening'}
          </span>
        </div>

        {/* Query --------------------------------------------------------- */}
        <div className="border-b border-border p-4">
          <div className="flex gap-3">
            <Search className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
            <p className="min-h-[2.75rem] text-[15px] leading-relaxed text-text">
              {typedText}
              {!reduced.current && state.phase === 'typing' && (
                <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-accent animate-caret" aria-hidden />
              )}
            </p>
          </div>
        </div>

        {/* Resolved filters ---------------------------------------------- */}
        <div
          className={cn(
            'overflow-hidden border-b border-border transition-[max-height,opacity] duration-500 ease-out',
            showChips ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="p-4">
            <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
              Understood as
            </p>
            <div className="flex flex-wrap gap-1.5">
              {active.chips.map((chip, i) => (
                <span
                  key={chip.label}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md border border-accent-line bg-accent-soft px-2.5',
                    'transition-[opacity,transform] duration-300 ease-out',
                    i < visibleChips ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                  )}
                >
                  <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">
                    {chip.qualifier}
                  </span>
                  <span className="text-xs font-medium text-text">{chip.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Results -------------------------------------------------------- */}
        <div
          className={cn(
            'transition-opacity duration-500',
            showResults ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-[11px] font-semibold tracking-wide text-faint uppercase">
              {active.totalMatches} matching products
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <Check className="size-3" aria-hidden />
              ranked by specification
            </span>
          </div>

          <ul className="divide-y divide-border">
            {active.results.map((result, i) => (
              <li
                key={result.sku}
                className={cn(
                  'flex items-center gap-3.5 px-4 py-3 transition-[opacity,transform] duration-400 ease-out',
                  showResults ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
                )}
                style={{ transitionDelay: showResults ? `${i * 90}ms` : '0ms' }}
              >
                <MatchRing percent={result.match} size={38} strokeWidth={2.5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-text">{result.name}</p>
                  <p className="truncate font-mono text-[11px] text-faint tnum">
                    {result.sku} · {result.spec}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-text tnum">
                  {result.price}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1.5 border-t border-border px-4 py-3 text-[12px] text-muted">
            <ArrowRight className="size-3.5 text-accent" aria-hidden />
            Every score computed from the specification sheet — not generated.
          </div>
        </div>
      </div>

      {/* Scenario indicator --------------------------------------------- */}
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {scenarios.map((scenario, i) => (
          <span
            key={scenario.query}
            className={cn(
              'h-1 rounded-full transition-all duration-500',
              i === state.scenario % scenarios.length ? 'w-6 bg-accent' : 'w-1.5 bg-border-strong'
            )}
          />
        ))}
      </div>
    </div>
  )
}
