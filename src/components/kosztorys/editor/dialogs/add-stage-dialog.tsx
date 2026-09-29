'use client'

import { useState } from 'react'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { Label } from '@/components/ui/label'
import { SearchSelect } from '@/components/ui/search-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { STAGE_HEADER_COPY as COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const UNASSIGNED = 'unassigned'

type PicksT = { plane?: ToolPlaneT; workerId?: number | null }

// Etapy are opened one after another for the same crew on the same terms, so the last etap's
// rozliczenie and pracownik are proposed, not stored anywhere: the picks are derived from `stages`
// until the user touches a field, and forgotten on close.
export function AddStageDialog({ open, onOpenChange }: PropsT) {
  const { stages, workers, handleAddStage } = useKosztorysEditorContext()
  const [picks, setPicks] = useState<PicksT>({})

  // `stages` is ordinal-ordered (the tree sorts it, an added etap takes max+1), so the last entry is
  // the right-most column.
  const lastStage = stages.at(-1)
  // No proposal for the first etap: the rozliczenie picks which crew's stawka prices every quantity
  // booked into the etap, and a default here would be confirmed without being read.
  const plane = picks.plane ?? lastStage?.plane
  const workerId = picks.workerId !== undefined ? picks.workerId : (lastStage?.workerId ?? null)

  const workerItems = [
    { value: UNASSIGNED, label: COPY.workerUnassigned },
    ...activeOrSelected(workers, true, workerId).map((worker) => ({
      value: String(worker.id),
      label: worker.name,
    })),
  ]

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) setPicks({})
  }

  function handleConfirm() {
    if (!plane) return
    handleOpenChange(false)
    void handleAddStage(plane, workerId)
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Dodaj etap"
      description="Oba pola zmienisz później w nagłówku etapu."
      confirmLabel="Dodaj"
      onConfirm={handleConfirm}
      confirmDisabled={!plane}
    >
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2">
          <Label>{COPY.planeSectionLabel}</Label>
          <SimpleSelect
            value={plane ?? ''}
            onValueChange={(next) =>
              setPicks((p) => ({ ...p, plane: TOOL_PLANES.find((option) => option === next) }))
            }
            placeholder="Wybierz rozliczenie"
            options={TOOL_PLANES.map((option) => ({
              value: option,
              label: (
                <>
                  {planeIcon(option)}
                  {PLANE_LABELS[option]}
                </>
              ),
            }))}
          />
        </div>
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="add-stage-worker">{COPY.workerSectionLabel}</Label>
          <SearchSelect
            id="add-stage-worker"
            value={workerId == null ? UNASSIGNED : String(workerId)}
            onChange={(next) =>
              setPicks((p) => ({ ...p, workerId: next === UNASSIGNED ? null : Number(next) }))
            }
            items={workerItems}
            searchPlaceholder={COPY.searchPlaceholder}
            emptyMessage={COPY.searchEmpty}
          />
        </div>
      </div>
    </FormDialogShell>
  )
}
