'use client'

import { useState } from 'react'
import { Ban, Banknote, Percent } from 'lucide-react'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { DiscountValueField } from '@/components/kosztorys/summary/discount-value-field'
import { SettingsSection } from '@/components/kosztorys/summary/settings-section'
import { globalDiscountForMode } from '@/lib/kosztorys/calc'
import { applyPercentDiscountSchema } from '@/lib/kosztorys/percent-discount'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'

type DiscountModeT = 'off' | 'amount' | 'percent'

const DISCOUNT_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'off', label: 'Wyłączony', icon: Ban },
  { value: 'amount', label: 'Kwotowy', icon: Banknote },
  { value: 'percent', label: '%', icon: Percent },
]

// Rabat is a client concession only (calc.ts netForQtyForView) — it never reaches the subcontractor
// views, so their prices stay whatever the plane sets.
const DISCOUNT_MODE_DESCRIPTIONS: Record<DiscountModeT, string> = {
  off: 'Rabaty dodane do poszczególnych pozycji nadal wpływają na kwotę rozliczenia.',
  amount:
    'Kwota netto odejmowana raz od sumy wykonanych prac. Nie łączy się z rabatami per pozycja — zastępuje je. Rabat nie wpływa na ceny podwykonawców.',
  percent:
    'Jednorazowo wpisuje ten sam % w rabat każdej pozycji, nadpisując istniejące. Rabat nie wpływa na ceny podwykonawców.',
}

// Locative of „pozycja" — „w 1 pozycji" vs „w 3 pozycjach".
function pozycji(count: number): string {
  return count === 1 ? 'pozycji' : 'pozycjach'
}

// Reads the setters straight from the editor context (the panel renders inside the provider), so no
// props thread through KosztorysTotalsPanel.
export function GlobalDiscountControl({ disabled = false }: { disabled?: boolean }) {
  const {
    globalDiscount,
    perItemDiscountTotal,
    itemsWithDiscountCount,
    handleGlobalDiscountChange,
    handleApplyPercentDiscount,
  } = useKosztorysEditorContext()

  // „%" and „Wyłączony" both store nothing, so that one bit is the only local state here. Everything
  // else is derived, so a rolled-back save (or Ctrl+Z replaying an earlier rabat) moves the select
  // with the figures instead of leaving it describing a deal the data no longer applies.
  const [percentPicked, setPercentPicked] = useState(false)
  const mode: DiscountModeT =
    globalDiscount.type != null ? 'amount' : percentPicked ? 'percent' : 'off'

  // The mode itself is the decision — „Kwotowy" suppresses per-item rabat at any kwota — so entering
  // it writes straight away rather than waiting for a kwota that may never be typed. Leaving it clears
  // the stored discount so the two never coexist, which keeps the percent one-shot always effective.
  function changeMode(next: string) {
    const nextMode = next as DiscountModeT
    setPercentPicked(nextMode === 'percent')
    handleGlobalDiscountChange(globalDiscountForMode(nextMode, perItemDiscountTotal))
  }

  return (
    <SettingsSection
      title="Rabat"
      subtitle="Wybierz rodzaj rabatu"
      hint={DISCOUNT_MODE_DESCRIPTIONS[mode]}
    >
      <SimpleSelect
        value={mode}
        onValueChange={changeMode}
        options={DISCOUNT_MODE_OPTIONS}
        disabled={disabled}
        variant="toolbarSm"
      />
      {mode === 'amount' && (
        <DiscountValueField
          suffix="zł"
          // `String` is not a formatter — it prints all 17 digits of whatever is stored, which is
          // how a kwota persisted before the write-side rounding still reads „172024,28000000003".
          value={String(roundToCents(globalDiscount.value))}
          placeholder="zł"
          disabled={disabled}
          isValid={(n) => n >= 0}
          onApply={(n) => handleGlobalDiscountChange({ type: 'amount', value: n })}
        />
      )}
      {mode === 'percent' && (
        <DiscountValueField
          suffix="%"
          value=""
          placeholder="%"
          disabled={disabled}
          isValid={(percent) => applyPercentDiscountSchema.safeParse({ percent }).success}
          onApply={handleApplyPercentDiscount}
          clearOnApply
          // With no rabat anywhere the write is not destructive, and a dialog would be a warning about
          // nothing — warnings that fire on nothing stop being read.
          confirm={
            itemsWithDiscountCount === 0
              ? undefined
              : (percent) => ({
                  title:
                    percent === 0
                      ? `Wyzerować rabat w ${itemsWithDiscountCount} ${pozycji(itemsWithDiscountCount)}?`
                      : `Wpisać ${percent}% w rabat każdej pozycji?`,
                  // The overwrite is not undoable (owner's ruling), so the dialog stands in undo's place
                  // and has to name both what is lost and the version the action auto-saves.
                  description: `${
                    percent === 0
                      ? `Rabaty wpisane ręcznie w ${itemsWithDiscountCount} ${pozycji(itemsWithDiscountCount)} zostaną wyzerowane.`
                      : `Rabaty wpisane ręcznie w ${itemsWithDiscountCount} ${pozycji(itemsWithDiscountCount)} zostaną nadpisane.`
                  } Ctrl+Z tego nie cofnie — stan sprzed zmiany zapisuje się automatycznie w wersjach kosztorysu.`,
                  confirmLabel: percent === 0 ? 'Wyzeruj rabaty' : 'Nadpisz rabaty',
                })
          }
        />
      )}
    </SettingsSection>
  )
}
