import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AiUnavailableState,
  InlineError,
  NetworkErrorState,
  NoResultsState,
  RateLimitedState,
  StateBlock,
  UnparseableQueryState,
} from '@/components/ui/states'

/**
 * Empty and error states.
 *
 * The house rule these enforce is that every state ends with an action. An
 * empty state that only explains what went wrong is a dead end, and a dead end
 * is where a procurement session stops. So the assertions are mostly "is there
 * still a way forward from here", which is the property that actually decays
 * as states get added.
 */

describe('StateBlock', () => {
  it('announces itself as a heading so the page structure survives', () => {
    render(<StateBlock title="Nothing here" description="Try something else." />)
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument()
  })

  it('runs the primary action when it is a callback', async () => {
    const onClick = vi.fn()
    render(
      <StateBlock
        title="Empty"
        description="…"
        primaryAction={{ label: 'Reset', onClick }}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders a link when the action is a destination, not a callback', () => {
    render(
      <StateBlock
        title="Empty"
        description="…"
        primaryAction={{ label: 'Browse', href: '/products' }}
      />
    )

    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/products')
  })

  it('renders supplementary children below the actions', () => {
    render(
      <StateBlock title="Empty" description="…">
        <span>Suggested: ball valve</span>
      </StateBlock>
    )
    expect(screen.getByText('Suggested: ball valve')).toBeInTheDocument()
  })
})

describe('NoResultsState', () => {
  it('quotes the query back so the buyer can see what was searched', () => {
    render(<NoResultsState query="ss316 dn50 valve" />)
    expect(screen.getByText(/ss316 dn50 valve/)).toBeInTheDocument()
  })

  it('always offers a route onward, even with nothing to clear', () => {
    render(<NoResultsState />)
    expect(screen.getByRole('link', { name: /assistant/i })).toBeInTheDocument()
  })

  it('offers to clear filters only when there is a handler to do it', async () => {
    const onClear = vi.fn()
    const { unmount } = render(<NoResultsState query="x" onClear={onClear} />)

    await userEvent.click(screen.getByRole('button', { name: /clear all filters/i }))
    expect(onClear).toHaveBeenCalledOnce()

    unmount()
    render(<NoResultsState query="x" />)
    expect(screen.queryByRole('button', { name: /clear all filters/i })).not.toBeInTheDocument()
  })
})

describe('failure states', () => {
  /**
   * Each of these is a distinct failure the buyer can hit, and each has to say
   * which one it is. "Something went wrong" for all four is what makes a
   * product feel unreliable even when it is behaving correctly.
   */
  const cases = [
    { name: 'unparseable query', render: () => <UnparseableQueryState /> },
    { name: 'AI unavailable', render: () => <AiUnavailableState /> },
    { name: 'network error', render: () => <NetworkErrorState /> },
  ]

  // AiUnavailableState is excluded deliberately: it is a notice rendered above
  // results the offline engine already produced, not a terminal state, so it
  // has nothing to offer a way forward *to*.
  for (const testCase of cases.filter((entry) => entry.name !== 'AI unavailable')) {
    it(`${testCase.name} still offers a way forward with no handler`, () => {
      render(testCase.render())
      const actions = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]
      expect(actions.length).toBeGreaterThan(0)
    })
  }

  it('gives each failure a distinct heading', () => {
    const headings = cases.map((testCase) => {
      const { unmount } = render(testCase.render())
      const text = screen.getByRole('heading').textContent
      unmount()
      return text
    })

    expect(new Set(headings).size).toBe(headings.length)
  })

  it('retries through the supplied handler', async () => {
    const onRetry = vi.fn()
    render(<NetworkErrorState onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: /try again|retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('RateLimitedState', () => {
  it('says how long the wait is rather than only that it is too many', () => {
    // "Try again later" with no number is the difference between a user
    // waiting and a user leaving.
    render(<RateLimitedState retryAfterSeconds={45} />)
    expect(screen.getByText(/45/)).toBeInTheDocument()
  })

  it('still renders when the server sent no retry-after', () => {
    render(<RateLimitedState />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })
})

describe('InlineError', () => {
  it('is exposed as an alert so it is announced, not just shown', () => {
    render(<InlineError message="That SKU is already in use." />)
    expect(screen.getByRole('alert')).toHaveTextContent('That SKU is already in use.')
  })
})
