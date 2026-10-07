import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ReportGrid } from '@/components/kosztorys/worker-report/report-grid'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
import type { ReportDraftT } from '@/components/kosztorys/worker-report/types'
import type { useReportDraft } from '@/components/kosztorys/worker-report/use-report-draft'
import { toWorkerReportFormData } from '@/lib/kosztorys/worker-report/to-form-data'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { item, stage, tree } from '@/__tests__/helpers/kosztorys-history'
import { workerAudience } from '@/__tests__/helpers/worker-audience'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/z/inwestycja/jan/token',
  useSearchParams: () => new URLSearchParams(),
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
})

afterEach(cleanup)

const STAGES = [stage(7, 1, 'Etap 1')]

const DOCUMENT: Extract<WorkerKosztorysT, { kind: 'ready' }> = {
  kind: 'ready',
  investmentId: 1,
  investmentName: 'Mieszkanie',
  tree: tree([item(1, 'Płytki', 12, 100), item(2, 'Fugi', 8, 50)], STAGES, [
    { itemId: 1, stageId: 7, qtyDone: 5 },
    { itemId: 2, stageId: 7, qtyDone: 2 },
  ]),
  worker: workerAudience({ plannedNet: 1600, executedNet: 600, owed: 600 }),
}

// dsg never activates a cell in jsdom, so a spec cannot type into „Zgłaszam”: it hands the grid the
// draft that typing would have left (`onReportQty` → `setQty`) and re-renders.
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
    <TranslationsProvider initialLocale="pl" workerId={DOCUMENT.worker.workerId}>
      <ReportGrid
        token="token"
        data={toWorkerReportFormData(DOCUMENT)}
        document={DOCUMENT}
        draft={draft}
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

const openOptions = () => userEvent.click(screen.getByRole('button', { name: 'Opcje' }))

// The open menu hides the rest of the page from the accessibility tree, so it closes again.
async function expectReportedOnlyCount(count: number) {
  await openOptions()
  expect(screen.getByText(`Tylko zgłaszane przeze mnie (${count})`)).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
}

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

  it('keeps a negative in the column, where the send bar’s „Popraw błędy” points', async () => {
    render(grid(draftOf({ qtyByItem: { 1: '-3' } })))
    await switchTo('Inwestycja')
    await switchTo('Zgłaszam pracę')

    expect(reportQtys()).toContain('-3')
    await expectReportedOnlyCount(1)
  })
})

describe('the counters follow the szkic', () => {
  const extra = { key: 'e1', description: 'Silikon', unit: 'mb', qty: '4' }

  it('counts reported pozycje in „Tylko zgłaszane przeze mnie” and every line in „Wyślij”', async () => {
    const { rerender } = render(grid(draftOf()))
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
    await expectReportedOnlyCount(0)

    rerender(grid(draftOf({ qtyByItem: { 1: '3', 2: '1,5' } })))
    expect(screen.getByRole('button', { name: 'Wyślij (2)' })).toBeEnabled()
    await expectReportedOnlyCount(2)

    rerender(grid(draftOf({ qtyByItem: { 1: '3', 2: '' } })))
    expect(screen.getByRole('button', { name: 'Wyślij (1)' })).toBeInTheDocument()
    await expectReportedOnlyCount(1)
  })

  it('a complete „Nowa praca” counts in „Wyślij” only', async () => {
    render(grid(draftOf({ qtyByItem: { 1: '3' }, extras: [extra] })))

    expect(screen.getByRole('button', { name: 'Wyślij (2)' })).toBeInTheDocument()
    await expectReportedOnlyCount(1)
  })

  it('a half-filled „Nowa praca” adds nothing to „Wyślij”', () => {
    render(grid(draftOf({ qtyByItem: { 1: '3' }, extras: [{ ...extra, unit: '' }] })))

    expect(screen.getByRole('button', { name: 'Wyślij (1)' })).toBeDisabled()
  })
})

describe('„Tylko zgłaszane przeze mnie” before anything is reported', () => {
  it('says nothing is reported yet rather than that the kosztorys is empty', async () => {
    render(grid(draftOf()))
    await openOptions()
    await userEvent.click(screen.getByText('Tylko zgłaszane przeze mnie (0)'))

    expect(await screen.findByText('Nic jeszcze nie zgłoszono')).toBeInTheDocument()
    expect(screen.queryByText('Kosztorys jest pusty')).not.toBeInTheDocument()
  })
})
