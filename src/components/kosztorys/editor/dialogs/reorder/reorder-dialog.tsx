'use client'

import { useRef, useState, useTransition, type DragEvent, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight, CornerDownRight, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { writeKosztorysLayoutAction } from '@/lib/actions/kosztorys'
import type { KosztorysLayoutT } from '@/lib/db/kosztorys-layout'
import {
  moveItems,
  moveSection,
  sameLayout,
  type ItemDropTargetT,
} from '@/lib/kosztorys/reorder-layout'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'

// Each row paints the section's hue itself: a rail on the wrapper would sit under the rows' fills.
const RAIL = 'shadow-[inset_3px_0_0_var(--section-rail,transparent)]'

type DragT = { kind: 'items' } | { kind: 'section'; sectionId: number }
type DropT =
  | ({ kind: 'items' } & ItemDropTargetT)
  | { kind: 'section'; beforeSectionId: number | undefined }

export function ReorderDialog() {
  const { open, setOpen } = useKosztorysActions().reorder
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Mounted only while open, so every opening starts from the grid's current order. */}
      {open && <ReorderDialogBody onClose={() => setOpen(false)} />}
    </Dialog>
  )
}

function ReorderDialogBody({ onClose }: { onClose: () => void }) {
  const { rows, sections, investmentId, onTreeReplaced, noun, flushPendingSaves } =
    useKosztorysEditorContext()
  const [initial] = useState<KosztorysLayoutT>(() =>
    sections.map((section) => ({
      sectionId: section.sectionId,
      itemIds: rows.filter((row) => row.sectionId === section.sectionId).map((row) => row.id),
    })),
  )
  const [labels] = useState(
    () => new Map(rows.map((row) => [row.id, { description: row.description, unit: row.unit }])),
  )
  const sectionMeta = new Map(sections.map((section) => [section.sectionId, section]))

  const [layout, setLayout] = useState(initial)
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  const [drop, setDrop] = useState<DropT | undefined>()
  const [pending, startTransition] = useTransition()
  const anchorRef = useRef<number | undefined>(undefined)
  const dragRef = useRef<DragT | undefined>(undefined)

  const flatItems = layout.flatMap((section) => section.itemIds)
  const changed = !sameLayout(layout, initial)

  function handleItemClick(event: MouseEvent, id: number) {
    const anchor = anchorRef.current
    if (event.shiftKey && anchor !== undefined) {
      const from = flatItems.indexOf(anchor)
      const to = flatItems.indexOf(id)
      const range = flatItems.slice(Math.min(from, to), Math.max(from, to) + 1)
      setSelected((current) => new Set([...current, ...range]))
      return
    }
    anchorRef.current = id
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSectionSelection(itemIds: number[], select: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const id of itemIds) {
        if (select) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  function toggleCollapsed(sectionId: number) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  function moveSelectedTo(target: ItemDropTargetT) {
    setLayout((current) => moveItems(current, selected, target))
  }

  function handleItemDragStart(event: DragEvent, id: number) {
    // Dragging a row outside the selection drags that row alone, as in a spreadsheet.
    if (!selected.has(id)) {
      setSelected(new Set([id]))
      anchorRef.current = id
    }
    dragRef.current = { kind: 'items' }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(id))
  }

  function handleSectionDragStart(event: DragEvent, sectionId: number) {
    dragRef.current = { kind: 'section', sectionId }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(sectionId))
  }

  // One handler for the whole list instead of one per row: the row under the cursor names itself
  // through data attributes, and the top/bottom half decides which side of it the block lands.
  function handleDragOver(event: DragEvent) {
    const drag = dragRef.current
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-section-id]')
    if (!drag || !element) return
    event.preventDefault()
    const rect = element.getBoundingClientRect()
    const upperHalf = event.clientY < rect.top + rect.height / 2
    const sectionId = Number(element.dataset.sectionId)
    const itemId = element.dataset.itemId ? Number(element.dataset.itemId) : undefined
    const sectionIndex = layout.findIndex((section) => section.sectionId === sectionId)
    const section = layout[sectionIndex]

    let next: DropT
    if (drag.kind === 'section') {
      const beforeSectionId = upperHalf ? sectionId : layout[sectionIndex + 1]?.sectionId
      next = { kind: 'section', beforeSectionId }
    } else if (itemId === undefined) {
      // A section header: into that section, at the top — or at the end of a folded one, whose rows
      // can't show where the line went.
      const beforeItemId = collapsed.has(sectionId) ? undefined : section.itemIds[0]
      next = { kind: 'items', sectionId, beforeItemId }
    } else {
      const at = section.itemIds.indexOf(itemId)
      const beforeItemId = upperHalf ? itemId : section.itemIds[at + 1]
      next = { kind: 'items', sectionId, beforeItemId }
    }
    if (JSON.stringify(next) !== JSON.stringify(drop)) setDrop(next)
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    const drag = dragRef.current
    if (drag && drop) {
      if (drag.kind === 'section' && drop.kind === 'section') {
        setLayout((current) => moveSection(current, drag.sectionId, drop.beforeSectionId))
      }
      if (drag.kind === 'items' && drop.kind === 'items') moveSelectedTo(drop)
    }
    handleDragEnd()
  }

  function handleDragEnd() {
    dragRef.current = undefined
    setDrop(undefined)
  }

  function handleSave() {
    startTransition(async () => {
      await flushPendingSaves()
      const replaced = await settleTreeReplace(
        () => writeKosztorysLayoutAction(investmentId, layout),
        `Zapis kolejności przerwany — odświeżam ${noun.nominative}`,
        () => toastMessage('Kolejność zapisana', 'success'),
      )
      if (!replaced) return
      onClose()
      onTreeReplaced?.(replaced)
    })
  }

  const dropLine = <div className="bg-primary pointer-events-none h-0.5 rounded-full" />
  const firstNumbers = layout.map((_, index) =>
    layout.slice(0, index).reduce((total, section) => total + section.itemIds.length, 1),
  )

  return (
    <DialogContent className="sm:max-w-7xl" onInteractOutside={(event) => event.preventDefault()}>
      <DialogHeader
        title="Ustaw kolejność"
        description="Zaznacz prace (Shift + klik zaznacza zakres) i przeciągnij je w nowe miejsce — także do innej sekcji. Sekcje przeciągasz za nagłówek. Nic się nie zapisuje do „Zapisz kolejność”; stan sprzed zapisze się w „Wersje”."
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground mr-auto">Zaznaczone: {selected.size}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setCollapsed(new Set(layout.map((section) => section.sectionId)))}
        >
          Zwiń sekcje
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed(new Set())}>
          Rozwiń sekcje
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={selected.size === 0}
          onClick={() => setSelected(new Set())}
        >
          Odznacz
        </Button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto rounded-md border select-none sm:max-h-[60vh]"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        {layout.map((section, sectionIndex) => {
          const isCollapsed = collapsed.has(section.sectionId)
          const selectedCount = section.itemIds.filter((id) => selected.has(id)).length
          const allSelected = section.itemIds.length > 0 && selectedCount === section.itemIds.length
          const itemDropHere = drop?.kind === 'items' && drop.sectionId === section.sectionId
          const firstNumber = firstNumbers[sectionIndex]
          return (
            <div
              key={section.sectionId}
              className={sectionColorRail(sectionMeta.get(section.sectionId)?.sectionColor)}
            >
              {drop?.kind === 'section' && drop.beforeSectionId === section.sectionId && dropLine}
              <div
                draggable
                onDragStart={(event) => handleSectionDragStart(event, section.sectionId)}
                data-section-id={section.sectionId}
                className={cn(
                  'bg-muted sticky top-0 z-1 flex cursor-grab items-center gap-2 border-b px-2 py-1.5 text-sm font-medium',
                  RAIL,
                  itemDropHere &&
                    (isCollapsed || section.itemIds.length === 0) &&
                    'ring-primary ring-2 ring-inset',
                )}
              >
                <GripVertical className="text-muted-foreground size-4 shrink-0" />
                <Checkbox
                  checked={allSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
                  disabled={section.itemIds.length === 0}
                  onCheckedChange={() => toggleSectionSelection(section.itemIds, !allSelected)}
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 text-left"
                  onClick={() => toggleCollapsed(section.sectionId)}
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4 shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0" />
                  )}
                  <span className="truncate">
                    {sectionMeta.get(section.sectionId)?.sectionName}
                  </span>
                </button>
                {selected.size > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      moveSelectedTo({ sectionId: section.sectionId, beforeItemId: undefined })
                    }
                  >
                    <CornerDownRight />
                    Przenieś tutaj
                  </Button>
                )}
                <span className="text-muted-foreground w-8 text-right text-xs font-normal">
                  {section.itemIds.length}
                </span>
              </div>
              {!isCollapsed &&
                section.itemIds.map((id, index) => {
                  const label = labels.get(id)
                  const isSelected = selected.has(id)
                  return (
                    <div key={id}>
                      {itemDropHere && drop.beforeItemId === id && dropLine}
                      <div
                        draggable
                        onDragStart={(event) => handleItemDragStart(event, id)}
                        onClick={(event) => handleItemClick(event, id)}
                        data-section-id={section.sectionId}
                        data-item-id={id}
                        className={cn(
                          'flex cursor-grab items-center gap-2 border-b px-2 py-1 text-sm last:border-b-0',
                          RAIL,
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                        )}
                      >
                        <GripVertical className="text-muted-foreground size-4 shrink-0" />
                        <Checkbox
                          checked={isSelected}
                          tabIndex={-1}
                          className="pointer-events-none"
                        />
                        <span className="text-muted-foreground w-8 shrink-0 text-right tabular-nums">
                          {firstNumber + index}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {label?.description || '(bez opisu)'}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {label?.unit}
                        </span>
                      </div>
                    </div>
                  )
                })}
              {!isCollapsed && itemDropHere && drop.beforeItemId === undefined && dropLine}
            </div>
          )
        })}
        {drop?.kind === 'section' && drop.beforeSectionId === undefined && dropLine}
      </div>

      <DialogActions
        confirmLabel="Zapisz kolejność"
        pending={pending}
        pendingLabel="Zapisuję…"
        confirmDisabled={!changed}
        onConfirm={handleSave}
        onCancel={onClose}
      />
    </DialogContent>
  )
}
