import { notFound } from 'next/navigation'

// Split from parseInvestmentId because a parallel-route slot can't use the notFound() form — a slot
// that 404s takes the whole shell with it, when all it wants is to render nothing.
export function isInvestmentId(id: string): boolean {
  const investmentId = Number(id)
  return Number.isFinite(investmentId) && investmentId > 0
}

export function parseInvestmentId(id: string): number {
  if (!isInvestmentId(id)) notFound()
  return Number(id)
}
