'use client'

import { DropdownMenuCheckboxRow, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DropdownMenuSection } from '@/components/ui/dropdown-menu-section'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { StageCompletedMark } from '@/components/kosztorys/editor/stage-completed-mark'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useTranslation } from '@/hooks/use-translation'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

export function KosztorysViewStagesSection({
  stages,
  storageKey,
}: {
  stages: KosztorysStageT[]
  storageKey: string
}) {
  const gridDictionary = useTranslation('grid')
  const { isStageOff, toggleStage, setStagesHidden } = useKosztorysEditorContext()

  const statusRows = [
    {
      key: 'stagesCompletedGroup',
      ids: stages.filter((stage) => stage.completed).map((stage) => stage.id),
    },
    {
      key: 'stagesActiveGroup',
      ids: stages.filter((stage) => !stage.completed).map((stage) => stage.id),
    },
  ] as const

  return (
    <DropdownMenuSection label="Etapy" collapseStorageKey={storageKey}>
      {statusRows.map((row) => {
        if (row.ids.length === 0) return null
        const allShown = row.ids.every((id) => !isStageOff(id))
        return (
          <DropdownMenuCheckboxRow
            key={row.key}
            checked={allShown}
            onCheckedChange={() => setStagesHidden(row.ids, allShown)}
            label={gridDictionary.t(row.key, { count: row.ids.length })}
          />
        )
      })}
      <DropdownMenuSeparator />
      {stages.map((stage) => (
        <DropdownMenuCheckboxRow
          key={stage.id}
          checked={!isStageOff(stage.id)}
          onCheckedChange={() => toggleStage(stage.id)}
          label={stageLabel(stage, gridDictionary)}
          trailing={
            <span className="flex items-center gap-1 [&_svg]:size-4">
              {stage.completed && <StageCompletedMark />}
              {stage.plane && planeIcon(stage.plane, 'size-4')}
            </span>
          }
        />
      ))}
    </DropdownMenuSection>
  )
}
