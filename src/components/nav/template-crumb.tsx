import Link from 'next/link'

import { HistoryBackButton } from '@/components/ui/history-back-button'
import { getPresetNameForCrumb } from '@/lib/queries/presets'

type TemplateCrumbPropsT = {
  params: Promise<{ id: string }>
}

// The [id] here is a presetId, not an investmentId — the workshop investment underneath is an
// implementation detail (see TemplateWorkshopPage).
export async function TemplateCrumb({ params }: TemplateCrumbPropsT) {
  const { id } = await params

  const name = await getPresetNameForCrumb(id)
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
