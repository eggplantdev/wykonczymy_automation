// Marża (margin) = company's profit from an investment.
// Labor costs are what the investor pays the company for work.
// Payouts are the company's already-withdrawn profit.
// A rabat is a discount on the labour price — the company's own cost — so it lowers margin.
// Margin = laborCosts - payouts - rabat = profit still available.
export const calculateMargin = (laborCosts: number, totalPayouts: number, rabat = 0) =>
  laborCosts - totalPayouts - rabat
