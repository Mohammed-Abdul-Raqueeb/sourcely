import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  CriterionRow,
  MatchBadge,
  MatchExplanationPanel,
  MatchRing,
  ScoreBreakdown,
} from '@/components/ui/match-score'
import type { CriterionOutcome, MatchExplanation } from '@/lib/domain/search'

/**
 * The match score is the single most load-bearing number in the product: it is
 * the claim that justifies the ranking. These tests are about what a buyer can
 * actually read off the screen — the figure, the band, and whether a criterion
 * that failed is unmistakably marked as failed.
 *
 * Accessible queries throughout, because a match ring drawn in SVG with no
 * accessible name is invisible to a screen reader and a `getByRole` failure is
 * how that gets caught.
 */

const criterion = (over: Partial<CriterionOutcome> = {}): CriterionOutcome => ({
  key: 'material',
  label: 'Material',
  requested: 'Stainless Steel',
  actual: 'Stainless Steel 316',
  status: 'match',
  ...over,
})

const explanation = (over: Partial<MatchExplanation> = {}): MatchExplanation => ({
  matchPercent: 88,
  headline: 'Matches 4 of 5 requirements',
  summary: 'Stainless steel, threaded, and in stock at your stated budget.',
  criteria: [
    criterion(),
    criterion({ key: 'connection_type', label: 'Connection', status: 'partial' }),
    criterion({ key: 'size_dn', label: 'Size', status: 'miss', actual: 'DN80' }),
    criterion({ key: 'pressure', label: 'Pressure', status: 'unknown', actual: null }),
  ],
  components: [
    { key: 'specMatch', label: 'Specification match', weight: 0.3, raw: 0.9, weighted: 0.27 },
    { key: 'lexical', label: 'Text relevance', weight: 0.2, raw: 0.6, weighted: 0.12 },
  ],
  ...over,
})

describe('MatchRing', () => {
  it('exposes the score to assistive technology, not only as a drawing', () => {
    render(<MatchRing percent={88} />)
    expect(screen.getByRole('img', { name: /88 percent match/i })).toBeInTheDocument()
  })

  it('reflects the figure it was given', () => {
    render(<MatchRing percent={61} />)
    expect(screen.getByRole('img', { name: /61 percent match/i })).toBeInTheDocument()
  })
})

describe('MatchBadge', () => {
  it('shows the percentage and its band label', () => {
    render(<MatchBadge percent={92} />)
    expect(screen.getByText('92%')).toBeInTheDocument()
    // The band label comes from MATCH_BAND_LABELS rather than being hardcoded.
    expect(screen.getByText(/excellent|strong|fair/i)).toBeInTheDocument()
  })

  it('can render the figure alone', () => {
    render(<MatchBadge percent={74} showLabel={false} />)
    expect(screen.getByText('74%')).toBeInTheDocument()
    expect(screen.queryByText(/excellent|strong|fair/i)).not.toBeInTheDocument()
  })

  it('distinguishes an excellent match from a fair one visually', () => {
    // Not every card may glow amber — the accent has to mean something.
    const { container: high } = render(<MatchBadge percent={95} />)
    const { container: low } = render(<MatchBadge percent={52} />)

    expect(high.firstElementChild?.className).toContain('accent')
    expect(low.firstElementChild?.className).not.toContain('accent')
  })
})

describe('CriterionRow', () => {
  it('names what was asked for and what the product is', () => {
    render(<CriterionRow criterion={criterion()} />)
    // The label renders as "Material: ", so match on the word rather than the
    // whole text node.
    expect(screen.getByText(/^Material:/)).toBeInTheDocument()
    expect(screen.getByText(/Stainless Steel 316/)).toBeInTheDocument()
  })

  it('states a miss in words, not only by colour', () => {
    // Colour alone fails both a colour-blind buyer and a screen reader, and
    // this is the row where being wrong costs the most.
    render(<CriterionRow criterion={criterion({ status: 'miss', actual: 'Brass' })} />)
    expect(screen.getByText(/does not match/i)).toBeInTheDocument()
  })

  it('marks a partial match as close rather than as a match', () => {
    render(<CriterionRow criterion={criterion({ status: 'partial' })} />)
    expect(screen.getByText(/close/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Matches$/)).not.toBeInTheDocument()
  })

  it('says a spec is unspecified rather than implying it is absent', () => {
    render(<CriterionRow criterion={criterion({ status: 'unknown', actual: null })} />)
    expect(screen.getByText(/not specified/i)).toBeInTheDocument()
  })
})

describe('MatchExplanationPanel', () => {
  it('renders the headline, the summary and every criterion', () => {
    render(<MatchExplanationPanel explanation={explanation()} />)

    expect(screen.getByText('Matches 4 of 5 requirements')).toBeInTheDocument()
    expect(screen.getByText(/Stainless steel, threaded/)).toBeInTheDocument()

    for (const label of ['Material', 'Connection', 'Size', 'Pressure']) {
      expect(screen.getByText(new RegExp(`^${label}:`))).toBeInTheDocument()
    }
  })

  it('does not hide the criteria that failed', () => {
    // A recommendation panel that shows only what matched is marketing.
    render(<MatchExplanationPanel explanation={explanation()} />)
    expect(screen.getByText(/does not match/i)).toBeInTheDocument()
  })

  it('renders with no criteria at all rather than crashing', () => {
    render(<MatchExplanationPanel explanation={explanation({ criteria: [] })} />)
    expect(screen.getByText('Matches 4 of 5 requirements')).toBeInTheDocument()
  })
})

describe('ScoreBreakdown', () => {
  it('lists each weighted component that produced the score', () => {
    const { container } = render(<ScoreBreakdown explanation={explanation()} />)

    expect(within(container).getByText('Specification match')).toBeInTheDocument()
    expect(within(container).getByText('Text relevance')).toBeInTheDocument()
  })

  it('shows the weights, so the number is checkable rather than asserted', () => {
    const { container } = render(<ScoreBreakdown explanation={explanation()} />)
    expect(container.textContent).toMatch(/30|0\.3/)
  })
})
