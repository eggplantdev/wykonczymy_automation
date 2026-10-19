import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { WorkerReportsButton } from '@/components/kosztorys/editor/toolbar/worker-reports-button'
import type { WorkerReportSummaryT } from '@/lib/kosztorys/worker-report/types'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { listInvestmentReports, readInvestmentReport } from '@/lib/queries/worker-reports'

vi.mocked(useKosztorysEditorContext).mockImplementation(
  () => ({ investmentId: 12, stages: [], workers: [] }) as never,
)

const PENDING: WorkerReportSummaryT = {
  id: 5,
  investmentId: 12,
  workerId: 10,
  workerName: 'Anna Nowak',
  workerLanguage: undefined,
  source: 'link',
  createdByName: undefined,
  sentAt: '2026-09-30T08:00:00.000Z',
  status: 'pending',
  decidedAt: undefined,
  decidedBy: undefined,
  target: undefined,
  lineCount: 2,
  acceptedLineCount: 0,
  rejectedLineCount: 0,
}
vi.mocked(listInvestmentReports).mockImplementation(async () => [PENDING])
vi.mocked(readInvestmentReport).mockImplementation(async () => undefined)

function renderButton(pendingCount: number) {
  return render(
    <KosztorysActionsProvider workerReports={{ pendingCount, openReportId: undefined }}>
      <WorkerReportsButton />
    </KosztorysActionsProvider>,
  )
}

describe('WorkerReportsButton', () => {
  it('is absent while nothing waits', () => {
    renderButton(0)

    expect(screen.queryByRole('button', { name: /Zgłoszenia prac/ })).toBeNull()
  })

  it('shows the count and opens the shared dialog on the list', async () => {
    renderButton(1)

    await userEvent.click(screen.getByRole('button', { name: 'Zgłoszenia prac (1)' }))

    expect(await screen.findByRole('dialog', { name: 'Zgłoszenia prac' })).toBeInTheDocument()
    expect(await screen.findByText('Anna Nowak')).toBeInTheDocument()
  })
})
