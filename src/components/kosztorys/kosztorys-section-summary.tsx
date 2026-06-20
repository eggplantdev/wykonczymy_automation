'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SectionSubtotalT } from '@/types/kosztorys'

type PropsT = {
  subtotals: SectionSubtotalT[]
  grandNet: number
  activeSectionId: number | null
  onClose: () => void
  onAddSection: () => void
  onAddItem: (sectionId: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onRemoveSection: (sectionId: number) => void
  onFilterSection: (sectionId: number | null) => void
}

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function KosztorysSectionSummary({
  subtotals,
  grandNet,
  activeSectionId,
  onClose,
  onAddSection,
  onAddItem,
  onRenameSection,
  onRemoveSection,
  onFilterSection,
}: PropsT) {
  // Inline rename: id edytowanej sekcji + bufor nazwy. null = nic nie edytujemy.
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

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
    if (window.confirm(`Usunąć sekcję „${s.sectionName}"? Usunie też ${s.itemCount} pozycji.`)) {
      onRemoveSection(s.sectionId)
    }
  }

  return (
    <aside className="border-border flex w-72 shrink-0 flex-col overflow-hidden border-l">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <h2 className="text-foreground text-sm font-medium">Sekcje</h2>
        <div className="flex items-center gap-1">
          {activeSectionId != null && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              onClick={() => onFilterSection(null)}
            >
              Pokaż wszystkie
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
        {subtotals.map((s) => {
          const isActive = s.sectionId === activeSectionId
          const isEditing = s.sectionId === editId
          return (
            <li key={s.sectionId} className={`px-3 py-2 ${isActive ? 'bg-accent/40' : ''}`}>
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
                    onClick={() => onFilterSection(isActive ? null : s.sectionId)}
                    className="text-foreground truncate text-left text-sm hover:underline"
                    title="Filtruj do tej sekcji"
                  >
                    {s.sectionName}
                  </button>
                )}
                <span className="text-foreground shrink-0 text-sm tabular-nums">{fmt(s.net)}</span>
              </div>

              <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                <span>
                  {s.itemCount} poz. · {(s.share * 100).toFixed(1)}%
                </span>
                <div className="flex items-center gap-0.5">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={commitEdit}
                        title="Zapisz nazwę"
                        className="hover:text-foreground p-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        title="Anuluj"
                        className="hover:text-foreground p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onAddItem(s.sectionId)}
                        title="Dodaj pozycję"
                        className="hover:text-foreground p-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(s.sectionId, s.sectionName)}
                        title="Zmień nazwę"
                        className="hover:text-foreground p-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRemove(s)}
                        title="Usuń sekcję"
                        className="hover:text-destructive p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="border-border shrink-0 border-t p-2">
        <Button size="sm" variant="outline" className="w-full" onClick={onAddSection}>
          <Plus className="mr-1 h-4 w-4" /> Nowa sekcja
        </Button>
      </div>
      <div className="border-border flex shrink-0 items-baseline justify-between border-t px-3 py-2">
        <span className="text-foreground text-sm font-medium">Suma netto</span>
        <span className="text-foreground text-sm font-medium tabular-nums">{fmt(grandNet)}</span>
      </div>
    </aside>
  )
}
