import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { ru } from '@/lib/i18n/dictionaries/ru'
import { uk } from '@/lib/i18n/dictionaries/uk'
import type { LanguageT } from '@/lib/i18n/languages'
import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
import type { KosztorysEditorDataT } from '@/lib/kosztorys/types'
import { WORKER_VIEW_DEFAULT_SETTINGS } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'
import { item, stage, tree } from '@/__tests__/helpers/kosztorys-history'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

const WORKER_ID = 1
const STAGES = [stage(7, 1, 'Płytki')]
const CURRENT = tree([item(1, 'Płytki', 12, 100)], STAGES, [{ itemId: 1, stageId: 7, qtyDone: 5 }])

const WORKER: WorkerAudienceT = {
  workerId: WORKER_ID,
  name: 'Jan',
  plane: 'w_tools',
  settings: WORKER_VIEW_DEFAULT_SETTINGS,
  executedQtyByItem: {},
  summary: {
    plannedNet: 0,
    executedByStage: [],
    stagesWholeNet: 0,
    executedNet: 0,
    bonusNet: 0,
    payouts: [],
    paidNet: 0,
    owed: 0,
    isOverpaid: false,
  },
}

const DATA = {
  investmentId: 1,
  investmentName: 'Mieszkanie',
  tree: CURRENT,
  materialsGrossBase: 0,
  materialsNetBilled: 0,
  materialsBreakdown: [],
  settledBreakdown: [],
  laborCostsNetFromTransactions: 0,
  discountNetFromTransactions: 0,
  investmentLoss: 0,
  depositTransactions: [],
  materialTransactions: [],
} as unknown as KosztorysEditorDataT

function ReportBody() {
  return (
    <KosztorysEditorBody
      preview
      worker={WORKER}
      {...DATA}
      report={{
        initialQtyByItem: {},
        isSummary: true,
        onReportQty: vi.fn(),
        showDoneSum: false,
        showProgress: false,
        header: (controls) => (
          <input
            aria-label="search"
            value={controls.search}
            onChange={(event) => controls.onSearch(event.target.value)}
          />
        ),
        footer: null,
      }}
    />
  )
}

function renderReport(locale?: LanguageT) {
  const wrap = (children: ReactNode) =>
    locale ? (
      <TranslationsProvider initialLocale={locale} workerId={WORKER_ID}>
        {children}
      </TranslationsProvider>
    ) : (
      children
    )
  return render(wrap(<ReportBody />))
}

const headerTexts = () =>
  [...document.querySelectorAll('.dsg-cell-header')].map((cell) => cell.textContent ?? '')

describe('the worker’s report grid speaks his language', () => {
  it.each([
    ['uk', uk],
    ['ru', ru],
  ] as const)('%s: headers, the total row and the empty search', async (locale, dictionary) => {
    renderReport(locale)
    const copy = dictionary.grid

    expect(headerTexts()).toContain(copy.description)
    expect(headerTexts()).toContain(copy.remainingForPlane)
    expect(headerTexts()).not.toContain(pl.grid.description)
    expect(screen.getAllByText(copy.total).length).toBeGreaterThan(0)

    await userEvent.type(screen.getByRole('textbox', { name: 'search' }), 'zzz')

    expect(screen.getByText(copy.noResults)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.clearSearch })).toBeInTheDocument()
  })

  it('stays Polish without a chosen language', () => {
    renderReport()

    expect(headerTexts()).toContain(pl.grid.description)
    expect(screen.getAllByText(pl.grid.total).length).toBeGreaterThan(0)
  })
})
