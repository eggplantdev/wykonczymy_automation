'use client'

import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { isOverCeiling, MAX_CLIENT_SHARE } from '@/lib/kosztorys/subcontractor-price-guard'
import { formatPercent, formatRate } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import type {
  CatalogueFigureDiffT,
  CataloguePriceDiffT,
  SeedConflictFieldT,
} from '@/lib/kosztorys/work-catalogue/types'

/**
 * The rozjazdy against the cennik, as a thing to ACT on rather than read: one wiersz per liczba,
 * grouped under the praca it belongs to, each with a checkbox, and one przycisk that pulls every
 * ticked liczba from the katalog into the rozpiska.
 *
 * Its own table rather than the shared `ComparisonTable`: a checkbox column breaks that component's
 * one rule (first column left, every other one right-aligned figures), and it is what the three
 * arkusz windows are built from — windows this change has nothing to do with.
 *
 * The selection lives here, keyed by `itemId` and by the machine field name. Not by row index: the
 * list is sorted by `maxDelta`, so an index means a different praca the moment anything is saved.
 */
export function CatalogueDiffTable({
  diffs,
  readOnly,
  onApply,
  onEditInCatalogue,
}: {
  diffs: readonly CataloguePriceDiffT[]
  readOnly: boolean
  onApply: (
    selections: { itemId: number; fields: SeedConflictFieldT[] }[],
  ) => Promise<boolean> | boolean
  // The other direction, kept on the praca's own wiersz: an overwrite of the cennik carries all
  // three liczby at once, so it is one entry per praca and never one per liczba.
  onEditInCatalogue: (itemId: number) => void
}) {
  const [selection, setSelection] = useState<Map<number, Set<SeedConflictFieldT>>>(new Map())
  const [saving, setSaving] = useState(false)

  const selectedCount = [...selection.values()].reduce((sum, fields) => sum + fields.size, 0)
  const figureCount = diffs.reduce((sum, diff) => sum + diff.figures.length, 0)

  function toggleFigure(itemId: number, field: SeedConflictFieldT) {
    setSelection((prev) => {
      const next = new Map(prev)
      const fields = new Set(next.get(itemId) ?? [])
      if (fields.has(field)) fields.delete(field)
      else fields.add(field)
      // An empty Set would keep the praca in the map and make „wszystko odznaczone" look like a
      // selection of zero liczb on N prac.
      if (fields.size === 0) next.delete(itemId)
      else next.set(itemId, fields)
      return next
    })
  }

  function toggleItem(diff: CataloguePriceDiffT) {
    setSelection((prev) => {
      const next = new Map(prev)
      // Partial counts as „not selected", so the first click on a half-ticked praca completes it —
      // the gesture that follows from looking at a box that is not full.
      if (next.get(diff.itemId)?.size === diff.figures.length) next.delete(diff.itemId)
      else next.set(diff.itemId, new Set(diff.figures.map((figure) => figure.field)))
      return next
    })
  }

  function toggleAll() {
    setSelection((prev) => {
      const selected = [...prev.values()].reduce((sum, fields) => sum + fields.size, 0)
      if (selected === figureCount) return new Map()
      return new Map(
        diffs.map((diff) => [diff.itemId, new Set(diff.figures.map((figure) => figure.field))]),
      )
    })
  }

  async function apply() {
    setSaving(true)
    const selections = [...selection].map(([itemId, fields]) => ({ itemId, fields: [...fields] }))
    const saved = await onApply(selections)
    setSaving(false)
    // Only on success: a failed write leaves the rozjazdy standing, and clearing the ticks would
    // make the owner re-find them.
    if (saved) setSelection(new Map())
  }

  const allSelected = selectedCount === figureCount

  return (
    <div className="space-y-2">
      {/* Same shape as every other mass-select in the app (`filter-multi-select`): the `CheckCheck`
          glyph plus a label that flips, rather than a bare header checkbox nobody reads as an offer. */}
      {!readOnly && (
        <Button variant="link" size="xs" className="h-auto p-0" onClick={toggleAll}>
          <CheckCheck />
          {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
        </Button>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs">
              <th className="w-6 py-1 font-normal" />
              <th className="py-1 text-left font-normal">Liczba</th>
              <th className="py-1 pl-3 text-right font-normal">Kosztorys</th>
              <th className="py-1 pl-3 text-right font-normal">Katalog</th>
              <th className="py-1 pl-3 text-right font-normal">Różnica</th>
              <th className="py-1 font-normal" />
            </tr>
          </thead>
          <tbody>
            {diffs.map((diff) => {
              const fields = selection.get(diff.itemId)
              return (
                <DiffGroup
                  key={diff.itemId}
                  diff={diff}
                  fields={fields}
                  readOnly={readOnly}
                  onToggleItem={() => toggleItem(diff)}
                  onToggleFigure={(field) => toggleFigure(diff.itemId, field)}
                  onEditInCatalogue={() => onEditInCatalogue(diff.itemId)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button size="sm" disabled={selectedCount === 0 || saving} onClick={apply}>
          Aktualizuj kosztorys ({selectedCount})
        </Button>
      )}
    </div>
  )
}

// Radix's own three-way value, so the praca box says „część" instead of claiming the whole praca.
const checkedState = (selected: number, total: number): boolean | 'indeterminate' =>
  selected === 0 ? false : selected === total ? true : 'indeterminate'

function DiffGroup({
  diff,
  fields,
  readOnly,
  onToggleItem,
  onToggleFigure,
  onEditInCatalogue,
}: {
  diff: CataloguePriceDiffT
  fields: Set<SeedConflictFieldT> | undefined
  readOnly: boolean
  onToggleItem: () => void
  onToggleFigure: (field: SeedConflictFieldT) => void
  onEditInCatalogue: () => void
}) {
  // What the praca would look like after saving exactly what is ticked — the ceiling has to warn
  // BEFORE the write, and the owner ticks in bulk without opening a single praca.
  const priceFigure = diff.figures.find((figure) => figure.field === 'clientPrice')
  const clientPrice =
    priceFigure && fields?.has('clientPrice') ? priceFigure.catalogue : diff.clientPrice

  return (
    <>
      <tr className="border-border/60 border-t align-middle">
        <td className="py-1">
          {!readOnly && (
            <Checkbox
              aria-label={diff.description}
              checked={checkedState(fields?.size ?? 0, diff.figures.length)}
              onCheckedChange={onToggleItem}
            />
          )}
        </td>
        <td className="py-1 font-medium" colSpan={4}>
          {diff.description}
          <span className="text-muted-foreground"> ({diff.unit || 'bez j.m.'})</span>
        </td>
        <td className="py-1 pl-3 text-right whitespace-nowrap">
          {!readOnly && (
            <Button variant="link" size="xs" className="h-auto p-0" onClick={onEditInCatalogue}>
              Edytuj w katalogu
            </Button>
          )}
        </td>
      </tr>
      {diff.figures.map((figure) => (
        <FigureRow
          key={figure.field}
          figure={figure}
          checked={fields?.has(figure.field) ?? false}
          readOnly={readOnly}
          clientPrice={clientPrice}
          onToggle={() => onToggleFigure(figure.field)}
        />
      ))}
    </>
  )
}

const sideText = (value: number, source: PriceSourceT, coeff: number | null) =>
  formatRate(source === 'auto' ? null : value, source, coeff)

function FigureRow({
  figure,
  checked,
  readOnly,
  clientPrice,
  onToggle,
}: {
  figure: CatalogueFigureDiffT
  checked: boolean
  readOnly: boolean
  clientPrice: number
  onToggle: () => void
}) {
  const merged = checked ? figure.catalogue : figure.kosztorys
  const overCeiling = figure.field !== 'clientPrice' && isOverCeiling(merged, { clientPrice })

  return (
    <tr className="border-border/40 border-t align-middle">
      <td className="py-1">
        {!readOnly && (
          <Checkbox aria-label={figure.label} checked={checked} onCheckedChange={onToggle} />
        )}
      </td>
      <td className="text-muted-foreground py-1 pl-6">
        {figure.label}
        {overCeiling && (
          <span className="text-destructive pl-2">
            przekracza {formatPercent(MAX_CLIENT_SHARE)} ceny
          </span>
        )}
      </td>
      {/* „auto" on either side, never the kwota it implies: that kwota is a product of this
          inwestycja's współczynnik, so printing it would show a number nobody entered and which
          moves when the współczynnik does. A mnożnik prints as the mnożnik it is, with its kwota
          beside it — there the multiple IS what was agreed, and the kwota follows from it. */}
      <td className="py-1 pl-3 text-right tabular-nums">
        {sideText(figure.kosztorys, figure.kosztorysSource, figure.kosztorysCoeff)}
      </td>
      <td className="py-1 pl-3 text-right tabular-nums">
        {sideText(figure.catalogue, figure.catalogueSource, figure.catalogueCoeff)}
      </td>
      {/* Greyed where either side is „auto": the subtraction is still the honest gap, but one of its
          operands is a derived kwota rather than a figure anybody typed. */}
      <td
        className={`py-1 pl-3 text-right tabular-nums ${
          figure.kosztorysSource === 'auto' || figure.catalogueSource === 'auto'
            ? 'text-muted-foreground'
            : 'text-amber-600'
        }`}
      >
        {formatPLN(figure.delta)}
      </td>
      <td />
    </tr>
  )
}
