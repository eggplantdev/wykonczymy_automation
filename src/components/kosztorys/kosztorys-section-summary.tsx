'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoeffField } from '@/components/kosztorys/coeff-field'
import { KosztorysSectionFilterMenu } from '@/components/kosztorys/kosztorys-section-filter-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HintTooltip } from '@/components/ui/tooltip'
import { formatNet as fmt, formatPercentPrecise } from '@/lib/kosztorys/format'
import type { SectionSubtotalT } from '@/lib/kosztorys/types'

type SectionCoeffsT = { wTools: number | null; ownTools: number | null }

type PropsT = {
  subtotals: SectionSubtotalT[]
  // Only to render the inherited value as each section field's placeholder — the global coeffs are
  // edited in the toolbar's settings row, not here.
  globalCoeffs: { wTools: number; ownTools: number }
  sectionCoeffs: Map<number, SectionCoeffsT>
  onClose: () => void
  onAddSection: () => void
  onAddItem: (sectionId: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onRemoveSection: (sectionId: number) => void
  onSectionCoeffChange: (
    sectionId: number,
    patch: { wToolsCoeff?: number | null; ownToolsCoeff?: number | null },
  ) => void
}

export function KosztorysSectionSummary({
  subtotals,
  globalCoeffs,
  sectionCoeffs,
  onClose,
  onAddSection,
  onAddItem,
  onRenameSection,
  onRemoveSection,
  onSectionCoeffChange,
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
    <aside className="border-border bg-background absolute inset-y-0 right-0 z-20 flex w-72 flex-col overflow-hidden border-l shadow-lg">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-foreground text-sm font-medium">Sekcje</h2>
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

              <div className="text-muted-foreground mt-1 flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-0.5">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={commitEdit}
                        title="Zapisz nazwę"
                        className="hover:text-foreground p-1"
                      >
                        <Check />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        title="Anuluj"
                        className="hover:text-foreground p-1"
                      >
                        <X />
                      </button>
                    </>
                  ) : (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title="Mnożnik ceny wykonawcy dla sekcji"
                            className="hover:text-foreground p-1"
                          >
                            <SlidersHorizontal />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-56 p-3">
                          <p className="text-foreground mb-2 text-xs font-medium">
                            Mnożnik ceny wykonawcy
                          </p>
                          <p className="text-muted-foreground mb-2 text-xs">
                            Puste = dziedziczy mnożnik globalny.
                          </p>
                          <div className="flex flex-col gap-1">
                            <CoeffField
                              label="z narzędziami"
                              nullable
                              value={sectionCoeffs.get(s.sectionId)?.wTools ?? null}
                              placeholder={globalCoeffs.wTools}
                              onCommit={(n) =>
                                onSectionCoeffChange(s.sectionId, { wToolsCoeff: n })
                              }
                            />
                            <CoeffField
                              label="bez narzędzi"
                              nullable
                              value={sectionCoeffs.get(s.sectionId)?.ownTools ?? null}
                              placeholder={globalCoeffs.ownTools}
                              onCommit={(n) =>
                                onSectionCoeffChange(s.sectionId, { ownToolsCoeff: n })
                              }
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      <button
                        type="button"
                        onClick={() => onAddItem(s.sectionId)}
                        title="Dodaj pozycję"
                        className="hover:text-foreground p-1"
                      >
                        <Plus />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRemove(s)}
                        title="Usuń sekcję"
                        className="hover:text-destructive p-1"
                      >
                        <Trash2 />
                      </button>
                    </>
                  )}
                </div>

                <HintTooltip
                  className="w-fit flex-col gap-0.5"
                  content={'Wartości liczone po cenie klienta.'}
                >
                  <span>Ilość pozycji: {s.itemCount}</span>
                  {s.completionRatio !== null && (
                    <>
                      <span>Udział w całości kosztorysu: {formatPercentPrecise(s.share)}</span>
                      <span>Wykonano {formatPercentPrecise(s.completionRatio)}</span>
                    </>
                  )}
                </HintTooltip>
              </div>
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
