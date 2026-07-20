'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { HeaderMenu } from '@/components/kosztorys/header-menu'
import { cn } from '@/lib/utils/cn'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type PropsT = {
  stage: KosztorysStageT
  onRename?: (stageId: number, label: string) => void
  onRemove?: (stageId: number) => void
  tip?: string
}

// Stage column header: „Zmień nazwę" edits the label inline (empty → the „Etap N" placeholder,
// persisting null), „Usuń etap" deletes behind a confirm. The inline input is uncontrolled, so its
// `defaultValue` is read only when edit mode opens — no stale value can leak if the stage behind
// this column index shifts under the persisted DOM node.
export function StageHeader({ stage, onRename, onRemove, tip }: PropsT) {
  const label = stage.label ?? `Etap ${stage.ordinal}`
  const [editing, setEditing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // No handlers = a read-only mount (clientView): render the bare label, no menu/rename/delete.
  // Wraps (no truncate) to match the other client headers under the taller header row.
  if (!onRename && !onRemove) {
    return (
      <span className={cn('px-1 text-sm', stage.label == null && 'text-muted-foreground')}>
        {label}
      </span>
    )
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="h-full w-full min-w-0 bg-transparent px-1 text-sm outline-none"
        defaultValue={stage.label ?? ''}
        placeholder={`Etap ${stage.ordinal}`}
        onBlur={(e) => {
          onRename?.(stage.id, e.target.value.trim())
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.currentTarget.value = stage.label ?? ''
            e.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <>
      <HeaderMenu
        label={
          <span className={cn('truncate', stage.label == null && 'text-muted-foreground')}>
            {label}
          </span>
        }
        icon={<ChevronDown className="opacity-50" />}
        triggerTitle="Opcje etapu"
        tip={tip}
      >
        <DropdownMenuItem onSelect={() => setEditing(true)}>
          <Pencil className="opacity-70" />
          Zmień nazwę
        </DropdownMenuItem>
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2 />
              Usuń etap
            </DropdownMenuItem>
          </>
        )}
      </HeaderMenu>

      <ConfirmDialog
        open={confirmOpen}
        title={`Usunąć „${label}"?`}
        description="Kolumna etapu i wszystkie wpisane w niej ilości zostaną usunięte."
        confirmLabel="Usuń"
        onConfirm={() => {
          onRemove?.(stage.id)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
