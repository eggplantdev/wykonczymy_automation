import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerReportForm } from '@/components/kosztorys/worker-report/worker-report-form'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
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
})

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const WORKER_ID = 1
const STAGES = [stage(7, 1, 'Płytki')]

const DOCUMENT: Extract<WorkerKosztorysT, { kind: 'ready' }> = {
  kind: 'ready',
  investmentId: 1,
  investmentName: 'Mieszkanie',
  tree: tree([item(1, 'Płytki', 12, 100)], STAGES, [{ itemId: 1, stageId: 7, qtyDone: 5 }]),
  worker: {
    workerId: WORKER_ID,
    name: 'Jan',
    plane: 'w_tools',
    settings: WORKER_VIEW_DEFAULT_SETTINGS,
    executedQtyByItem: {},
    summary: {
      plannedNet: 1200,
      executedByStage: [],
      stagesWholeNet: 0,
      executedNet: 500,
      bonusNet: 0,
      payouts: [],
      paidNet: 200,
      owed: 300,
      isOverpaid: false,
    },
  },
}

function renderForm(token?: string, document = DOCUMENT) {
  return render(
    <TranslationsProvider initialLocale="pl" workerId={WORKER_ID}>
      <WorkerReportForm
        token={token}
        document={document}
        pendingQtyByItem={{}}
        sentReports={[]}
        sectionTranslations={{}}
      />
    </TranslationsProvider>,
  )
}

const headerTexts = () =>
  [...window.document.querySelectorAll('.dsg-cell-header')].map((cell) => cell.textContent ?? '')

const hasReportColumn = () => headerTexts().some((header) => header.startsWith('Zgłaszam'))

describe('the footer switches „Zgłaszam pracę” and „Inwestycja”', () => {
  it('„Inwestycja” trades the „Zgłaszam” column and „Wyślij” for his rozliczenie, and back', async () => {
    renderForm('token')
    expect(await screen.findByRole('button', { name: 'Wyślij' })).toBeInTheDocument()
    expect(hasReportColumn()).toBe(true)
    expect(screen.queryByText('Twoje rozliczenie')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Inwestycja' }))

    expect(screen.getByText('Twoje rozliczenie')).toBeInTheDocument()
    expect(hasReportColumn()).toBe(false)
    expect(screen.queryByRole('button', { name: /^Wyślij/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Tylko zgłaszane przeze mnie/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Zgłaszam pracę' }))

    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeInTheDocument()
    expect(hasReportColumn()).toBe(true)
    expect(screen.queryByText('Twoje rozliczenie')).not.toBeInTheDocument()
  })
})

describe('the owner’s „Podgląd pracownika” is the worker’s view, read-only', () => {
  const draftKeys = () =>
    Object.keys(localStorage).filter((key) => key.startsWith('worker-report-draft:'))

  it('the live link can send and keeps its szkic on the device', async () => {
    renderForm('token')

    expect(await screen.findByRole('button', { name: 'Wyślij' })).toBeInTheDocument()
    expect(draftKeys()).toHaveLength(1)
  })

  it('the preview has no „Wyślij” in either mode and leaves the worker’s szkic alone', async () => {
    renderForm()

    expect(await screen.findByRole('button', { name: 'Nowa praca' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Wyślij/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'Inwestycja' }))

    expect(screen.getByText('Twoje rozliczenie')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Wyślij/ })).not.toBeInTheDocument()
    expect(draftKeys()).toHaveLength(0)
  })
})

describe('„Wszystkie prace” counts what the owner’s hide takes away', () => {
  it('names the hidden rows, and carries no counter when nothing is hidden', async () => {
    const withEmptyRow = {
      ...DOCUMENT,
      tree: tree([item(1, 'Płytki', 12, 100), item(2, 'Fugi', 0, 50)], STAGES, [
        { itemId: 1, stageId: 7, qtyDone: 5 },
      ]),
    }
    const { unmount } = renderForm('token', withEmptyRow)
    expect(await screen.findByText('Wszystkie prace (+1)')).toBeInTheDocument()
    unmount()

    renderForm('token')
    expect(await screen.findByText('Wszystkie prace')).toBeInTheDocument()
    expect(screen.queryByText(/Wszystkie prace \(/)).not.toBeInTheDocument()
  })
})
