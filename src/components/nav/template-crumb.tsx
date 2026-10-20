import { HistoryBackButton } from '@/components/ui/history-back-button'
import { NavNameLink } from '@/components/nav/nav-name-link'
import { isInvestmentId } from '@/lib/queries/investment-id'
import { getTemplateName } from '@/lib/queries/presets'

type TemplateCrumbPropsT = {
  params: Promise<{ id: string }>
}

export async function TemplateCrumb({ params }: TemplateCrumbPropsT) {
  const { id } = await params
  if (!isInvestmentId(id)) return null

  const name = await getTemplateName(Number(id))
  if (!name) return null

  return (
    <div className="flex min-w-0 flex-col justify-center gap-1.5">
      <HistoryBackButton fallbackHref="/szablony" />
      <NavNameLink href={`/szablony/${id}`} className="truncate leading-none">
        {name}
      </NavNameLink>
    </div>
  )
}
