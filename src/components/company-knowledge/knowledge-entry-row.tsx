'use client'

import { Reorder, useDragControls } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import { Panel } from '@/components/ui/panel'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import type { CompanyKnowledgeEntryT } from '@/lib/company-knowledge/types'

type PropsT = {
  entry: CompanyKnowledgeEntryT
  draggable: boolean
  onDragEnd: () => void
  onEdit: () => void
  onDelete: () => void
  editor?: ReactNode
}

// Dragged by the grip only, so the text stays selectable and the actions stay clickable.
export function KnowledgeEntryRow({
  entry,
  draggable,
  onDragEnd,
  onEdit,
  onDelete,
  editor,
}: PropsT) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={entry.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
    >
      <Panel className="bg-card flex gap-2 p-3">
        {draggable && (
          <GripVertical
            className="text-muted-foreground mt-0.5 size-4 shrink-0 cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={(event) => controls.start(event)}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {editor ?? (
            <>
              <div className="flex items-center gap-2">
                <h3 className={SUBSECTION_TITLE_CLASS}>{entry.topic}</h3>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <EditButton label="Edytuj wpis" onClick={onEdit} />
                  <DeleteButton label="Usuń wpis" onClick={onDelete} />
                </div>
              </div>
              <p className="text-muted-foreground text-sm whitespace-pre-line">{entry.content}</p>
            </>
          )}
        </div>
      </Panel>
    </Reorder.Item>
  )
}
