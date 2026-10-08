'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { LayoutList, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

export const TRANSFER_VIEWS = ['table', 'list'] as const
export type TransferViewT = (typeof TRANSFER_VIEWS)[number]

const VIEW_OPTIONS = [
  { view: 'table', label: 'Tabela', icon: Table2 },
  { view: 'list', label: 'Karty', icon: LayoutList },
] as const satisfies readonly { view: TransferViewT; label: string; icon: unknown }[]

export function parseTransferView(value: string | null): TransferViewT {
  return TRANSFER_VIEWS.find((view) => view === value) ?? 'table'
}

type PropsT = {
  baseUrl: string
}

export function TransferViewSwitch({ baseUrl }: PropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeView = parseTransferView(searchParams.get('view'))

  function select(view: TransferViewT) {
    if (view === activeView) return
    // `page` is kept on purpose: switching the layout must not move the viewer to another page.
    const url = buildUrlWithParams(baseUrl, searchParams.toString(), {
      view: view === 'table' ? '' : view,
    })
    router.replace(url, { scroll: false })
  }

  return (
    <div className="bg-muted flex h-8 w-fit items-center rounded-md p-0.5">
      {VIEW_OPTIONS.map(({ view, label, icon: Icon }) => {
        const isActive = view === activeView
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
