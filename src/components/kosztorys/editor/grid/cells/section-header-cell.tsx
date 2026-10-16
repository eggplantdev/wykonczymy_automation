'use client'

import type { KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import {
  KosztorysSectionActionsMenu,
  type SectionBandActionsT,
} from '@/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu'
import { useTranslation } from '@/hooks/use-translation'
import { formatNet } from '@/lib/kosztorys/format'
import { cn } from '@/lib/utils/cn'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// `net` is the section's executed value after rabat, in the active price view
export type SectionHeaderFigureT = { itemCount: number; net: number }

export type SectionHeaderContextT = {
  figures: Map<number, SectionHeaderFigureT>
  collapsedSectionIds: ReadonlySet<number>
  onToggleCollapsed: (sectionId: number) => void
  onRename?: (sectionId: number, name: string) => void
  actions?: SectionBandActionsT
  sortActive: boolean
  labelColumnId?: string
  isBare?: boolean
}

export type SectionHeaderSlotT = 'actions' | 'label' | 'blank'

const ACTIONS_COLUMN_ID = 'actions'

// Literals, not an import — the column assembly imports this file.
const CHROME_COLUMN_IDS: ReadonlySet<string> = new Set([ACTIONS_COLUMN_ID, 'layerGap'])

export function sectionBandLabelColumnId(
  columnIds: readonly (string | undefined)[],
): string | undefined {
  return columnIds.find((id): id is string => id != null && !CHROME_COLUMN_IDS.has(id))
}

export function sectionHeaderSlot(
  columnId: string | undefined,
  labelColumnId: string | undefined,
): SectionHeaderSlotT {
  if (columnId === ACTIONS_COLUMN_ID) return 'actions'
  return columnId != null && columnId === labelColumnId ? 'label' : 'blank'
}

function SectionDot() {
  return (
    <span className="size-2.5 shrink-0 rounded-full bg-(--section-rail,var(--color-muted-foreground))" />
  )
}

export function SectionHeaderCell({
  rowData,
  slot,
  context,
}: {
  rowData: KosztorysV2RowT
  slot: SectionHeaderSlotT
  context: SectionHeaderContextT
}) {
  const { itemCount, net } = context.figures.get(rowData.sectionId) ?? { itemCount: 0, net: 0 }
  const { onRename } = context
  const foldable = itemCount > 0
  const collapsed = foldable && context.collapsedSectionIds.has(rowData.sectionId)
  const toggle = () => context.onToggleCollapsed(rowData.sectionId)
  const { t } = useTranslation('grid')
  const title = foldable ? t(collapsed ? 'expandSection' : 'collapseSection') : undefined
  const { actions } = context

  if (slot === 'actions') {
    if (!actions) return <div className="size-full" />
    return (
      <KosztorysSectionActionsMenu
        row={rowData}
        sectionId={rowData.sectionId}
        name={rowData.sectionName ?? ''}
        itemCount={itemCount}
        color={rowData.sectionColor}
        sortActive={context.sortActive}
        actions={actions}
      />
    )
  }

  if (slot === 'label') {
    const Chevron = collapsed ? ChevronRight : ChevronDown
    const toggleProps = foldable
      ? {
          role: 'button',
          tabIndex: 0,
          title,
          'aria-expanded': !collapsed,
          onClick: toggle,
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            // Not events bubbling out of the rename input, where Space/Enter edit the name.
            if (event.target !== event.currentTarget) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            toggle()
          },
        }
      : {}
    return (
      <div
        {...toggleProps}
        // `w-max` + the `overflow: visible` rule in globals.css let the band out of the cell, so a
        // long name isn't clipped at the „Sekcja" column's width.
        className={cn(
          'grid-band-text flex h-full w-max items-center gap-2 px-2 font-semibold',
          foldable && 'hover:bg-accent/50 cursor-pointer',
        )}
      >
        <SectionDot />
        {onRename ? (
          <SectionNameCell
            rowData={rowData}
            onRename={onRename}
            // The band size only from `sm:` up: on a phone `typing-surface`'s 16px floor must win,
            // or iOS zooms in.
            className="sm:grid-band-text field-sizing-content w-auto shrink-0 px-0 font-semibold"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="shrink-0 whitespace-nowrap">{rowData.sectionName ?? ''}</span>
        )}
        {!context.isBare && (
          <span className="text-muted-foreground grid-cell-text shrink-0 font-normal">
            {t('sectionItems', { count: itemCount })}
          </span>
        )}
        {!context.isBare && net !== 0 && (
          <span className="grid-cell-text shrink-0 whitespace-nowrap">
            <span className="font-medium tabular-nums">{formatNet(net)} zł</span>
            <span className="text-muted-foreground font-normal"> {t('netSuffix')}</span>
          </span>
        )}
        {foldable && <Chevron className="text-muted-foreground size-4 shrink-0" />}
        {!foldable && actions && (
          <Button
            variant="ghost"
            size="xs"
            className="font-normal"
            onClick={() => actions.onAddItem(rowData.sectionId)}
          >
            <Plus />
            Dodaj pracę
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      aria-hidden
      title={title}
      onClick={foldable ? toggle : undefined}
      className={cn('size-full', foldable && 'cursor-pointer')}
    />
  )
}
