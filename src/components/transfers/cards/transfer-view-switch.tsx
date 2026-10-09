'use client'

import { LayoutList, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferViewT } from '@/lib/constants/transfer-view'

const VIEW_OPTIONS = [
  { view: 'table', labelKey: 'viewTable', icon: Table2 },
  { view: 'list', labelKey: 'viewCards', icon: LayoutList },
] as const satisfies readonly { view: TransferViewT; labelKey: string; icon: unknown }[]

type PropsT = {
  view: TransferViewT
  onChange: (view: TransferViewT) => void
}

export function TransferViewSwitch({ view: activeView, onChange }: PropsT) {
  const { t } = useTranslation('transfers')

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
            onClick={() => onChange(view)}
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
