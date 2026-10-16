'use client'

import { useRef, useState } from 'react'
import {
  applyPercentDiscountToAllItemsAction,
  updateInvestmentCoeffsAction,
  updateInvestmentGlobalDiscountAction,
  updateInvestmentMaterialsNetRateAction,
  updateInvestmentSettlementModeAction,
  updateInvestmentVatAction,
} from '@/lib/actions/kosztorys'
import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'
import { pricingModeOf } from '@/lib/kosztorys/materials-pricing-mode'
import {
  optimisticSettingSave,
  reversibleSettingSave,
} from '@/lib/kosztorys/optimistic-setting-save'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { GlobalDiscountT, KosztorysTreeT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import { inverseGlobalCoeffPatch } from '@/lib/kosztorys/v2-rows'
import { MATERIALS_PRICING_IMPACT, SETTLEMENT_MODE_IMPACT } from '@/lib/kosztorys/investor-impact'
import { useInvestorImpactConfirm } from '@/components/kosztorys/editor/hooks/use-investor-impact-confirm'
import { usePendingStore } from '@/stores/pending-store'

const SETTINGS_PENDING_KEY = 'kosztorys-settings'

type ArgsT = {
  investmentId: number
  tree: KosztorysTreeT
  rowsRef: { current: KosztorysV2RowT[] }
  patchRows: (
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) => void
  pushReversible: <T>(label: string, apply: (state: T) => void, before: T, after: T) => void
}

export function useKosztorysSettings({
  investmentId,
  tree,
  rowsRef,
  patchRows,
  pushReversible,
}: ArgsT) {
  // Reading `tree.globalDiscount` instead would leave the total + columns lagging the row flag until
  // the action's render lands.
  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscountT>(tree.globalDiscount)
  const globalDiscountActive = isGlobalDiscountActive(globalDiscount)
  // Undo/redo call applyGlobalDiscount through a closure captured when the entry was pushed, where
  // `globalDiscount` is already stale — so its failure rollback reads the live value from here.
  const globalDiscountRef = useRef(globalDiscount)

  globalDiscountRef.current = globalDiscount
  // Not useTransition (EX-597): the optimistic patch and its rollback run inside the save, so React
  // kept the transition pending forever — block disabled, page re-rendering ~36×/s until reload.
  const [savesInFlight, setSavesInFlight] = useState(0)
  const isSavingSettings = savesInFlight > 0
  const { stageInvestorImpact, investorImpactConfirm } = useInvestorImpactConfirm()

  async function applyGlobalCoeff(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    // patchRows builds fresh row objects, so `sample` still holds the pre-patch coefficients for the
    // revert.
    const sample = rowsRef.current[0]
    const applied: { globalWToolsCoeff?: number; globalOwnToolsCoeff?: number } = {}
    if (patch.wToolsCoeff != null) applied.globalWToolsCoeff = patch.wToolsCoeff
    if (patch.ownToolsCoeff != null) applied.globalOwnToolsCoeff = patch.ownToolsCoeff
    patchRows(
      () => true,
      (r) => ({ ...r, ...applied }),
    )
    return optimisticSettingSave(
      () => updateInvestmentCoeffsAction(investmentId, patch),
      () => {
        if (!sample) return
        const restored: { globalWToolsCoeff?: number; globalOwnToolsCoeff?: number } = {}
        if (patch.wToolsCoeff != null) restored.globalWToolsCoeff = sample.globalWToolsCoeff
        if (patch.ownToolsCoeff != null) restored.globalOwnToolsCoeff = sample.globalOwnToolsCoeff
        patchRows(
          () => true,
          (r) => ({ ...r, ...restored }),
        )
      },
      'Nie udało się zapisać współczynnika',
    )
  }

  async function handleGlobalCoeffChange(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    const before = inverseGlobalCoeffPatch(patch, rowsRef.current[0])
    await reversibleSettingSave(
      applyGlobalCoeff,
      pushReversible,
      'Zmiana współczynnika',
      before,
      patch,
    )
  }

  // `vatRate` is a fraction (0.08), converted from the panel's percent input at the commit site.
  async function applyVat(vatRate: number) {
    const prevVatRate = rowsRef.current[0]?.vatRate
    patchRows(
      () => true,
      (r) => ({ ...r, vatRate }),
    )
    return optimisticSettingSave(
      () => updateInvestmentVatAction(investmentId, vatRate),
      () => {
        if (prevVatRate === undefined) return
        patchRows(
          () => true,
          (r) => ({ ...r, vatRate: prevVatRate }),
        )
      },
      'Nie udało się zapisać stawki VAT',
    )
  }

  function saveSetting<T>(
    label: string,
    apply: (value: T) => Promise<boolean>,
    before: T,
    next: T,
  ) {
    // changing VAT and then tryb before the first lands would otherwise have the first `finally` clear
    // the one shared key while the second write is still on the wire.
    const pendingKey = `${SETTINGS_PENDING_KEY}:${label}`
    setSavesInFlight((n) => n + 1)
    // The popover can close mid-save, so the progress signal has to live outside this subtree.
    usePendingStore.getState().start(pendingKey, 'Zapisywanie…')
    void (async () => {
      try {
        await reversibleSettingSave(apply, pushReversible, label, before, next)
      } finally {
        usePendingStore.getState().stop(pendingKey)
        setSavesInFlight((n) => n - 1)
      }
    })()
  }

  function handleVatChange(vatRate: number) {
    saveSetting('Zmiana stawki VAT', applyVat, rowsRef.current[0]?.vatRate ?? tree.vatRate, vatRate)
  }

  async function applySettlementMode(mode: SettlementModeT) {
    return optimisticSettingSave(
      () => updateInvestmentSettlementModeAction(investmentId, mode),
      () => {},
      'Nie udało się zapisać sposobu rozliczenia',
    )
  }

  function handleSettlementModeChange(mode: SettlementModeT, depositImpact?: string) {
    if (mode === tree.settlementMode) return
    // without it Ctrl+Z after a mode flip silently reverts whatever unrelated edit preceded it.
    stageInvestorImpact([SETTLEMENT_MODE_IMPACT, depositImpact].filter(Boolean).join(' '), () =>
      saveSetting('Zmiana sposobu rozliczenia', applySettlementMode, tree.settlementMode, mode),
    )
  }

  async function applyMaterialsNetRate(rate: number | null) {
    return optimisticSettingSave(
      () => updateInvestmentMaterialsNetRateAction(investmentId, rate),
      () => {},
      'Nie udało się zapisać stawki netto wydatków',
    )
  }

  function handleMaterialsNetRateChange(rate: number | null) {
    const save = () =>
      saveSetting(
        'Zmiana stawki netto wydatków',
        applyMaterialsNetRate,
        tree.materialsNetRate,
        rate,
      )
    // Correcting the stawka inside tryb netto doesn't change which plane the investor is billed on, and
    // it commits from a field with its own save button — a dialog on every correction would train the
    // owner to click through it.
    if (pricingModeOf(rate) === pricingModeOf(tree.materialsNetRate)) {
      save()
      return
    }
    stageInvestorImpact(MATERIALS_PRICING_IMPACT, save)
  }

  async function applyGlobalDiscount(discount: GlobalDiscountT) {
    const prevDiscount = globalDiscountRef.current
    setGlobalDiscount(discount)
    patchRows(
      () => true,
      (r) => ({ ...r, globalDiscountActive: isGlobalDiscountActive(discount) }),
    )
    return optimisticSettingSave(
      () =>
        updateInvestmentGlobalDiscountAction(investmentId, {
          globalDiscountType: discount.type,
          globalDiscountValue: discount.value,
        }),
      () => {
        setGlobalDiscount(prevDiscount)
        patchRows(
          () => true,
          (r) => ({ ...r, globalDiscountActive: isGlobalDiscountActive(prevDiscount) }),
        )
      },
      'Nie udało się zapisać rabatu',
    )
  }

  function handleGlobalDiscountChange(next: GlobalDiscountT) {
    // Not rounded here: the kwota field already sent grosze or six places (discountNetFromGross), and
    // cutting a brutto entry to grosze would re-gross it a grosz off what was typed.
    if (globalDiscount.type === next.type && globalDiscount.value === next.value) return
    saveSetting('Zmiana rabatu globalnego', applyGlobalDiscount, globalDiscount, next)
  }

  async function handleApplyPercentDiscount(percent: number): Promise<boolean> {
    const prev = new Map(
      rowsRef.current.map((r) => [
        r.id,
        { discountType: r.discountType, discountValue: r.discountValue },
      ]),
    )
    patchRows(
      () => true,
      (r) => ({ ...r, discountType: 'percent', discountValue: percent }),
    )
    return optimisticSettingSave(
      () => applyPercentDiscountToAllItemsAction(investmentId, percent),
      () =>
        patchRows(
          () => true,
          (r) => ({ ...r, ...(prev.get(r.id) ?? {}) }),
        ),
      'Nie udało się zastosować rabatu',
    )
  }

  return {
    globalDiscount,
    globalDiscountActive,
    isSavingSettings,
    investorImpactConfirm,
    handleGlobalCoeffChange,
    handleVatChange,
    handleSettlementModeChange,
    handleMaterialsNetRateChange,
    handleGlobalDiscountChange,
    handleApplyPercentDiscount,
  }
}
