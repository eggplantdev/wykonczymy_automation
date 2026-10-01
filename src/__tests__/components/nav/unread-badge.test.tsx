import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnreadBadge } from '@/components/nav/unread-badge'
import { UnreadCountsProvider } from '@/hooks/use-unread-counts'
import type { UnreadStreamT } from '@/types/notifications'

const pathname = vi.hoisted(() => ({ current: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

const VALUES = { leads: 3, fleet: 0, equipment: 0, workerReports: 2 }
// Pre-settled the way React marks a thenable it has read, so `use` returns synchronously and a zero is
// a real zero rather than a badge still suspended.
const COUNTS = Object.assign(Promise.resolve(VALUES), { status: 'fulfilled', value: VALUES })

function renderBadge(stream: UnreadStreamT, path: string, at: string) {
  pathname.current = at
  return render(
    <UnreadCountsProvider counts={COUNTS}>
      <UnreadBadge stream={stream} path={path} />
    </UnreadCountsProvider>,
  )
}

describe('UnreadBadge', () => {
  it('keeps the leads count on „Zgłoszenia wykonanych prac", a sibling path sharing its prefix', async () => {
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
})
