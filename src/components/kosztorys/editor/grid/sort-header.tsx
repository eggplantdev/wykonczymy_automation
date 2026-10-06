'use client'

import { cn } from '@/lib/utils/cn'
import { HeaderMenu } from '@/components/ui/datasheet-grid/header-menu'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { SortIcon, SortMenuItems, type SortMenuPropsT } from './sort-menu-items'

type PropsT = SortMenuPropsT & {
  label: string
  tip?: string
  color?: SectionColorKeyT | null
  onSetColor?: (color: SectionColorKeyT | null) => void
}

export function SortHeader({
  label,
  active,
  onSort,
  onPersistOrder,
  tip,
  color = null,
  onSetColor,
}: PropsT) {
  // The active-sort weight goes on the label element, not triggerClassName: HeaderLabel's own
  // font-medium sits on that element and would beat anything merely inherited from the trigger.
  return (
    <HeaderMenu
      label={<HeaderLabel className={cn(active && 'font-semibold')}>{label}</HeaderLabel>}
      icon={<SortIcon active={active} />}
      triggerClassName={cn(active && 'text-primary')}
      triggerTitle="Sortuj kolumnę"
      tip={tip}
    >
      <SortMenuItems active={active} onSort={onSort} onPersistOrder={onPersistOrder} />
      {onSetColor && (
        <>
          <DropdownMenuSeparator />
          <SectionColorPicker value={color} onChange={onSetColor} />
        </>
      )}
    </HeaderMenu>
  )
}
