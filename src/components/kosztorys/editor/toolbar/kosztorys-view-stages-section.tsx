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
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useTranslation } from '@/hooks/use-translation'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

// One tick per etap, over all three of its columns — which of those columns show is the
// „Etapy — …" ticks' job, so the two lists combine instead of multiplying into a row per column.
export function KosztorysViewStagesSection({ stages }: { stages: KosztorysStageT[] }) {
  const { t } = useTranslation('filters')
  const { isStageHidden, toggleStage, setStagesHidden } = useKosztorysEditorContext()

  if (stages.length === 0) return null

  const allVisible = stages.every((stage) => !isStageHidden(stage.id))

  return (
    <>
      <DropdownMenuLabel>Etapy</DropdownMenuLabel>
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
      {stages.map((stage) => (
        <DropdownMenuCheckboxRow
          key={stage.id}
          checked={!isStageHidden(stage.id)}
          onCheckedChange={() => toggleStage(stage.id)}
          label={stageLabel(stage)}
          trailing={stage.plane ? planeIcon(stage.plane, 'size-4') : undefined}
        />
      ))}
    </>
  )
}
