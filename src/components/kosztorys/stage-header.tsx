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
// a ✕ delete. The input is uncontrolled, so `defaultValue` is read at mount only — and dsg keys
// header cells by column INDEX (`Grid.js:98`, the virtualizer's `col.key`), so deleting a stage
// slides every later stage one index left onto a DOM node that keeps the previous stage's text.
// Keying the input on `stage.id` remounts it when the identity behind the index changes; without
// it, the stale label blurs into `onRename(nextStage.id, previousStageLabel)`. Until `ee497cb` the
// grid's `stagesKey` remount hid this by rebuilding everything on any stage add/remove.
export function StageHeader({ stage, onRename, onRemove, tip }: PropsT) {
  const row = (
    <div className="flex size-full items-center gap-1">
      <input
        key={stage.id}
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
