'use client'

import type { KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SectionNameCell } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import {
  KosztorysSectionActionsMenu,
  type SectionBandActionsT,
} from '@/components/kosztorys/editor/grid/menus/kosztorys-section-actions-menu'
import { formatNet } from '@/lib/kosztorys/format'
import { cn } from '@/lib/utils/cn'
import { canMoveSection, type MoveEdgesT } from '@/lib/kosztorys/move-edges'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// `net` is the section's executed value after rabat, in the active price view — the same figure its
// footer's „Razem netto" shows, so a collapsed section still states what it is worth.
export type SectionHeaderFigureT = { itemCount: number; net: number }

// Carried on the wrapped column's `columnData`, never a closure — see kosztorys-synthetic-rows.tsx.
// `onRename` and `actions` are absent in the read-only client view.
export type SectionHeaderContextT = {
  // Per section id — the band row carries the section's identity, not its figures.
  figures: Map<number, SectionHeaderFigureT>
  collapsedSectionIds: ReadonlySet<number>
  onToggleCollapsed: (sectionId: number) => void
  onRename?: (sectionId: number, name: string) => void
  // One bundle: every command comes from the same `editorOnly()` gate, so it is all-present or absent.
  actions?: SectionBandActionsT
  // A section-scoped sort keeps bands on screen but freezes section order — see the menu.
  sortActive: boolean
  // Which sekcja sits at either end, so its ▲/▼ can go dead instead of eating the click.
  moveEdges?: MoveEdgesT
  // Which column paints the label — resolved per render off the visible order, never a fixed id.
  labelColumnId?: string
  // The worker's compact report: the name alone, cut at the cell, so the band never widens the page.
  isBare?: boolean
}

// dsg has no colspan, so the band is painted per column: one column carries the whole label, one
// carries the section's „…", the rest paint blank.
export type SectionHeaderSlotT = 'actions' | 'label' | 'blank'

const ACTIONS_COLUMN_ID = 'actions'

// Chrome, not a reading: „Akcje" is 64px of trigger and the trailing gap is empty, so neither can
// host a legible label. Literals, not an import — the column assembly imports this file.
const CHROME_COLUMN_IDS: ReadonlySet<string> = new Set([ACTIONS_COLUMN_ID, 'layerGap'])

// Follows the visible order, not a named column: any column can be dragged or hidden
// (lib/table/column-order), which would paint the band off-screen.
export function sectionBandLabelColumnId(
  columnIds: readonly (string | undefined)[],
): string | undefined {
  return columnIds.find((id): id is string => id != null && !CHROME_COLUMN_IDS.has(id))
}

export function sectionHeaderSlot(
  columnId: string | undefined,
  labelColumnId: string | undefined,
): SectionHeaderSlotT {
  // Can't collide: „Akcje" is chrome, so `sectionBandLabelColumnId` never names it.
  if (columnId === ACTIONS_COLUMN_ID) return 'actions'
  return columnId != null && columnId === labelColumnId ? 'label' : 'blank'
}

// The dot reads `--section-rail` off the row, so band colour and gutter rail can't disagree.
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
  // A sekcja bez pozycji has nothing to fold, so its band is inert apart from the name and the add.
  const foldable = itemCount > 0
  const collapsed = foldable && context.collapsedSectionIds.has(rowData.sectionId)
  const toggle = () => context.onToggleCollapsed(rowData.sectionId)
  const title = foldable ? (collapsed ? 'Rozwiń sekcję' : 'Zwiń sekcję') : undefined
  const { actions } = context

  if (slot === 'actions') {
    // Never gets a toggle handler, so a collapsed section's commands stay reachable.
    if (!actions) return <div className="size-full" />
    return (
      <KosztorysSectionActionsMenu
        row={rowData}
        sectionId={rowData.sectionId}
        name={rowData.sectionName ?? ''}
        itemCount={itemCount}
        color={rowData.sectionColor}
        sortActive={context.sortActive}
        canMoveUp={canMoveSection(context.moveEdges, rowData.sectionId, 'up')}
        canMoveDown={canMoveSection(context.moveEdges, rowData.sectionId, 'down')}
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
      // A foldable band toggles as a whole; rename stops its own click from bubbling here.
      <div
        {...toggleProps}
        // `w-max` + the `overflow: visible` rule in globals.css let the band out of the cell, so a
        // long name isn't clipped at the „Sekcja" column's width.
        className={cn(
          'flex h-full items-center gap-2 px-2 text-lg font-semibold',
          context.isBare ? 'w-full min-w-0' : 'w-max',
          foldable && 'hover:bg-accent/50 cursor-pointer',
        )}
      >
        <SectionDot />
        {context.isBare ? (
          <span className="truncate">{rowData.sectionName ?? ''}</span>
        ) : onRename ? (
          <SectionNameCell
            rowData={rowData}
            onRename={onRename}
            // `field-sizing-content`, not w-fit: an input's fit-content is its ~20-char default
            // width. w-auto beats the base cell's w-full. `shrink-0` because a field-sizing input
            // contributes no max-content width, so the band's `w-max` under-measures.
            className="field-sizing-content w-auto shrink-0 px-0 text-lg font-semibold"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="shrink-0 whitespace-nowrap">{rowData.sectionName ?? ''}</span>
        )}
        {!context.isBare && (
          <span className="text-muted-foreground shrink-0 text-sm font-normal">
            ({itemCount} poz.)
          </span>
        )}
        {/* „netto" spelled out: the grid carries a netto and a brutto reading of every money column,
            so a bare amount on the band leaves the reader guessing which one this is. */}
        {!context.isBare && net !== 0 && (
          <span className="shrink-0 text-sm whitespace-nowrap">
            <span className="font-medium tabular-nums">{formatNet(net)} zł</span>
            <span className="text-muted-foreground font-normal"> netto</span>
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

  // Blank cells toggle too; keyboard/aria stay on the label cell, the one control.
  return (
    <div
      aria-hidden
      title={title}
      onClick={foldable ? toggle : undefined}
      className={cn('size-full', foldable && 'cursor-pointer')}
    />
  )
}
