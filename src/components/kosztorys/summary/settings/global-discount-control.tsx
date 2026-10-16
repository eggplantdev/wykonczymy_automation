'use client'

import { useState } from 'react'
import { Ban, Banknote, Percent } from 'lucide-react'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { DiscountAmountPairField } from '@/components/kosztorys/summary/settings/discount-amount-pair-field'
import { DiscountValueField } from '@/components/kosztorys/summary/settings/discount-value-field'
import { SettingsSection } from '@/components/kosztorys/summary/settings/settings-section'
import { globalDiscountForMode } from '@/lib/kosztorys/calc'
import { applyPercentDiscountSchema } from '@/lib/kosztorys/percent-discount'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'

type DiscountModeT = 'off' | 'amount' | 'percent'

const DISCOUNT_MODE_OPTIONS: SelectOptionT[] = [
  { value: 'off', label: 'Wyłączony', icon: Ban },
  { value: 'amount', label: 'Kwotowy', icon: Banknote },
  { value: 'percent', label: '%', icon: Percent },
]

const DISCOUNT_MODE_DESCRIPTIONS: Record<DiscountModeT, string> = {
  off: 'Rabaty dodane do poszczególnych pozycji nadal wpływają na kwotę rozliczenia.',
  amount:
    'Kwota odejmowana raz od sumy wykonanych prac. Wpisz ją w netto albo w brutto — drugą przeliczamy po stawce VAT inwestycji. Nie łączy się z rabatami per pozycja — zastępuje je. Rabat nie wpływa na ceny podwykonawców.',
  percent:
    'Jednorazowo wpisuje ten sam % w rabat każdej pozycji, nadpisując istniejące. Rabat nie wpływa na ceny podwykonawców.',
}

function pozycji(count: number): string {
  return count === 1 ? 'pozycji' : 'pozycjach'
}

export function GlobalDiscountControl({ disabled = false }: { disabled?: boolean }) {
  const {
    tree,
    globalDiscount,
    perItemDiscountTotal,
    itemsWithDiscountCount,
    handleGlobalDiscountChange,
    handleApplyPercentDiscount,
  } = useKosztorysEditorContext()

  // Everything else is derived, so a rolled-back save (or Ctrl+Z replaying an earlier rabat) moves
  // the select with the figures instead of leaving it describing a deal the data no longer applies.
  const [percentPicked, setPercentPicked] = useState(false)
  const mode: DiscountModeT =
    globalDiscount.type != null ? 'amount' : percentPicked ? 'percent' : 'off'

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
        <DiscountAmountPairField
          value={globalDiscount.value}
          vatRate={tree.vatRate}
          disabled={disabled}
          onApply={(net) => handleGlobalDiscountChange({ type: 'amount', value: net })}
        />
      )}
      {mode === 'percent' && (
        <DiscountValueField
          suffix="%"
          placeholder="%"
          disabled={disabled}
          isValid={(percent) => applyPercentDiscountSchema.safeParse({ percent }).success}
          onApply={handleApplyPercentDiscount}
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
