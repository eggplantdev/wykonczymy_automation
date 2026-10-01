'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, Trash2, Users } from 'lucide-react'

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
import { StageSplitDialog } from '@/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { useTranslation } from '@/lib/i18n/use-translation'
import { STAGE_HEADER_COPY as COPY } from './stage-header-copy'
import { SortIcon, SortMenuItems } from './sort-menu-items'
import { cn } from '@/lib/utils/cn'
import type { SortPickT } from '@/lib/kosztorys/row-view'
import { resolveWorkerName } from '@/lib/kosztorys/payouts-by-worker'
import { restHolderId } from '@/lib/kosztorys/stage-split'
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
  // The etap's executed value at its own plane — the pool the split dialog divides, the same figure
  // the panel credits. 0 (or absent) means nothing has been executed here yet.
  executedValue?: number
  scaledDown?: boolean
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
  scaledDown = false,
}: PropsT) {
  const gridDictionary = useTranslation('grid')
  const label = stageLabel(stage, gridDictionary)
  const { editing, start, inputProps } = useInlineRename((name) =>
    onRename?.(stage.id, name.trim()),
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)

  const allWorkers = workers ?? []
  const nameById = new Map(allWorkers.map((worker) => [worker.id, worker.name]))
  const restHolder = restHolderId(stage.split)
  const others = (stage.split?.members.length ?? 1) - 1
  const workerLine =
    restHolder == null
      ? null
      : resolveWorkerName(restHolder, nameById) + (others > 0 ? ` +${others}` : '')

  // No handlers = a read-only mount (preview): render the bare label, no menu/rename/delete AND no
  // plane icon or warning — the rozliczenie is internal subcontractor information, never client-facing.
  if (!onRename && !onRemove && !onSetPlane && !onSetSplit) {
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
              {scaledDown && <LabelHintIcon variant="splitScaled" size="lg" />}
              {/* The etap menu holds the sort, so its trigger has to carry the sort's state too —
                  otherwise the one column ordering the grid is the only one that never says so. */}
              {sort ? <SortIcon active={sort} /> : <ChevronDown className="opacity-50" />}
            </span>
            {workerLine && (
              <span className="text-muted-foreground text-2xs truncate">{workerLine}</span>
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
        {onSetSplit && (
          <>
            <DropdownMenuSeparator />
            {/* Disabled until a rozliczenie exists: the settlement pass skips a plane-less etap
                before it computes any value, so a split made here would divide a silent 0 zł. */}
            <DropdownMenuItem disabled={stage.plane == null} onSelect={() => setSplitOpen(true)}>
              <Users />
              {COPY.splitAction}
            </DropdownMenuItem>
            {stage.plane == null && (
              <Description size="xs" className="px-2 py-1.5">
                {COPY.workerNeedsPlane}
              </Description>
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

      {splitOpen && onSetSplit && (
        <StageSplitDialog
          stageLabel={label}
          split={stage.split}
          pool={executedValue}
          workers={allWorkers}
          onSave={(split) => onSetSplit(stage.id, split)}
          onClose={() => setSplitOpen(false)}
        />
      )}
    </>
  )
}
