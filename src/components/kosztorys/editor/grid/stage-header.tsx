'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Description } from '@/components/ui/description'
import {
  DropdownMenuCheckboxRow,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { HeaderMenu } from '@/components/ui/datasheet-grid/header-menu'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { LabelHintIcon } from '@/components/ui/label-hint-icon'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'
import { StageWorkerSection } from './stage-worker-section'
import { ReassignWorkerConfirmDialog } from './reassign-worker-confirm-dialog'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { STAGE_HEADER_COPY as COPY } from './stage-header-copy'
import { SortIcon, SortMenuItems } from './sort-menu-items'
import { cn } from '@/lib/utils/cn'
import type { SortPickT } from '@/lib/kosztorys/row-view'
import { oneWorkerSplit, restHolderId } from '@/lib/kosztorys/stage-worker-split'
import type { KosztorysStageT, StageSplitT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

type PropsT = {
  stage: KosztorysStageT
  onRename?: (stageId: number, label: string) => void
  onRemove?: (stageId: number) => void
  onSetPlane?: (stageId: number, plane: ToolPlaneT) => void
  workers?: WorkerRefT[]
  onSetSplit?: (stageId: number, split: StageSplitT | null) => void
  // Sorting by this etap's quantity — its header is the only place that offers it.
  sort?: SortPickT | null
  onSort?: (pick: SortPickT | null) => void
  onPersistOrder?: () => void
  // The etap's executed value at its own plane — quoted in the reassignment confirm so the dialog and
  // the panel can't cite different amounts. 0 (or absent) means nothing has been executed here yet.
  executedValue?: number
}

export function StageHeader({
  stage,
  onRename,
  onRemove,
  onSetPlane,
  workers,
  onSetSplit,
  sort = null,
  onSort,
  onPersistOrder,
  executedValue = 0,
}: PropsT) {
  const label = stageLabel(stage)
  const { editing, start, inputProps } = useInlineRename((name) =>
    onRename?.(stage.id, name.trim()),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  // The worker a pending reassignment would move the etap to. `undefined` means no dialog is open —
  // `null` can't carry that, it is the legitimate „Bez przypisania" target.
  const [pendingWorkerId, setPendingWorkerId] = useState<number | null | undefined>(undefined)

  // The reference query is unfiltered; the roster section below is what narrows it to active workers,
  // and it says so on screen with a toggle rather than silently dropping names.
  const allWorkers = workers ?? []
  const assignedWorkerId = restHolderId(stage.split)
  const assignedWorker = allWorkers.find((worker) => worker.id === assignedWorkerId)
  const onSetWorker =
    onSetSplit &&
    ((stageId: number, workerId: number | null) =>
      onSetSplit(stageId, workerId == null ? null : oneWorkerSplit(workerId)))

  // Moving executed work off someone is the one destructive-feeling edit here: it drops their
  // „pozostało" by the amount and raises the new person's. Confirm only in that case — assigning an
  // empty etap, or filling in a blank assignment, needs no ceremony. Returns whether the confirm
  // opened, because the menu has to close for it.
  function pickWorker(workerId: number | null) {
    if (workerId === assignedWorkerId) return false
    if (executedValue > 0 && assignedWorkerId != null) {
      setPendingWorkerId(workerId)
      return true
    }
    onSetWorker?.(stage.id, workerId)
    return false
  }

  // No handlers = a read-only mount (preview): render the bare label, no menu/rename/delete AND no
  // plane icon or warning — the rozliczenie is internal subcontractor information, never client-facing.
  if (!onRename && !onRemove && !onSetPlane && !onSetWorker) {
    return (
      <HeaderLabel className={cn('px-1', !stage.label && 'text-muted-foreground')}>
        {label}
      </HeaderLabel>
    )
  }

  if (editing) {
    return (
      <EditableCellInput
        {...inputProps}
        autoFocus
        className="min-w-0 px-1 text-xs"
        placeholder={`Etap ${stage.ordinal}`}
      />
    )
  }

  return (
    <>
      <HeaderMenu
        label={
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                'inline-flex items-center gap-2',
                stage.plane == null && 'text-destructive',
              )}
            >
              {/* A wrench here would claim a crew nobody picked. */}
              {stage.plane != null && planeIcon(stage.plane)}
              <HeaderLabel
                className={cn(
                  stage.plane != null && !stage.label && 'text-muted-foreground',
                  sort && 'font-semibold',
                )}
              >
                {label}
              </HeaderLabel>
              {stage.plane == null && (
                <LabelHintIcon
                  variant="planeUnconfirmed"
                  content={COPY.planeUnconfirmed}
                  size="lg"
                />
              )}
              {/* The etap menu holds the sort, so its trigger has to carry the sort's state too —
                  otherwise the one column ordering the grid is the only one that never says so. */}
              {sort ? <SortIcon active={sort} /> : <ChevronDown className="opacity-50" />}
            </span>
            {assignedWorker && (
              <span className="text-muted-foreground text-2xs truncate">{assignedWorker.name}</span>
            )}
          </span>
        }
        icon={null}
        triggerClassName={cn(sort && 'text-primary')}
        triggerTitle="Opcje etapu"
      >
        {onSetPlane && (
          <>
            <DropdownMenuLabel>{COPY.planeSectionLabel}</DropdownMenuLabel>
            {/* Single-select skinned as checkboxes. onCheckedChange ignores its arg — re-picking the
                active plane can't unset it. */}
            {TOOL_PLANES.map((plane) => (
              <DropdownMenuCheckboxRow
                key={plane}
                checked={stage.plane === plane}
                onCheckedChange={() => onSetPlane(stage.id, plane)}
                label={PLANE_LABELS[plane]}
                trailing={planeIcon(plane)}
              />
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        {onSort && (
          <>
            <SortMenuItems active={sort} onSort={onSort} onPersistOrder={onPersistOrder} />
            <DropdownMenuSeparator />
          </>
        )}
        {/* Both actions sit ABOVE the roster: the roster is the one section that can run long, so
            anything under it would be a scroll away. */}
        <DropdownMenuItem onSelect={() => start(stage.label ?? '')}>
          <Pencil />
          {COPY.renameAction}
        </DropdownMenuItem>
        {onRemove && (
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            {COPY.removeAction}
          </DropdownMenuItem>
        )}
        {onSetWorker && (
          <>
            <DropdownMenuSeparator />
            {stage.plane == null ? (
              // Disabled until a rozliczenie exists: the settlement pass skips a plane-less etap
              // before it computes any value, so an assignment made here would show a name against a
              // silent 0 zł należne.
              <>
                <DropdownMenuLabel>{COPY.workerSectionLabel}</DropdownMenuLabel>
                <Description size="xs" className="px-2 py-1.5">
                  {COPY.workerNeedsPlane}
                </Description>
              </>
            ) : (
              <StageWorkerSection
                workers={allWorkers}
                selectedId={assignedWorkerId}
                onPick={pickWorker}
              />
            )}
          </>
        )}
      </HeaderMenu>

      <ConfirmDialog
        open={confirmOpen}
        title={COPY.removeConfirm.title(label)}
        description={COPY.removeConfirm.description}
        confirmLabel={COPY.removeConfirm.confirmLabel}
        onConfirm={() => {
          onRemove?.(stage.id)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ReassignWorkerConfirmDialog
        targetWorkerId={pendingWorkerId}
        stageLabel={label}
        executedValue={executedValue}
        currentWorkerName={assignedWorker?.name}
        workers={allWorkers}
        onConfirm={(workerId) => {
          onSetWorker?.(stage.id, workerId)
          setPendingWorkerId(undefined)
        }}
        onCancel={() => setPendingWorkerId(undefined)}
      />
    </>
  )
}
