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
import { StageCompletedMark } from '@/components/kosztorys/editor/stage-completed-mark'
import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { StageSplitDialog } from '@/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { useTranslation } from '@/hooks/use-translation'
import { STAGE_HEADER_COPY as COPY } from './stage-header-copy'
import { SortIcon, SortMenuItems } from './sort-menu-items'
import { cn } from '@/lib/utils/cn'
import type { SortPickT } from '@/lib/kosztorys/row-view'
import { resolveWorkerName } from '@/lib/kosztorys/payouts-by-worker'
import { restHolderId } from '@/lib/kosztorys/stage-split'
import type { StageOpsT } from './kosztorys-v2-column-opts'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

type PropsT = {
  stage: KosztorysStageT
  ops?: StageOpsT
  workers?: WorkerRefT[]
  sort?: SortPickT | null
  onSort?: (pick: SortPickT | null) => void
  onPersistOrder?: () => void
  executedValue?: number
  scaledDown?: boolean
  color?: SectionColorKeyT | null
  onSetColor?: (color: SectionColorKeyT | null) => void
}

export function StageHeader({
  stage,
  ops,
  workers,
  sort = null,
  onSort,
  onPersistOrder,
  executedValue = 0,
  scaledDown = false,
  color = null,
  onSetColor,
}: PropsT) {
  const gridDictionary = useTranslation('grid')
  const label = stageLabel(stage, gridDictionary)
  const { editing, start, inputProps } = useInlineRename((name) =>
    ops?.rename(stage.id, name.trim()),
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

  const completedMark = stage.completed && <StageCompletedMark />

  if (!ops) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1 px-1">
        {completedMark}
        <HeaderLabel className={cn(!stage.label && 'text-muted-foreground')}>{label}</HeaderLabel>
      </span>
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
              {stage.plane != null && planeIcon(stage.plane)}
              {completedMark}
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
        <DropdownMenuLabel>{COPY.planeSectionLabel}</DropdownMenuLabel>
        {TOOL_PLANES.map((plane) => (
          <DropdownMenuCheckboxRow
            key={plane}
            checked={stage.plane === plane}
            onCheckedChange={() => ops.setPlane(stage.id, plane)}
            label={PLANE_LABELS[plane]}
            trailing={planeIcon(plane)}
          />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxRow
          checked={stage.completed}
          onCheckedChange={(checked) => ops.setCompleted(stage.id, checked === true)}
          label={gridDictionary.t('stageCompleted')}
        />
        <DropdownMenuSeparator />
        {onSort && (
          <>
            <SortMenuItems active={sort} onSort={onSort} onPersistOrder={onPersistOrder} />
            <DropdownMenuSeparator />
          </>
        )}
        {onSetColor && (
          <>
            <SectionColorPicker value={color} onChange={onSetColor} />
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => start(stage.label ?? '')}>
          <Pencil />
          {COPY.renameAction}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
          <Trash2 />
          {COPY.removeAction}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Disabled until a rozliczenie exists: the settlement pass skips a plane-less etap before it
            computes any value, so a split made here would divide a silent 0 zł. */}
        <DropdownMenuItem disabled={stage.plane == null} onSelect={() => setSplitOpen(true)}>
          <Users />
          {COPY.splitAction}
        </DropdownMenuItem>
        {stage.plane == null && (
          <Description size="xs" className="px-2 py-1.5">
            {COPY.workerNeedsPlane}
          </Description>
        )}
      </HeaderMenu>

      <ConfirmDialog
        open={confirmOpen}
        title={COPY.removeConfirm.title(label)}
        description={COPY.removeConfirm.description}
        confirmLabel={COPY.removeConfirm.confirmLabel}
        onConfirm={() => {
          ops.remove(stage.id)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {splitOpen && (
        <StageSplitDialog
          stageLabel={label}
          split={stage.split}
          pool={executedValue}
          workers={allWorkers}
          onSave={(split) => ops.setSplit(stage.id, split)}
          onClose={() => setSplitOpen(false)}
        />
      )}
    </>
  )
}
