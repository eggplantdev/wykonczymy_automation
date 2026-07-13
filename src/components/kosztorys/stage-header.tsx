'use client'

import { X } from 'lucide-react'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { KosztorysStageT } from '@/types/kosztorys'

type PropsT = {
  stage: KosztorysStageT
  onRename?: (stageId: number, label: string) => void
  onRemove?: (stageId: number) => void
  tip?: string
}

// Stage column header: an editable label (empty → the "Etap N" placeholder, persisting null) plus
// a ✕ delete. Uncontrolled input — it reinitializes on the grid remount that a stage add/remove
// forces (the stage set is in the remount key); a rename doesn't remount, so the typed value stays.
export function StageHeader({ stage, onRename, onRemove, tip }: PropsT) {
  const row = (
    <div className="flex size-full items-center gap-1">
      <input
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        defaultValue={stage.label ?? ''}
        placeholder={`Etap ${stage.ordinal}`}
        onBlur={(e) => onRename?.(stage.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      {onRemove && (
        <button
          type="button"
          title="Usuń etap"
          onClick={() => onRemove(stage.id)}
          className="text-muted-foreground hover:text-destructive shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
  if (!tip) return row
  return (
    <SimpleTooltip content={tip} delayDuration={600} className="max-w-xs whitespace-pre-line">
      {row}
    </SimpleTooltip>
  )
}
