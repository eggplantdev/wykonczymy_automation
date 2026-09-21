import type { Payload } from 'payload'
import type { InvestmentFormDataT } from '@/components/forms/investment-form/investment-schema'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import { logError } from '@/lib/utils/log-error'

const SEED_PRESET_WARNING =
  'Inwestycja utworzona, ale nie udało się wypełnić kosztorysu z szablonu. Otwórz edytor i uzupełnij ręcznie.'

/**
 * Create an investment and seed its kosztorys from the chosen szablon.
 *
 * Extracted from `createInvestmentAction` so promoting a lead runs the SAME body: the preset-seed
 * warning behaviour is easy to fork and hard to notice forked, and a promoted investment that
 * silently skipped its seed would look identical to one that didn't.
 */
export async function createInvestment(
  payload: Payload,
  data: InvestmentFormDataT,
): Promise<{ id: number; warning?: string }> {
  // presetId is a form-only field (seed source), never an investments column.
  const { presetId, ...investmentData } = data
  const created = await payload.create({
    collection: 'investments',
    // Not on the create form — the mode is chosen later in the kosztorys panel.
    data: { ...investmentData, settlementMode: SETTLEMENT_MODE_DEFAULT },
  })

  // Best-effort and NON-FATAL: the investment is already committed, so a seed failure must never
  // flip the whole action to failure — that would skip the ['investments'] revalidation (hiding the
  // just-created investment from the cached list) and invite a duplicate-creating retry. Instead we
  // surface a `warning` the form toasts, so the user isn't left staring at a silently-empty
  // kosztorys — „Sekcja z szablonu…" in the editor's „Dodaj" menu still lets them retry. No
  // kosztorys* tree tags here — a fresh investment has no cached tree to invalidate yet.
  const chosenPresetId = presetId ? Number(presetId) : null
  if (!chosenPresetId) return { id: Number(created.id) }

  try {
    const result = await seedInvestmentFromPreset(payload, Number(created.id), chosenPresetId)
    if (result === 'ok') return { id: Number(created.id) }
    // TODO(EX-449) SENTRY-REQUIRED: silent seed skip the user can't self-report.
    logError(
      `[create-investment] seed from preset ${chosenPresetId} skipped for #${created.id}: ${result}`,
    )
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: silent seed failure the user can't self-report.
    logError(
      `[create-investment] seed from preset ${chosenPresetId} failed for #${created.id} (non-fatal):`,
      err,
    )
  }
  return { id: Number(created.id), warning: SEED_PRESET_WARNING }
}
