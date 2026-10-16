import type { Payload } from 'payload'
import type { InvestmentFormDataT } from '@/components/forms/investment-form/investment-schema'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import { logError } from '@/lib/utils/log-error'

const SEED_PRESET_WARNING =
  'Inwestycja utworzona, ale nie udało się wypełnić kosztorysu z szablonu. Otwórz edytor i uzupełnij ręcznie.'

export async function createInvestment(
  payload: Payload,
  data: InvestmentFormDataT,
): Promise<{ id: number; warning?: string }> {
  const { presetId, ...investmentData } = data
  const created = await payload.create({
    collection: 'investments',
    data: { ...investmentData, settlementMode: SETTLEMENT_MODE_DEFAULT },
  })

  // the investment is already committed, so a seed failure must never flip the whole action to
  // failure — that would invite a duplicate-creating retry.
  const chosenPresetId = presetId ? Number(presetId) : null
  if (!chosenPresetId) return { id: Number(created.id) }

  try {
    const result = await seedInvestmentFromPreset(payload, Number(created.id), chosenPresetId)
    if (result === 'ok') return { id: Number(created.id) }
    // TODO(EX-958) SENTRY-REQUIRED: silent seed skip the user can't self-report.
    logError(
      `[create-investment] seed from preset ${chosenPresetId} skipped for #${created.id}: ${result}`,
    )
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: silent seed failure the user can't self-report.
    logError(
      `[create-investment] seed from preset ${chosenPresetId} failed for #${created.id} (non-fatal):`,
      err,
    )
  }
  return { id: Number(created.id), warning: SEED_PRESET_WARNING }
}
