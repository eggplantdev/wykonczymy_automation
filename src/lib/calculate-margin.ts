// Marża (margin) = company's profit from an investment.
// Labor costs are what the investor pays the company for work.
// Payouts are the company's already-withdrawn profit.
// A rabat is a discount on the labour price — the company's own cost — so it lowers margin.
// A loss (strata) is a cost the company absorbs itself — lowers margin, never touches bilans.
// Settled internal material is bought by the company but already priced into robocizna —
// it leaves the register and lowers margin, but is never billed to the client (off bilans).
// Margin = laborCosts - payouts - rabat - loss - settled = profit still available.
export const calculateMargin = (
  laborCosts: number,
  totalPayouts: number,
  rabat = 0,
  loss = 0,
  settled = 0,
) => laborCosts - totalPayouts - rabat - loss - settled
