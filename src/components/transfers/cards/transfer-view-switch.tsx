'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutList, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferViewT } from '@/lib/constants/transfer-view'

const VIEW_OPTIONS = [
  { view: 'table', labelKey: 'viewTable', icon: Table2 },
  { view: 'list', labelKey: 'viewCards', icon: LayoutList },
] as const satisfies readonly { view: TransferViewT; labelKey: string; icon: unknown }[]

type PropsT = {
  baseUrl: string
  activeView: TransferViewT
}

export function TransferViewSwitch({ baseUrl, activeView }: PropsT) {
  const { t } = useTranslation('transfers')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function select(view: TransferViewT) {
    if (view === activeView) return
    // `page` is kept on purpose: switching the layout must not move the viewer to another page.
    const url = buildUrlWithParams(baseUrl, searchParams.toString(), {
      view: view === 'table' ? '' : view,
    })
    startTransition(() => router.replace(url, { scroll: false }))
  }

  return (
    <div className="bg-muted flex h-8 w-fit items-center rounded-md p-0.5">
      {VIEW_OPTIONS.map(({ view, labelKey, icon: Icon }) => {
        const isActive = view === activeView
        const label = t(labelKey)
        return (
          <button
            key={view}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => select(view)}
            className={cn(
              'flex h-full items-center justify-center rounded-sm px-2.5 transition-colors',
              isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
