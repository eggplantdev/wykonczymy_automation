// Marża (margin) = company's profit from an investment.
// Labor costs are what the investor pays the company for work.
// Payouts are the company's already-withdrawn profit.
// Margin = laborCosts - payouts = profit still available.
export const calculateMargin = (laborCosts: number, totalPayouts: number) =>
  laborCosts - totalPayouts
