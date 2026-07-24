'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KosztorysSectionFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-section-filter-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'

type PropsT = {
  subtotals: SectionSubtotalT[]
  onClose: () => void
  onAddSection: () => void
  onAddItem: (sectionId: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onRemoveSection: (sectionId: number) => void
}

export function KosztorysSectionSummary({
  subtotals,
  onClose,
  onAddSection,
  onAddItem,
  onRenameSection,
  onRemoveSection,
}: PropsT) {
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [pendingRemove, setPendingRemove] = useState<SectionSubtotalT | null>(null)

  function startEdit(sectionId: number, name: string) {
    setEditId(sectionId)
    setDraft(name)
  }

  function commitEdit() {
    const name = draft.trim()
    if (editId != null && name) onRenameSection(editId, name)
    setEditId(null)
  }

  function confirmRemove(s: SectionSubtotalT) {
    setPendingRemove(s)
  }

  return (
    <aside className="border-border bg-background absolute inset-y-0 right-0 z-30 flex w-72 flex-col overflow-hidden border-l shadow-lg">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-foreground text-sm font-medium">Widok sekcji</h2>
          <KosztorysSectionFilterMenu />
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X />
        </Button>
      </div>

      <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
        {subtotals.map((s) => {
          const isEditing = s.sectionId === editId
          return (
            <li key={s.sectionId} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                {isEditing ? (
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    className="h-7 text-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(s.sectionId, s.sectionName)}
                    className="group text-foreground flex min-w-0 items-center gap-1 text-left text-sm"
                    title="Edytuj nazwę"
                  >
                    <span className="truncate">{s.sectionName}</span>
                    <Pencil className="text-muted-foreground size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )}
                <span className="text-foreground shrink-0 text-sm tabular-nums">{fmt(s.net)}</span>
              </div>

              {isEditing ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 gap-1.5"
                    onClick={commitEdit}
                  >
                    <Check className="size-4" /> Zapisz
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 gap-1.5"
                    onClick={() => setEditId(null)}
                  >
                    <X className="size-4" /> Anuluj
                  </Button>
                </div>
              ) : (
                <div className="mt-1.5 flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-start gap-1.5"
                    onClick={() => onAddItem(s.sectionId)}
                  >
                    <Plus className="size-4" /> Dodaj pozycję do sekcji
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive w-full justify-start gap-1.5"
                    onClick={() => confirmRemove(s)}
                  >
                    <Trash2 className="size-4" /> Usuń sekcję
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="border-border shrink-0 border-t p-2">
        <Button size="sm" variant="outline" className="w-full" onClick={onAddSection}>
          <Plus className="mr-1" /> Nowa sekcja
        </Button>
      </div>

      <ConfirmDialog
        open={pendingRemove != null}
        title={`Usunąć sekcję „${pendingRemove?.sectionName}"?`}
        description={`Usunie też ${pendingRemove?.itemCount} pozycji wraz z wpisanymi w nich ilościami etapów. Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        onConfirm={() => {
          if (pendingRemove) onRemoveSection(pendingRemove.sectionId)
          setPendingRemove(null)
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </aside>
  )
}
