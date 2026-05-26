import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { getInvestment } from '@/lib/queries/investments'
import { NoSheetBanner } from './no-sheet-banner'

type PropsT = {
  params: Promise<{ id: string }>
  children: ReactNode
}

export default async function InvestmentLayout({ params, children }: PropsT) {
  const { id } = await params
  const investment = await getInvestment(id)
  if (!investment) notFound()

  return (
    <>
      {!investment.googleSheetId && (
        <NoSheetBanner investmentId={investment.id} investmentName={investment.name} />
      )}
      {children}
    </>
  )
}
