import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { getPreset } from '@/lib/db/presets'
import { applyPreset } from './apply-preset'

export type SeedResultT = 'ok' | 'not-found' | 'not-empty'

// Shared seed orchestration behind both the empty-editor seed action and the investment-create flow.
// Resolves the preset payload from its row (never a client value), then in ONE transaction re-checks
// the target tree is empty and applies it — a throw rolls back and the tree is untouched. The
// empty-guard is inside the tx so a concurrent seed can't slip a tree in between check and apply
// (for a freshly-created investment it's a formality; for the editor CTA it's the real guard).
// Returns a discriminant; the CALLING ACTION owns auth + revalidation.
export async function seedInvestmentFromPreset(
  payload: Payload,
  investmentId: number,
  presetId: number,
): Promise<SeedResultT> {
  const preset = await getPreset(await getDb(payload), presetId)
  if (!preset) return 'not-found'

  const transactionId = await payload.db.beginTransaction()
  if (!transactionId) throw new Error('Failed to start transaction')
  const req = {
    transactionID: transactionId,
    context: { skipRevalidation: true },
  } as unknown as PayloadRequest
  try {
    const txDb = await getDb(payload, req)
    const existing = await txDb.execute(
      sql`SELECT 1 FROM kosztorys_sections WHERE investment_id = ${investmentId} LIMIT 1`,
    )
    if (existing.rows.length > 0) {
      await payload.db.rollbackTransaction(transactionId)
      return 'not-empty'
    }
    await applyPreset(payload, req, investmentId, preset.payload)
    await payload.db.commitTransaction(transactionId)
  } catch (err) {
    await payload.db.rollbackTransaction(transactionId)
    throw err
  }
  return 'ok'
}
