import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnreadBadge } from '@/components/nav/unread-badge'
import { UnreadCountsProvider } from '@/hooks/use-unread-counts'
import type { UnreadStreamT } from '@/types/notifications'
import { navigationState } from '@/__tests__/stubs/next-navigation'

const VALUES = {
  leads: 3,
  fleet: 0,
  equipment: 0,
  workerReports: 2,
  expenseDrafts: 4,
  rejectedPayouts: 5,
}
// Pre-settled the way React marks a thenable it has read, so `use` returns synchronously and a zero is
// a real zero rather than a badge still suspended.
const COUNTS = Object.assign(Promise.resolve(VALUES), { status: 'fulfilled', value: VALUES })

function renderBadge(stream: UnreadStreamT, path: string, at: string) {
  navigationState.pathname = at
  return render(
    <UnreadCountsProvider counts={COUNTS}>
      <UnreadBadge stream={stream} path={path} />
    </UnreadCountsProvider>,
  )
}

describe('UnreadBadge', () => {
  it('keeps the leads count on „Zgłoszenia prac", a sibling path sharing its prefix', async () => {
    renderBadge('leads', '/zgloszenia', '/zgloszenia-prac')

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('zeroes the leads count on its own page and below it', async () => {
    const { container } = renderBadge('leads', '/zgloszenia', '/zgloszenia/12')

    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the worker-reports count on its own page — a queue is not cleared by looking', async () => {
    renderBadge('workerReports', '/zgloszenia-prac', '/zgloszenia-prac')

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('keeps the expense-drafts count on its own page — it is a queue too', async () => {
    renderBadge('expenseDrafts', '/zgloszenia-wydatkow', '/zgloszenia-wydatkow')

    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('keeps the rejected-payouts count on „Transakcje", where its queue is pinned', async () => {
    renderBadge('rejectedPayouts', '/', '/')

    expect(screen.getByText('5')).toBeInTheDocument()
  })
})
