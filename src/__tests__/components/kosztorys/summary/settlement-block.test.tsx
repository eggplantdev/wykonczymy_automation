import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { MATERIALS_GROSS_LOCK_REASON } from '@/components/kosztorys/summary/materials-pricing-options'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { DepositTransactionRowT } from '@/types/transfers'

const INVESTMENT_ID = 4
const VAT_RATE = 0.23
const LABOR_COSTS_NET = 50_000

// One wpłata gotówką (netto, no brutto) and one przelewem, carrying both kwoty off the faktura.
const DEPOSITS: DepositTransactionRowT[] = [
  { id: 1, date: '2026-09-01', amount: 10_000, netAmount: null, vatPlane: 'NET' },
  { id: 2, date: '2026-09-02', amount: 12_300, netAmount: 10_000, vatPlane: 'GROSS' },
]

const RECONCILIATION: KosztorysReconciliationT = {
  laborCosts: { expected: LABOR_COSTS_NET, actual: LABOR_COSTS_NET, mismatch: false },
  discount: { expected: 0, actual: 0, mismatch: false },
}

const onSettlementModeChange = vi.fn()
const onMaterialsNetRateChange = vi.fn()

function renderPanel(settlementMode: SettlementModeT = 'NET') {
  render(
    <SummaryPanelContent
      investmentId={INVESTMENT_ID}
      investmentName="Mokotowska 12"
      depositTransactions={DEPOSITS}
      laborCostsNet={LABOR_COSTS_NET}
      materialsGrossBase={0}
      materialsNetBilled={0}
      materialsBreakdown={[]}
      discountAmount={0}
      lossAmount={0}
      reconciliation={RECONCILIATION}
      vatRate={VAT_RATE}
      settlementMode={settlementMode}
      onSettlementModeChange={onSettlementModeChange}
      materialsNetRate={0.23}
      onMaterialsNetRateChange={onMaterialsNetRateChange}
      financials={ZERO_FINANCIALS}
      showPies={false}
      showTransactionLists={false}
    />,
  )
  return userEvent.setup()
}

// jsdom does not render currency the way a screenshot does — normalise the formatter's spaces.
const moneyIn = (element: HTMLElement) =>
  (element.textContent ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

// The Podsumowanie grid has no row element — every cell is a direct child of one grid container, so
// a row reads as the label cell plus the cell beside it.
function labelCell(label: string): HTMLElement {
  let cell = screen.getByText(label)
  while (cell.parentElement && !cell.parentElement.style.gridTemplateColumns) {
    cell = cell.parentElement
  }
  return cell
}

const amountFor = (label: string) => moneyIn(labelCell(label).nextElementSibling as HTMLElement)

const materialsSection = () =>
  screen.getByRole('heading', { name: 'Materiały' }).closest('section')!

const openSettings = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /Opcje rozliczenia/ }))

beforeEach(() => {
  vi.clearAllMocks()
  // The picked view is remembered, so without this the next test opens the panel where the previous
  // one left it.
  localStorage.clear()
})

// The tryb rozliczenia decides which kwota column EXISTS at all — one, never two. Netto under tryb
// brutto would describe a different debt than the one on the faktura.
describe('Blok rozliczenia — tryb przestawia kolumnę kwot', () => {
  it('rozlicza na netto w trybie netto', () => {
    renderPanel('NET')

    expect(screen.getByText('Pozostało do zapłaty')).toBeInTheDocument()
    expect(screen.queryByText('Brutto')).toBeNull()
  })

  // Owner's ruling of 2026-08-20: „Mieszane" settles on netto just like tryb netto — what is mixed
  // is the WPŁATY, not the bill.
  it('rozlicza „Mieszane" na netto, jednym torem, a nie dwoma', () => {
    renderPanel('MIXED')

    expect(screen.getAllByText('Pozostało do zapłaty')).toHaveLength(1)
    expect(screen.queryByText('Rozliczenie fakturą')).toBeNull()
    expect(screen.queryByText('Brutto')).toBeNull()
  })

  it('rozlicza na brutto w trybie brutto', () => {
    renderPanel('GROSS')

    // 50 000 netto is 61 500 brutto and the wpłata przelewem carries 12 300 brutto — the whole column
    // stands on the second plane, not just its header. The wpłata gotówką has no brutto.
    expect(amountFor('Łącznie')).toContain('61 500,00')
    expect(amountFor('Wpłaty')).toContain('12 300,00')
    expect(amountFor('Pozostało do zapłaty')).toContain('49 200,00')
  })
})

// If the figure at the bottom does not follow from the rows above it, the block computes by two
// rules and neither is the one on screen.
describe('Blok rozliczenia — czyta się w dół', () => {
  it('odejmuje wpłaty z obu płaszczyzn od łącznej kwoty', () => {
    renderPanel('NET')

    // Wpłata gotówką 10 000 netto plus 10 000 netto off the faktura = 20 000 taken off 50 000.
    expect(amountFor('Łącznie')).toContain('50 000,00')
    expect(amountFor('Wpłaty')).toContain('20 000,00')
    expect(amountFor('Pozostało do zapłaty')).toContain('30 000,00')
  })

  it('prowadzi z wiersza wpłat na listę wpłat inwestycji', () => {
    renderPanel('NET')

    // Spelled out rather than built with `investmentTransfersHref(...)`, which is verbatim what the
    // component evaluates — both sides would move together.
    expect(within(labelCell('Wpłaty')).getByRole('link', { name: 'Wpłaty' })).toHaveAttribute(
      'href',
      `/inwestycje/${INVESTMENT_ID}?type=INVESTOR_DEPOSIT,COMPANY_FUNDING,OTHER_DEPOSIT`,
    )
  })
})

// Under rozliczenie brutto the investor pays the full kwoty off the faktury, so a stawka on materiały
// moves no figure. Greyed out with a reason rather than removed, which reads as a bug.
describe('Blok rozliczenia — stawka materiałów pod trybem brutto', () => {
  it('gasi wybór i mówi dlaczego', async () => {
    const user = renderPanel('GROSS')
    await openSettings(user)

    const materials = within(materialsSection())
    expect(materials.getByText(MATERIALS_GROSS_LOCK_REASON)).toBeInTheDocument()
    expect(materials.getByRole('combobox')).toBeDisabled()
    expect(materials.queryByLabelText(/Stawka vat na materiały/i)).toBeNull()
  })

  it('oddaje wybór i pole stawki w trybie netto', async () => {
    const user = renderPanel('NET')
    await openSettings(user)

    const materials = within(materialsSection())
    expect(materials.queryByText(MATERIALS_GROSS_LOCK_REASON)).toBeNull()
    expect(materials.getByRole('combobox')).not.toBeDisabled()
    expect(materials.getByLabelText(/Stawka vat na materiały/i)).toBeInTheDocument()
  })
})
