import Link from 'next/link'

import { HistoryBackButton } from '@/components/ui/history-back-button'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { getTemplateName } from '@/lib/queries/presets'

type TemplateCrumbPropsT = {
  params: Promise<{ id: string }>
}

export async function TemplateCrumb({ params }: TemplateCrumbPropsT) {
  const { id } = await params

  const { success } = await requireAuth(MANAGEMENT_ROLES)
  if (!success) return null

  const templateId = Number(id)
  if (!Number.isInteger(templateId)) return null
  const name = await getTemplateName(templateId)
  if (!name) return null

  return (
    <div className="flex min-w-0 flex-col justify-center gap-1.5">
      <HistoryBackButton fallbackHref="/szablony" />
      <Link
        href={`/szablony/${id}`}
        className="text-foreground truncate text-sm leading-none font-medium hover:underline"
      >
        {name}
      </Link>
    </div>
  )
}
