'use client'

import { LayoutList, Table2 } from 'lucide-react'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferViewT } from '@/lib/constants/transfer-view'

const VIEW_OPTIONS = [
  { view: 'table', labelKey: 'viewTable', icon: Table2 },
  { view: 'list', labelKey: 'viewCards', icon: LayoutList },
] as const satisfies readonly { view: TransferViewT; labelKey: string; icon: unknown }[]

type PropsT = {
  view: TransferViewT
  onChange: (view: TransferViewT) => void
  className?: string
}

export function TransferViewSwitch({ view, onChange, className }: PropsT) {
  const { t } = useTranslation('transfers')

  return (
    <ToggleGroup
      variant="muted"
      value={view}
      onChange={onChange}
      className={className}
      options={VIEW_OPTIONS.map(({ view: option, labelKey, icon: Icon }) => ({
        value: option,
        label: t(labelKey),
        icon: <Icon className="size-4" />,
      }))}
    />
  )
}
