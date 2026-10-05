import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ReportGrid } from '@/components/kosztorys/worker-report/report-grid'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
import type { ReportDraftT } from '@/components/kosztorys/worker-report/types'
import type { useReportDraft } from '@/components/kosztorys/worker-report/use-report-draft'
import { toWorkerReportFormData } from '@/lib/kosztorys/worker-report/to-form-data'
import { WORKER_VIEW_DEFAULT_SETTINGS } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { item, stage, tree } from '@/__tests__/helpers/kosztorys-history'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/z/inwestycja/jan/token',
}))

// dsg sizes its virtualised rows off the measured grid; jsdom measures everything as 0×0.
vi.mock('react-resize-detector', () => ({
  useResizeDetector: () => ({ width: 1600, height: 800 }),
}))

beforeAll(() => {
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 1600, bottom: 800, width: 1600, height: 800 }
  HTMLElement.prototype.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 1600,
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 800,
  })
  window.scrollTo = vi.fn()
})

afterEach(cleanup)

const WORKER_ID = 1
const STAGES = [stage(7, 1, 'Etap 1')]

const DOCUMENT: Extract<WorkerKosztorysT, { kind: 'ready' }> = {
  kind: 'ready',
  investmentId: 1,
  investmentName: 'Mieszkanie',
  tree: tree([item(1, 'Płytki', 12, 100), item(2, 'Fugi', 8, 50)], STAGES, [
    { itemId: 1, stageId: 7, qtyDone: 5 },
    { itemId: 2, stageId: 7, qtyDone: 2 },
  ]),
  worker: {
    workerId: WORKER_ID,
    name: 'Jan',
    plane: 'w_tools',
    settings: WORKER_VIEW_DEFAULT_SETTINGS,
    executedQtyByItem: {},
    summary: {
      plannedNet: 1600,
      executedByStage: [],
      stagesWholeNet: 0,
      executedNet: 600,
      bonusNet: 0,
      payouts: [],
      paidNet: 0,
      owed: 600,
      isOverpaid: false,
    },
  },
}

// What typing does: the column's edit lands in the draft (`onReportQty` → `setQty`), and the page
// re-renders the grid with it. dsg's own keystroke handling is not this spec's subject.
function draftOf(draft: Partial<ReportDraftT> = {}): ReturnType<typeof useReportDraft> {
  return {
    isLoaded: true,
    draft: { qtyByItem: {}, extras: [], ...draft },
    droppedCount: 0,
    setQty: vi.fn(),
    saveExtra: vi.fn(),
    removeExtra: vi.fn(),
    clear: vi.fn(),
  }
}

function grid(draft: ReturnType<typeof useReportDraft>) {
  return (
    <TranslationsProvider initialLocale="pl" workerId={WORKER_ID}>
      <ReportGrid
        token="token"
        data={toWorkerReportFormData(DOCUMENT)}
        document={DOCUMENT}
        draft={draft}
        pendingQtyByItem={{}}
        sentReports={[]}
        sectionTranslations={{}}
        onSent={vi.fn()}
      />
    </TranslationsProvider>
  )
}

const reportQtys = () =>
  [...document.querySelectorAll<HTMLInputElement>('.dsg-row .kosztorys-report-column input')].map(
    (input) => input.value,
  )

const switchTo = (mode: 'Inwestycja' | 'Zgłaszam pracę') =>
  userEvent.click(screen.getByRole('radio', { name: mode }))

describe('a typed „Zgłaszam” survives the footer’s mode switch', () => {
  it('reopens „Zgłaszam pracę” with what he typed since the page loaded', async () => {
    const { rerender } = render(grid(draftOf()))
    expect(reportQtys()).not.toContain('3')

    rerender(grid(draftOf({ qtyByItem: { 1: '3' } })))
    await switchTo('Inwestycja')
    await switchTo('Zgłaszam pracę')

    expect(reportQtys()).toContain('3')
  })
})

describe('the counters follow the szkic', () => {
  const extra = { key: 'e1', description: 'Silikon', unit: 'mb', qty: '4' }

  it('counts reported pozycje in „Tylko zgłaszane przeze mnie” and every line in „Wyślij”', () => {
    const { rerender } = render(grid(draftOf()))
    expect(screen.getByText('Tylko zgłaszane przeze mnie (0)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()

    rerender(grid(draftOf({ qtyByItem: { 1: '3', 2: '1,5' } })))
    expect(screen.getByText('Tylko zgłaszane przeze mnie (2)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij (2)' })).toBeEnabled()

    rerender(grid(draftOf({ qtyByItem: { 1: '3', 2: '' } })))
    expect(screen.getByText('Tylko zgłaszane przeze mnie (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij (1)' })).toBeInTheDocument()
  })

  it('a complete „Nowa praca” counts in „Wyślij” only', () => {
    render(grid(draftOf({ qtyByItem: { 1: '3' }, extras: [extra] })))

    expect(screen.getByText('Tylko zgłaszane przeze mnie (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wyślij (2)' })).toBeInTheDocument()
  })

  it('a half-filled „Nowa praca” adds nothing to „Wyślij”', () => {
    render(grid(draftOf({ qtyByItem: { 1: '3' }, extras: [{ ...extra, unit: '' }] })))

    expect(screen.getByRole('button', { name: 'Wyślij (1)' })).toBeDisabled()
  })
})
