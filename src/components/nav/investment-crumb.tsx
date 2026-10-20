import { HistoryBackButton } from '@/components/ui/history-back-button'
import { NavNameLink } from '@/components/nav/nav-name-link'
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
      <NavNameLink
        href={`/inwestycje/${id}`}
        className="max-w-32 truncate leading-none sm:max-w-none"
      >
        {name}
      </NavNameLink>
    </div>
  )
}
