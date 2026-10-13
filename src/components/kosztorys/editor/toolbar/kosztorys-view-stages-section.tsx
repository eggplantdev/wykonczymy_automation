'use client'

import { Check, CheckCheck } from 'lucide-react'
import {
  DropdownMenuCheckboxRow,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  keepMenuOpen,
} from '@/components/ui/dropdown-menu'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useTranslation } from '@/hooks/use-translation'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// One tick per etap, over all three of its columns — which of those columns show is the
// „Etapy — …" ticks' job, so the two lists combine instead of multiplying into a row per column.
export function KosztorysViewStagesSection({ stages }: { stages: KosztorysStageT[] }) {
  const { t } = useTranslation('filters')
  const {
    isStageHidden,
    hideCompletedStages,
    setHideCompletedStages,
    toggleStage,
    setStagesHidden,
  } = useKosztorysEditorContext()

  if (stages.length === 0) return null

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
          label={stageLabel(stage)}
          className={cn(hideCompletedStages && stage.completed && 'text-muted-foreground')}
          trailing={
            <span className="flex items-center gap-1">
              {stage.completed && (
                <span title="Etap zakończony" className="inline-flex text-green-600">
                  <Check className="size-3.5" />
                </span>
              )}
              {stage.plane && planeIcon(stage.plane, 'size-4')}
            </span>
          }
        />
      ))}
    </>
  )
}
