import Link from 'next/link'

import { HistoryBackButton } from '@/components/ui/history-back-button'
import { getInvestmentName } from '@/lib/queries/investments'
import { isInvestmentId } from '@/lib/queries/investment-id'

type InvestmentCrumbPropsT = {
  params: Promise<{ id: string }>
}

export async function InvestmentCrumb({ params }: InvestmentCrumbPropsT) {
  const { id } = await params
  // Keeps a junk id out of the query's cache keys.
  if (!isInvestmentId(id)) return null

  const name = await getInvestmentName(id)
  if (!name) return null

  return (
    <div className="flex min-w-0 flex-col justify-center gap-1.5">
      <HistoryBackButton fallbackHref={`/inwestycje/${id}`} />
      <Link
        href={`/inwestycje/${id}`}
        className="text-foreground truncate text-sm leading-none font-medium hover:underline"
      >
        {name}
      </Link>
    </div>
  )
}
