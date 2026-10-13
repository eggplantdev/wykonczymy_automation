'use client'

import { CheckCheck } from 'lucide-react'
import {
  DropdownMenuCheckboxRow,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  keepMenuOpen,
} from '@/components/ui/dropdown-menu'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { StageCompletedMark } from '@/components/kosztorys/editor/stage-completed-mark'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useTranslation } from '@/hooks/use-translation'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

export function KosztorysViewStagesSection({ stages }: { stages: KosztorysStageT[] }) {
  const { t } = useTranslation('filters')
  const gridDictionary = useTranslation('grid')
  const {
    isStageHidden,
    hideCompletedStages,
    setHideCompletedStages,
    toggleStage,
    setStagesHidden,
  } = useKosztorysEditorContext()

  const allVisible = stages.every((stage) => !isStageHidden(stage.id))

  return (
    <>
      <DropdownMenuLabel>Etapy</DropdownMenuLabel>
      <DropdownMenuCheckboxRow
        checked={hideCompletedStages}
        onCheckedChange={setHideCompletedStages}
        label="Ukryj zakończone"
      />
      <DropdownMenuItem
        onSelect={keepMenuOpen(() =>
          setStagesHidden(
            stages.map((stage) => stage.id),
            allVisible,
          ),
        )}
      >
        <CheckCheck />
        {allVisible ? t('hideAll') : t('showAll')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {/* A zakończony etap stays listed under „Ukryj zakończone" — greyed, so the reader sees why it
          is off the grid, and its tick still answers for when the filter goes off. */}
      {stages.map((stage) => (
        <DropdownMenuCheckboxRow
          key={stage.id}
          checked={!isStageHidden(stage.id)}
          onCheckedChange={() => toggleStage(stage.id)}
          label={stageLabel(stage, gridDictionary)}
          className={cn(hideCompletedStages && stage.completed && 'text-muted-foreground')}
          trailing={
            <span className="flex items-center gap-1">
              {stage.completed && <StageCompletedMark />}
              {stage.plane && planeIcon(stage.plane, 'size-4')}
            </span>
          }
        />
      ))}
    </>
  )
}
