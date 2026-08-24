import type { Metadata } from 'next'
import { CircleCheck, CircleSlash, Sparkles } from 'lucide-react'
import { requireRole } from '@/server/auth/session'
import { getCatalogRepository } from '@/server/repositories'
import { parseIntentOffline } from '@/server/ai/intent-offline'
import { intentToChips } from '@/server/ai/chips'
import { buildFollowUp } from '@/server/ai/follow-up'
import { resolveProviderName } from '@/server/ai/provider'
import {
  BASE_WEIGHTS,
  CATEGORY_WEIGHT_OVERRIDES,
  COMPONENT_EXPLANATIONS,
  COMPONENT_LABELS,
  MAX_DISPLAY_PERCENT,
  MIN_DISPLAY_PERCENT,
  RELEVANCE_FLOOR,
  weightsFor,
} from '@/server/catalog/ranking-weights'
import { SPEC_DEFINITIONS } from '@/server/catalog/spec-registry'
import type { ScoreComponentKey } from '@/lib/domain/search'
import { formatPercent, formatPrice, pluralize } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MatchRing, ScoreBreakdown } from '@/components/ui/match-score'
import { PageHeader, SectionCard, StatCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Ranking & AI' }

/**
 * Ranking inspector.
 *
 * ARCHITECTURE.md §3.2 promises that the weight model is a product parameter
 * rather than a hidden constant. This is where that promise is kept: the live
 * weights, the per-category overrides, and a query box that runs the real
 * parser and shows the actual score arithmetic behind the top result.
 *
 * Weights are read-only here. Making them editable without a staged rollout and
 * an offline relevance suite would let one operator change every buyer's
 * results with no way to tell whether it helped — see the Phase 6 notes.
 */
export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireRole('staff', '/admin/ai')
  const { q } = await searchParams

  const provider = resolveProviderName()
  const configured = provider === 'claude' && Boolean(process.env.ANTHROPIC_API_KEY)

  const query = q?.trim() ?? ''
  const intent = query ? parseIntentOffline(query) : null
  const ranked = intent ? await getCatalogRepository().rankByIntent(intent, 5) : null
  const chips = intent ? intentToChips(intent) : []
  const followUp =
    intent && ranked ? buildFollowUp(intent, ranked.results.map((r) => r.product)) : null

  const top = ranked?.results[0]
  const criticalSpecs = SPEC_DEFINITIONS.filter((definition) => definition.isCritical)

  return (
    <>
      <PageHeader
        title="Ranking &amp; AI"
        description="The scoring model behind every match percentage, and a live inspector for the parser."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Intent provider"
          value={provider === 'claude' ? 'Claude' : 'Offline'}
          hint={
            provider === 'claude'
              ? configured
                ? 'API key present'
                : 'No API key — falling back'
              : 'Deterministic engine'
          }
          icon={Sparkles}
          tone={provider === 'claude' && configured ? 'accent' : 'neutral'}
        />
        <StatCard
          label="Registered specs"
          value={SPEC_DEFINITIONS.length}
          hint={`${criticalSpecs.length} critical`}
        />
        <StatCard
          label="Relevance floor"
          value={RELEVANCE_FLOOR.toFixed(2)}
          hint="Below this, nothing is shown"
        />
        <StatCard
          label="Match band"
          value={`${MIN_DISPLAY_PERCENT}–${MAX_DISPLAY_PERCENT}%`}
          hint="Never 100 — a claim we cannot support"
        />
      </div>

      {/* Inspector -------------------------------------------------------- */}
      <SectionCard
        title="Query inspector"
        description="Runs the real parser and the real ranking engine. Nothing here is a simulation."
        className="mb-6"
      >
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Input
            name="q"
            defaultValue={query}
            inputSize="sm"
            className="min-w-[20rem] flex-1"
            placeholder="stainless steel threaded valve for HVAC under ₹5,000"
            aria-label="Query to inspect"
          />
          <Button type="submit" size="sm">
            Inspect
          </Button>
        </form>

        {intent && (
          <div className="mt-5 space-y-5 border-t border-border pt-5">
            {/* Parsed intent ------------------------------------------------ */}
            <div>
              <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                Parsed intent
              </h3>
              {chips.length === 0 ? (
                <p className="text-[13px] text-warning">
                  Nothing extracted — this query would rank on similarity alone.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-accent-line bg-accent-soft px-2.5"
                    >
                      <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">
                        {chip.qualifier}
                      </span>
                      <span className="text-xs font-medium text-text">{chip.label}</span>
                    </span>
                  ))}
                </div>
              )}

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-[12px] text-muted tnum">
                <div className="flex gap-2">
                  <dt className="text-faint">confidence</dt>
                  <dd className={intent.confidence < 0.5 ? 'text-warning' : 'text-text-2'}>
                    {intent.confidence}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-faint">source</dt>
                  <dd className="text-text-2">{intent.source}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-faint">results</dt>
                  <dd className="text-text-2">{ranked?.total ?? 0}</dd>
                </div>
                {intent.missingCriticalFields.length > 0 && (
                  <div className="flex gap-2">
                    <dt className="text-faint">missing</dt>
                    <dd className="text-text-2">{intent.missingCriticalFields.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Follow-up --------------------------------------------------- */}
            {followUp && (
              <div className="rounded-lg border border-dashed border-accent-line bg-accent-soft/30 p-4">
                <p className="text-[11px] font-semibold tracking-wide text-accent-text uppercase">
                  Follow-up selected — field &ldquo;{followUp.field}&rdquo;
                </p>
                <p className="mt-1.5 text-[13.5px] text-text">{followUp.question}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {followUp.options.map((option) => (
                    <span
                      key={option.value}
                      className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-surface px-2.5 text-[12px] text-text-2"
                    >
                      {option.label}
                      <span className="font-mono text-[10px] text-faint tnum">
                        {option.resultCount}
                      </span>
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-[11px] text-muted">
                  Chosen by information gain — the field whose value distribution
                  most reduces the candidate set.
                </p>
              </div>
            )}

            {/* Score arithmetic --------------------------------------------- */}
            {top && (
              <div>
                <h3 className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                  Score breakdown — top result
                </h3>
                <div className="mb-3 flex items-center gap-3.5 rounded-lg border border-border bg-surface-2 p-3.5">
                  <MatchRing percent={top.explanation.matchPercent} size={48} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-text">{top.product.name}</p>
                    <p className="font-mono text-[11px] text-faint tnum">
                      {top.product.sku} · {formatPrice(top.product.price)} · raw score{' '}
                      {top.score.toFixed(4)}
                    </p>
                  </div>
                </div>
                <ScoreBreakdown explanation={top.explanation} />
              </div>
            )}

            {ranked && ranked.results.length === 0 && (
              <p className="text-[13px] text-warning">
                Zero results above the relevance floor. This query would show the
                no-results state.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* items-start stops the shorter column's card from stretching to the
          taller one's height and showing a large dead region. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Weight model ---------------------------------------------------- */}
        <SectionCard
          title="Scoring model"
          description="Base weights. Every match percentage on the platform is a weighted sum of these eight components."
          padded={false}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wider text-faint uppercase">
                <th scope="col" className="px-5 py-2.5 font-semibold">Component</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(Object.keys(BASE_WEIGHTS) as ScoreComponentKey[]).map((key) => (
                <tr key={key}>
                  <td className="px-5 py-3">
                    <p className="text-[13px] font-medium text-text">{COMPONENT_LABELS[key]}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                      {COMPONENT_EXPLANATIONS[key]}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    <span className="font-mono text-[13px] font-medium text-text tnum">
                      {BASE_WEIGHTS[key].toFixed(2)}
                    </span>
                    <span
                      className="mt-1.5 block h-1 rounded-full bg-accent/60"
                      style={{ width: `${Math.max(4, BASE_WEIGHTS[key] * 120)}px` }}
                      aria-hidden
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-surface-2/40">
              <tr>
                <td className="px-5 py-2.5 text-right text-[12px] text-muted">Total</td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-text tnum">
                  {Object.values(BASE_WEIGHTS)
                    .reduce((sum, value) => sum + value, 0)
                    .toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </SectionCard>

        <div className="space-y-6">
          {/* Overrides ----------------------------------------------------- */}
          <SectionCard
            title="Per-category overrides"
            description="Renormalised, so an override cannot inflate the achievable maximum."
            padded={false}
          >
            <ul className="divide-y divide-border">
              {Object.entries(CATEGORY_WEIGHT_OVERRIDES).map(([categoryKey, override]) => {
                const resolved = weightsFor(categoryKey)
                return (
                  <li key={categoryKey} className="px-5 py-3">
                    <p className="text-[13px] font-medium text-text capitalize">
                      {categoryKey.replace(/-/g, ' ')}
                    </p>
                    <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tnum">
                      {(Object.keys(override) as ScoreComponentKey[]).map((key) => (
                        <div key={key} className="flex gap-1.5">
                          <dt className="text-faint">{key}</dt>
                          <dd className="text-text-2">
                            {BASE_WEIGHTS[key].toFixed(2)} → {resolved[key].toFixed(2)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          {/* Provider ------------------------------------------------------ */}
          <SectionCard title="Language model">
            <div className="flex items-start gap-2.5">
              {configured ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text">
                  {configured
                    ? `Claude — ${process.env.ANTHROPIC_MODEL || 'claude-opus-5'}`
                    : 'Offline engine'}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">
                  {configured
                    ? 'Claude parses intent and rephrases explanations. It cannot filter, price or rank — every number is computed.'
                    : 'No API key configured. Intent parsing and explanations come from the deterministic engine; specification matching and ranking are unaffected.'}
                </p>
              </div>
            </div>

            <dl className="mt-4 space-y-2 border-t border-border pt-3 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">AI_PROVIDER</dt>
                <dd className="font-mono text-text-2">{provider}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Write authority</dt>
                <dd className="font-mono text-success">none</dd>
              </div>
            </dl>
          </SectionCard>

          {/* Critical specs ------------------------------------------------ */}
          <SectionCard
            title="Critical specifications"
            description="Missing values here trigger the assistant's follow-up question."
            padded={false}
          >
            <ul className="divide-y divide-border">
              {criticalSpecs.map((definition) => (
                <li key={definition.key} className="flex items-center gap-3 px-5 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-2">
                    {definition.label}
                  </span>
                  <Badge tone="neutral" size="sm">
                    w {definition.rankWeight.toFixed(2)}
                  </Badge>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <p className="mt-6 text-[12px] leading-relaxed text-faint">
        {pluralize(SPEC_DEFINITIONS.length, 'specification')} registered ·{' '}
        {formatPercent(RELEVANCE_FLOOR, 0)} relevance floor · weights are read-only
        until a staged rollout and an offline relevance suite exist to tell whether
        a change helped.
      </p>
    </>
  )
}
