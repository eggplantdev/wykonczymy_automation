// Settled internal material is bought by the company but already priced into robocizna —
// it leaves the register and lowers margin, but is never billed to the client (off bilans).
import type { InvestmentFinancialsT } from '@/types/investment-financials'

export const calculateMargin = (f: InvestmentFinancialsT) =>
  f.totalLaborCosts -
  f.totalPayouts -
  f.totalDiscount -
  f.totalLoss -
  f.totalSettled -
  f.materialsNetDiscount
