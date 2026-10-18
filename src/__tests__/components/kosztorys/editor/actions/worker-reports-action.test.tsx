import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { listInvestmentReports, readInvestmentReport } from '@/lib/queries/worker-reports'

vi.mocked(useKosztorysEditorContext).mockImplementation(
  () => ({ investmentId: 12, stages: [], workers: [] }) as never,
)

vi.mocked(listInvestmentReports).mockImplementation(async () => [])
vi.mocked(readInvestmentReport).mockImplementation(async () => undefined)

afterEach(() => window.history.replaceState(null, '', '/'))

describe('useWorkerReportsAction — a deep-linked report', () => {
  // In the app every replaceState becomes a Next router restore, which discards the server actions
  // in flight — the dialog's reads, left „Wczytywanie…" forever. jsdom has no router, so the spec
  // pins the timing instead: the URL is left alone until the dialog closes.
  it('keeps the query while the dialog is open and strips it on close', async () => {
    window.history.replaceState(null, '', '/inwestycje/12/kosztorys_v2?zgloszenie=5')

    render(
      <KosztorysActionsProvider workerReports={{ pendingCount: 1, openReportId: 5 }}>
        {null}
      </KosztorysActionsProvider>,
    )
    expect(await screen.findByRole('dialog', { name: 'Zgłoszenia prac' })).toBeInTheDocument()
    expect(window.location.search).toBe('?zgloszenie=5')

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(window.location.pathname + window.location.search).toBe('/inwestycje/12/kosztorys_v2')
  })
})
