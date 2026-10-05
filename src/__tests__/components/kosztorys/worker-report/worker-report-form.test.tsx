import { cleanup, render, screen, within } from '@testing-library/react'
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

function renderForm(token?: string) {
  return render(
    <TranslationsProvider initialLocale="pl" workerId={WORKER_ID}>
      <WorkerReportForm
        token={token}
        document={DOCUMENT}
        pendingQtyByItem={{}}
        sentReports={[]}
        sectionTranslations={{}}
      />
    </TranslationsProvider>,
  )
}

const panelState = () =>
  screen.getByText('Twoje rozliczenie').closest('[data-state]')?.getAttribute('data-state')

describe('the worker’s report link carries his „Podsumowanie”', () => {
  it('opens and closes his own balance from the report bar', async () => {
    renderForm('token')

    expect(await screen.findByText('Twoje rozliczenie')).toBeInTheDocument()
    expect(panelState()).toBe('open')

    // Open, the panel covers the screen, so it carries its own way back out.
    const panel = screen.getByText('Twoje rozliczenie').closest('[data-state]') as HTMLElement
    await userEvent.click(within(panel).getByRole('button', { name: 'Podsumowanie' }))
    expect(panelState()).toBe('closed')

    await userEvent.click(screen.getAllByRole('button', { name: 'Podsumowanie' })[0])
    expect(panelState()).toBe('open')
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

  it('the preview has no „Wyślij” and leaves the worker’s szkic alone', async () => {
    renderForm()

    expect(await screen.findByText('Twoje rozliczenie')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Wyślij' })).not.toBeInTheDocument()
    expect(draftKeys()).toHaveLength(0)
  })
})
