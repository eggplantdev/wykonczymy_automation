'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoeffField } from '@/components/kosztorys/coeff-field'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toGross } from '@/lib/kosztorys/calc'
import { formatNet as fmt, formatPercentPrecise } from '@/lib/kosztorys/format'
import { toastMessage } from '@/lib/utils/toast'
import type { SectionSubtotalT } from '@/types/kosztorys'

type SectionCoeffsT = { wTools: number | null; ownTools: number | null }

type PropsT = {
  subtotals: SectionSubtotalT[]
  grandNet: number
  activeSectionId: number | null
  // Only to render the inherited value as each section field's placeholder — the global coeffs are
  // edited in the toolbar's settings row, not here.
  globalCoeffs: { wTools: number; ownTools: number }
  sectionCoeffs: Map<number, SectionCoeffsT>
  // VAT rate as a fraction (0.08) — read-only here, drives the Suma brutto readout.
  vatRate: number
  // Global discount off the executed total + the resulting "do zapłaty", both from the editor hook's
  // single source (no recompute here). amount 0 = no discount → the block stays as plain Suma.
  discountAmount: number
  doZaplatyNet: number
  onClose: () => void
  onAddSection: () => void
  onAddItem: (sectionId: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onRemoveSection: (sectionId: number) => void
  // Mirrors the server delete-guard: a populated section is blocked with a toast (no confirm).
  isSectionPopulated: (sectionId: number) => boolean
  onFilterSection: (sectionId: number | null) => void
  onSectionCoeffChange: (
    sectionId: number,
    patch: { wToolsCoeff?: number | null; ownToolsCoeff?: number | null },
  ) => void
}

export function KosztorysSectionSummary({
  subtotals,
  grandNet,
  activeSectionId,
  globalCoeffs,
  sectionCoeffs,
  vatRate,
  discountAmount,
  doZaplatyNet,
  onClose,
  onAddSection,
  onAddItem,
  onRenameSection,
  onRemoveSection,
  isSectionPopulated,
  onFilterSection,
  onSectionCoeffChange,
}: PropsT) {
  // Inline rename: id of the section being edited + name buffer. null = nothing is being edited.
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  // Section pending delete-confirmation (drives the AlertDialog). null = nothing pending.
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
    // Block a populated section before the confirm — the server guard would reject it anyway.
    if (isSectionPopulated(s.sectionId)) {
      toastMessage('Najpierw wyczyść wartości w pozycjach tej sekcji', 'warning', 4000)
      return
    }
    setPendingRemove(s)
  }

  return (
    <aside className="border-border bg-background absolute inset-y-0 right-0 z-20 flex w-72 flex-col overflow-hidden border-l shadow-lg">
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
                <SimpleTooltip
                  delayDuration={600}
                  className="max-w-xs whitespace-pre-line"
                  content={
                    'Liczba pozycji w sekcji, udział sekcji w wartości kosztorysu oraz jej wykonanie.\n\nUdział = wartość sekcji ÷ wartość kosztorysu.\nWyk. = wartość wykonanych etapów w sekcji ÷ wartość przedmiaru sekcji.\n\nOba procenty liczą się od wartości, nie od liczby pozycji, i zależą od aktywnego widoku cen.\n„—" przy wyk. = sekcja nie ma jeszcze przedmiaru.'
                  }
                >
                  <span className="cursor-help">
                    {s.itemCount} poz. · {formatPercentPrecise(s.share)} · wyk.{' '}
                    {formatPercentPrecise(s.plannedNet > 0 ? s.net / s.plannedNet : null)}
                  </span>
                </SimpleTooltip>
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

              <div className="mt-1 flex flex-col gap-1">
                <CoeffField
                  label="z narzędziami"
                  nullable
                  value={sectionCoeffs.get(s.sectionId)?.wTools ?? null}
                  placeholder={globalCoeffs.wTools}
                  onCommit={(n) => onSectionCoeffChange(s.sectionId, { wToolsCoeff: n })}
                />
                <CoeffField
                  label="bez narzędzi"
                  nullable
                  value={sectionCoeffs.get(s.sectionId)?.ownTools ?? null}
                  placeholder={globalCoeffs.ownTools}
                  onCommit={(n) => onSectionCoeffChange(s.sectionId, { ownToolsCoeff: n })}
                />
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
      {discountAmount > 0 && (
        <>
          <div className="text-muted-foreground flex shrink-0 items-baseline justify-between px-3 pb-1 text-xs">
            <span>− Rabat globalny</span>
            <span className="tabular-nums">{fmt(discountAmount)}</span>
          </div>
          <div className="border-border flex shrink-0 items-baseline justify-between border-t px-3 py-2">
            <span className="text-foreground text-sm font-medium">Do zapłaty netto</span>
            <span className="text-foreground text-sm font-medium tabular-nums">
              {fmt(doZaplatyNet)}
            </span>
          </div>
        </>
      )}
      <div className="border-border flex shrink-0 items-baseline justify-between border-t px-3 py-2">
        <span className="text-foreground text-sm font-medium">
          {discountAmount > 0 ? 'Do zapłaty brutto' : 'Suma brutto'}
        </span>
        <span className="text-foreground text-sm font-medium tabular-nums">
          {fmt(toGross(doZaplatyNet, vatRate))}
        </span>
      </div>

      <ConfirmDialog
        open={pendingRemove != null}
        title={`Usunąć sekcję „${pendingRemove?.sectionName}"?`}
        description={`Usunie też ${pendingRemove?.itemCount} pozycji. Tej operacji nie można cofnąć.`}
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
