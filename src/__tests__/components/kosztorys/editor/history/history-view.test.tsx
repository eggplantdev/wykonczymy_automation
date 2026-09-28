import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { PreviewHeaderActions } from '@/components/kosztorys/editor/history/preview-header-actions'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { diffVersions } from '@/lib/kosztorys/history/diff-versions'
import { liveVersion } from '@/lib/kosztorys/history/snapshot-to-tree'
import type { HistoryVersionT, InvestorHistoryT } from '@/lib/kosztorys/history/types'
import type { KosztorysEditorDataT, KosztorysTreeT } from '@/lib/kosztorys/types'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'
import { item, stage, tree, version } from '@/__tests__/helpers/kosztorys-history'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/k/token',
}))

// dsg sizes its virtualised rows off the measured grid; jsdom measures everything as 0×0, which
// renders the header and nothing under it.
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

const DATA = {
  investmentId: 1,
  investmentName: 'Mieszkanie',
  materialsGrossBase: 0,
  materialsNetBilled: 0,
  materialsBreakdown: [],
  settledBreakdown: [],
  laborCostsNetFromTransactions: 0,
  discountNetFromTransactions: 0,
  investmentLoss: 0,
  depositTransactions: [],
  materialTransactions: [],
}

function history(past: HistoryVersionT, current: KosztorysTreeT): InvestorHistoryT {
  return {
    entries: [],
    version: {
      ...past,
      id: 5,
      kind: 'daily',
      label: null,
      day: '2026-01-12',
      diff: diffVersions(past, liveVersion(current)),
    },
  }
}

function renderPreview(
  current: KosztorysTreeT,
  opts: { history?: InvestorHistoryT; clientView?: ClientViewSettingsT } = {},
) {
  const data = { ...DATA, tree: current } as unknown as KosztorysEditorDataT
  return render(<KosztorysEditorBody preview {...data} {...opts} />)
}

// „then → now" sits in two text nodes (the struck-through old value is its own span).
function cellTexts(): string[] {
  return [...document.querySelectorAll('.dsg-cell')].map((cell) => cell.textContent ?? '')
}

const CURRENT = tree([item(1, 'Płytki', 14, 100)])
const PAST = version([item(1, 'Płytki', 12, 100), item(2, 'Fugi', 3, 50)])

describe('investor history view', () => {
  it('strikes through a pozycja the present no longer holds', () => {
    const { container } = renderPreview(CURRENT, { history: history(PAST, CURRENT) })
    const row = screen.getByText('Fugi').closest('.dsg-row')
    expect(row).toHaveClass('kosztorys-history-removed')
    expect(container.querySelectorAll('.kosztorys-history-removed')).toHaveLength(1)
  })

  it('renders a changed Przedmiar as old → new', () => {
    renderPreview(CURRENT, { history: history(PAST, CURRENT) })
    expect(cellTexts()).toContain('12 → 14')
    expect(cellTexts()).toContain('1200,00 → 1400,00')
  })

  it('says „Rabat nieznany" for a version stored before the rabat was captured, never 0 zł', () => {
    const past = { ...PAST, discount: { known: false } } as const
    renderPreview(CURRENT, { history: history(past, CURRENT) })
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Rabat nieznany')
    expect(banner).not.toHaveTextContent('0,00 zł')
  })

  it('drops the money panel and its toggle beside a past grid', () => {
    renderPreview(CURRENT, { history: history(PAST, CURRENT) })
    expect(screen.queryByRole('button', { name: /Podsumowanie/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Historia zmian/ })).toBeInTheDocument()
  })

  it('keeps a column the client view hides hidden', () => {
    const clientView = { hiddenColumns: ['plannedNet'], hideEmptyRows: false }
    renderPreview(CURRENT, { history: history(PAST, CURRENT), clientView })
    expect(cellTexts()).toContain('12 → 14')
    expect(cellTexts()).not.toContain('1200,00 → 1400,00')
  })

  it('shows an etap column empty in the past version when the present has a pomiar in it', () => {
    const stages = [stage(7, 1, 'Płytki')]
    const past = version([item(1, 'Płytki', 12, 100)], stages)
    const current = tree([item(1, 'Płytki', 12, 100)], stages, [
      { itemId: 1, stageId: 7, qtyDone: 5 },
    ])
    renderPreview(current, { history: history(past, current) })
    expect(cellTexts()).toContain('0 → 5')
  })

  it('renders no banner and the money toggle without a history version', () => {
    renderPreview(CURRENT)
    expect(screen.queryByText(/porównanie z bieżącą/)).not.toBeInTheDocument()
    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Podsumowanie/ })).toBeInTheDocument()
  })
})

describe('PreviewHeaderActions', () => {
  it('never offers „Historia zmian" to a crew, even when handed a history', () => {
    render(
      <PreviewHeaderActions
        worker={{} as WorkerAudienceT}
        history={{ entries: [], version: null }}
        hasRows
      />,
    )
    expect(screen.queryByRole('button', { name: /Historia zmian/ })).not.toBeInTheDocument()
  })
})
