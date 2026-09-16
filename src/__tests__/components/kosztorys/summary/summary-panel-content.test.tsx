import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { ZERO_FINANCIALS } from '@/types/investment-financials'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'

// The kosztorys reading the host resolved. Deliberately nowhere near the transactions figures below:
// if the „Marża" tab ever reads `financials` directly again, it prints 999 999 and the assertion
// names the plane it fell back to instead of just going red.
const LABOR_COSTS_NET = 50_000
const DISCOUNT = 5_000

const FINANCIALS = {
  ...ZERO_FINANCIALS,
  totalLaborCosts: 999_999,
  totalDiscount: 111_111,
}

const RECONCILIATION: KosztorysReconciliationT = {
  laborCosts: { expected: LABOR_COSTS_NET + DISCOUNT, actual: LABOR_COSTS_NET + DISCOUNT, mismatch: false },
  discount: { expected: DISCOUNT, actual: DISCOUNT, mismatch: false },
}

const SUBCONTRACTOR_DUE: SubcontractorDueByPlaneT = {
  wTools: 20_000,
  ownTools: 0,
  combined: 20_000,
  hasUnconfirmedPlane: false,
  byStage: new Map(),
  byWorker: new Map(),
}

function renderPanel() {
  render(
    <SummaryPanelContent
      investmentId={1}
      investmentName="Inwestycja testowa"
      depositTransactions={[]}
      laborCostsNet={LABOR_COSTS_NET}
      materialsGrossBase={0}
      materialsNetBilled={0}
      materialsBreakdown={[]}
      discountAmount={DISCOUNT}
      lossAmount={0}
      reconciliation={RECONCILIATION}
      vatRate={0.23}
      settlementMode="NET"
      materialsNetRate={null}
      financials={FINANCIALS}
      subcontractorDue={SUBCONTRACTOR_DUE}
      showPies={false}
      showTransactionLists={false}
    />,
  )
  return userEvent.setup()
}

// jsdom renders no currency the way a screenshot would — normalise the spaces the formatter uses.
function moneyIn(element: HTMLElement) {
  return (element.textContent ?? '').replace(/\u00a0|\u202f/g, ' ')
}

// The picked view is persisted, so one test would otherwise open the panel where the previous one
// left it.
beforeEach(() => localStorage.clear())

describe('SummaryPanelContent — „Marża" and the block above it read one plane', () => {
  it('prints the kosztorys robocizna in the Marża tab, not the transactions one', async () => {
    const user = renderPanel()

    await user.click(screen.getByRole('radio', { name: 'Marża' }))
    const table = screen.getByText('Marża rzeczywista').closest('div')!

    // Pre-rabat, because that is the axis both readings stand on: 50 000 post-rabat + 5 000 rabat.
    expect(moneyIn(table)).toContain('55 000,00')
    expect(moneyIn(table)).toContain('5 000,00')
    expect(moneyIn(table)).not.toContain('999 999')
    expect(moneyIn(table)).not.toContain('111 111')
  })

  it('shows the same robocizna in Podsumowanie as in Marża', async () => {
    const user = renderPanel()

    const overview = moneyIn(document.body)
    expect(overview).not.toContain('999 999')
    expect(overview).not.toContain('111 111')

    await user.click(screen.getByRole('radio', { name: 'Marża' }))

    const margin = moneyIn(document.body)
    expect(margin).not.toContain('999 999')
    expect(margin).not.toContain('111 111')
    // Both surfaces quote the rabat the host resolved — the pair is what EX-677 was about.
    expect(overview).toContain('5 000,00')
    expect(margin).toContain('5 000,00')
  })
})
