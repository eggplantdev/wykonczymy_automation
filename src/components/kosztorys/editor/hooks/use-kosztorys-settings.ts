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
import { roundToCents } from '@/lib/utils/round-to-cents'
import { MATERIALS_PRICING_IMPACT, SETTLEMENT_MODE_IMPACT } from '@/lib/kosztorys/investor-impact'
import { useInvestorImpactConfirm } from '@/components/kosztorys/editor/hooks/use-investor-impact-confirm'
import { usePendingStore } from '@/stores/pending-store'

const SETTINGS_PENDING_KEY = 'kosztorys-settings'

type ArgsT = {
  investmentId: number
  tree: KosztorysTreeT
  // Latest-value ref on the full dataset — the pre-patch capture each rollback needs, read at event
  // time rather than closed over.
  rowsRef: { current: KosztorysV2RowT[] }
  // Owned by the main hook: stage ops and section ops patch through it too.
  patchRows: (
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) => void
  pushReversible: <T>(label: string, apply: (state: T) => void, before: T, after: T) => void
}

// „Opcje rozliczenia" — the five investment-wide settings (global coefficients, VAT, tryb rozliczenia,
// stawka netto wydatków, rabat globalny) plus the percent bulk-apply. Each is an optimistic save with
// its own rollback; they share this hook's transition and undo plumbing and nothing else in the editor.
export function useKosztorysSettings({
  investmentId,
  tree,
  rowsRef,
  patchRows,
  pushReversible,
}: ArgsT) {
  // Global discount in local state (like `rows`/`stages`): the toggle patches it optimistically so
  // the derived total, column visibility, and per-item suppression all move in one render. Reading
  // `tree.globalDiscount` instead would leave the total + columns lagging the row flag until
  // router.refresh() lands — the transient the "never disagree" invariant below forbids.
  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscountT>(tree.globalDiscount)
  const globalDiscountActive = isGlobalDiscountActive(globalDiscount)
  // Undo/redo call applyGlobalDiscount through a closure captured when the entry was pushed, where
  // `globalDiscount` is already stale — so its failure rollback reads the live value from here.
  // Same latest-value ref pattern as `rowsRef`, for the same reason.
  const globalDiscountRef = useRef(globalDiscount)

  globalDiscountRef.current = globalDiscount
  // Writes nothing optimistically — every figure the four settings move is recomputed on the server,
  // so the panel can only change once the write lands. One shared flag for the block (they are
  // set-once decisions about the deal; nobody edits two at a time) disables it meanwhile, so the click
  // stops reading as inert. Counted rather than boolean because two saves can overlap.
  //
  // Not useTransition (EX-597): the optimistic patch and its rollback run inside the save, so React
  // kept the transition pending forever — block disabled, page re-rendering ~36×/s until reload.
  const [savesInFlight, setSavesInFlight] = useState(0)
  const isSavingSettings = savesInFlight > 0
  const { stageInvestorImpact, investorImpactConfirm } = useInvestorImpactConfirm()

  // Changing the global coefficient recomputes the derived prices of all non-overridden items.
  // Optimistic patch on the rows; the panel (which reads from `tree`) is reseeded by the action's
  // own re-render. Extracted so undo/redo can re-run it with a before/after patch of the same keys.
  async function applyGlobalCoeff(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    // patchRows builds fresh row objects, so `sample` still holds the pre-patch coefficients for the
    // revert. Only the coefficients present in `patch` map to their denormalized row fields.
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
        // Roll the optimistic coefficients back so the grid doesn't show an unsaved price (the
        // once-only useState seed means a plain refresh can't reseed it). No-op on an empty kosztorys.
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

  // Changing the per-investment VAT rate recomputes every brutto figure. vatRate is denormalized
  // on every row, so patch them all optimistically (router.refresh alone won't reseed `rows` — the
  // useState initializer runs once at mount); then persist + refresh for the panel. `vatRate` is a
  // fraction (0.08), converted from the panel's percent input at the commit site.
  async function applyVat(vatRate: number) {
    const prevVatRate = rowsRef.current[0]?.vatRate
    patchRows(
      () => true,
      (r) => ({ ...r, vatRate }),
    )
    return optimisticSettingSave(
      () => updateInvestmentVatAction(investmentId, vatRate),
      () => {
        // Roll the optimistic VAT back (no-op when there were no rows to patch). The toast still fires
        // regardless — it lives in optimisticSettingSave, so an empty kosztorys can't swallow the failure.
        if (prevVatRate === undefined) return
        patchRows(
          () => true,
          (r) => ({ ...r, vatRate: prevVatRate }),
        )
      },
      'Nie udało się zapisać stawki VAT',
    )
  }

  // Persist a single „Opcje rozliczenia" setting and put a landed change on the undo stack. The three settings that
  // share this shape differ only in where their `before` is read from — VAT off the denormalized rows,
  // the other two off `tree` — so that stays the caller's job.
  function saveSetting<T>(
    label: string,
    apply: (value: T) => Promise<boolean>,
    before: T,
    next: T,
  ) {
    // Keyed per setting, not per subsystem: nothing serialises these transitions, so changing VAT
    // and then tryb before the first lands would otherwise have the first `finally` clear the one
    // shared key while the second write is still on the wire — the pill vanishing mid-save is the
    // exact failure the store is keyed rather than boolean to prevent.
    const pendingKey = `${SETTINGS_PENDING_KEY}:${label}`
    setSavesInFlight((n) => n + 1)
    // The popover can close mid-save, so the progress signal has to live outside this subtree —
    // hence the global store rather than a pill rendered by „Opcje rozliczenia" itself.
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

  // The settlement mode isn't denormalized onto the rows, so there's nothing to patch optimistically:
  // persist, then let the refresh reseed `tree` for the panel that reads it.
  async function applySettlementMode(mode: SettlementModeT) {
    return optimisticSettingSave(
      () => updateInvestmentSettlementModeAction(investmentId, mode),
      () => {},
      'Nie udało się zapisać sposobu rozliczenia',
    )
  }

  // `depositImpact` is supplied by the caller rather than derived here: the wpłaty live with the
  // panel that renders the control, and this hook has never been given them. It carries what the
  // switch would strand — see `settlementModeDepositImpact`.
  function handleSettlementModeChange(mode: SettlementModeT, depositImpact?: string) {
    if (mode === tree.settlementMode) return
    // On the undo stack like its sibling investment settings — without it Ctrl+Z after a mode flip
    // silently reverts whatever unrelated edit preceded it.
    stageInvestorImpact([SETTLEMENT_MODE_IMPACT, depositImpact].filter(Boolean).join(' '), () =>
      saveSetting('Zmiana sposobu rozliczenia', applySettlementMode, tree.settlementMode, mode),
    )
  }

  // Same shape as the settlement mode: not denormalized onto the rows, so there is nothing to patch
  // optimistically — persist, then let the refresh reseed `tree` for the panel that reads it.
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
    // Only the brutto↔netto switch is confirmed. Correcting the stawka inside tryb netto doesn't
    // change which plane the investor is billed on, and it commits from a field with its own save
    // button — a dialog on every correction would train the owner to click through it.
    if (pricingModeOf(rate) === pricingModeOf(tree.materialsNetRate)) {
      save()
      return
    }
    stageInvestorImpact(MATERIALS_PRICING_IMPACT, save)
  }

  // Setting/clearing the global discount flips per-item rabat on or off for every row. Update the
  // local discount (drives the derived totals + column visibility) and patch the denormalized active
  // flag on every row in the same render, so all three surfaces move together; then persist.
  // Extracted like applyVat so undo/redo replays the whole move — reverting only the stored value
  // would leave the row flag disagreeing with it.
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
        // Roll all three surfaces back so they don't disagree on an unsaved discount.
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
    // Quantized on the way in, so nothing sub-grosz is ever persisted: the kwota is stored money the
    // field mirrors back as text, and a seeded Σ rabatów carries float residue from the products it
    // sums. Rounded BEFORE the no-op check, or a dirty stored value never matches its clean twin.
    const clean = { ...next, value: roundToCents(next.value) }
    // saveSetting's own guard is identity-based, which never fires on a fresh object — so the
    // no-op check is here, by field. Without it every „Kwotowy" re-pick and every re-commit of an
    // unchanged kwota would put a do-nothing entry on the undo stack.
    if (globalDiscount.type === clean.type && globalDiscount.value === clean.value) return
    saveSetting('Zmiana rabatu globalnego', applyGlobalDiscount, globalDiscount, clean)
  }

  // Percent rabat bulk-apply: a one-shot tool, not stored state (unlike handleGlobalDiscountChange).
  // Overwrites every item's per-item rabat with `percent X` — optimistically on the rows, then one
  // bulk SQL update. No undo entry (owner: recovery = re-typing). Returns success so the settings
  // control clears its input only when the write landed.
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
    // Roll each row's rabat back to its pre-apply value on failure — the once-only useState seed means
    // a refresh can't reseed it.
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
