'use client'

import {
  Fragment,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  GripVertical,
  Redo2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox, checkedState } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { undoRedoIntent } from '@/components/kosztorys/editor/hooks/use-undo-keyboard'
import { writeKosztorysLayoutAction } from '@/lib/actions/kosztorys'
import {
  moveItems,
  moveSection,
  resolveDropTarget,
  sameLayout,
  type ItemDropTargetT,
  type KosztorysLayoutT,
  type ReorderDragT,
  type ReorderDropT,
} from '@/lib/kosztorys/reorder-layout'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { settleTreeReplace } from '@/lib/kosztorys/settle-tree-replace'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'
import { toggleInSet } from '@/lib/utils/toggle-in-set'

// The host mounts this only while open, so every opening starts from the grid's current order.
export function ReorderDialog({ onClose }: { onClose: () => void }) {
  const { rows, sections, investmentId, onTreeReplaced, noun, flushPendingSaves } =
    useKosztorysEditorContext()
  const [initial] = useState<KosztorysLayoutT>(() => {
    const rowsBySection = groupBySection(rows)
    return sections.map((section) => ({
      sectionId: section.sectionId,
      itemIds: (rowsBySection.get(section.sectionId) ?? []).map((row) => row.id),
    }))
  })
  const [labels] = useState(
    () => new Map(rows.map((row) => [row.id, { description: row.description, unit: row.unit }])),
  )
  const sectionMeta = new Map(sections.map((section) => [section.sectionId, section]))

  // Local to the dialog: nothing is written until „Zapisz kolejność”, so every move can be taken back.
  const [history, setHistory] = useState({
    past: [] as KosztorysLayoutT[],
    present: initial,
    future: [] as KosztorysLayoutT[],
  })
  const layout = history.present
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set())
  const [drop, setDrop] = useState<ReorderDropT | undefined>()
  const [pending, startTransition] = useTransition()
  const anchorRef = useRef<number | undefined>(undefined)
  const dragRef = useRef<ReorderDragT | undefined>(undefined)

  const flatItems = layout.flatMap((section) => section.itemIds)
  const changed = !sameLayout(layout, initial)

  function pushLayout(next: KosztorysLayoutT) {
    if (sameLayout(next, layout)) return
    setHistory(({ past, present }) => ({ past: [...past, present], present: next, future: [] }))
  }

  function undo() {
    setHistory(({ past, present, future }) => {
      const previous = past.at(-1)
      if (!previous) return { past, present, future }
      return { past: past.slice(0, -1), present: previous, future: [present, ...future] }
    })
  }

  function redo() {
    setHistory(({ past, present, future }) => {
      const [next, ...rest] = future
      if (!next) return { past, present, future }
      return { past: [...past, present], present: next, future: rest }
    })
  }

  function handleKeyDown(event: KeyboardEvent) {
    const intent = undoRedoIntent(event)
    if (!intent) return
    event.preventDefault()
    if (pending) return
    if (intent === 'undo') undo()
    else redo()
  }

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
    setSelected((current) => toggleInSet(current, id))
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

  function moveSelectedTo(target: ItemDropTargetT) {
    pushLayout(moveItems(layout, selected, target))
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

  function handleDragOver(event: DragEvent) {
    const drag = dragRef.current
    const element = (event.target as HTMLElement).closest<HTMLElement>(
      drag?.kind === 'section' ? '[data-section-block]' : '[data-section-id]',
    )
    if (!drag || !element) return
    event.preventDefault()
    const rect = element.getBoundingClientRect()
    const next = resolveDropTarget(
      layout,
      drag,
      {
        sectionId: Number(element.dataset.sectionId ?? element.dataset.sectionBlock),
        itemId: element.dataset.itemId ? Number(element.dataset.itemId) : undefined,
        upperHalf: event.clientY < rect.top + rect.height / 2,
      },
      collapsed,
    )
    if (JSON.stringify(next) !== JSON.stringify(drop)) setDrop(next)
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    const drag = dragRef.current
    if (drag && drop) {
      if (drag.kind === 'section' && drop.kind === 'section') {
        pushLayout(moveSection(layout, drag.sectionId, drop.beforeSectionId))
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
  const rowNumbers = new Map(flatItems.map((id, index) => [id, index + 1]))

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-7xl"
        onInteractOutside={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
      >
        <DialogHeader
          title="Ustaw kolejność"
          description="Zaznacz prace (Shift + klik zaznacza zakres) i przeciągnij je w nowe miejsce — także do innej sekcji. Sekcje przeciągasz za nagłówek. Ruch cofasz Ctrl/Cmd+Z. Nic się nie zapisuje do „Zapisz kolejność”; stan sprzed zapisze się w „Wersje”."
        />

        <div className="flex flex-wrap items-center gap-2 text-sm" inert={pending}>
          <span className="text-muted-foreground mr-auto">Zaznaczone: {selected.size}</span>
          <Button size="sm" variant="ghost" disabled={history.past.length === 0} onClick={undo}>
            <Undo2 />
            Cofnij
          </Button>
          <Button size="sm" variant="ghost" disabled={history.future.length === 0} onClick={redo}>
            <Redo2 />
            Ponów
          </Button>
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
        </div>

        {/* Grow only on the phone sheet (h-dvh): inside the desktop dialog's h-fit column Safari 18
            resolves a 0% flex-basis to zero and the list collapses to its border. */}
        <div
          inert={pending}
          className="reorder-list min-h-0 overflow-y-auto rounded-md border select-none max-sm:flex-1 sm:max-h-[60vh]"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        >
          {layout.map((section) => {
            const meta = sectionMeta.get(section.sectionId)
            const isCollapsed = collapsed.has(section.sectionId)
            const selectedCount = section.itemIds.filter((id) => selected.has(id)).length
            const allSelected =
              section.itemIds.length > 0 && selectedCount === section.itemIds.length
            const itemDropHere = drop?.kind === 'items' && drop.sectionId === section.sectionId
            return (
              <div
                key={section.sectionId}
                data-section-block={section.sectionId}
                // The rows paint the rail themselves: one on this wrapper would sit under their fills.
                className={sectionColorRail(meta?.sectionColor)}
              >
                {drop?.kind === 'section' && drop.beforeSectionId === section.sectionId && dropLine}
                <div
                  draggable
                  onDragStart={(event) => handleSectionDragStart(event, section.sectionId)}
                  data-section-id={section.sectionId}
                  className={cn(
                    'bg-muted shadow-section-rail sticky top-0 z-1 flex cursor-grab items-center gap-2 border-b px-2 py-1.5 text-sm font-medium',
                    itemDropHere &&
                      (isCollapsed || section.itemIds.length === 0) &&
                      'ring-primary ring-2 ring-inset',
                  )}
                >
                  <GripVertical className="text-muted-foreground size-4 shrink-0" />
                  <Checkbox
                    checked={checkedState(selectedCount, section.itemIds.length)}
                    disabled={section.itemIds.length === 0}
                    onCheckedChange={() => toggleSectionSelection(section.itemIds, !allSelected)}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1 text-left"
                    onClick={() =>
                      setCollapsed((current) => toggleInSet(current, section.sectionId))
                    }
                  >
                    {isCollapsed ? (
                      <ChevronRight className="size-4 shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{meta?.sectionName}</span>
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
                  section.itemIds.map((id) => {
                    const label = labels.get(id)
                    const isSelected = selected.has(id)
                    return (
                      <Fragment key={id}>
                        {itemDropHere && drop.beforeItemId === id && dropLine}
                        <div
                          draggable
                          onDragStart={(event) => handleItemDragStart(event, id)}
                          onClick={(event) => handleItemClick(event, id)}
                          data-section-id={section.sectionId}
                          data-item-id={id}
                          className={cn(
                            'shadow-section-rail flex cursor-grab items-center gap-2 border-b px-2 py-1 text-sm last:border-b-0',
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
                            {rowNumbers.get(id)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {label?.description || '(bez opisu)'}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {label?.unit}
                          </span>
                        </div>
                      </Fragment>
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
    </Dialog>
  )
}
