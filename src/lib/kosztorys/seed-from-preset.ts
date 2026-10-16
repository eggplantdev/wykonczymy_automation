import 'server-only'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { isTemplateInvestment } from '@/lib/db/presets'
import { applyPreset } from './apply-preset'
import { serializeKosztorysAsPreset } from './serialize-preset'

export type SeedResultT = 'ok' | 'not-found' | 'not-empty'

// The empty-guard is a cheap invariant, not a lock: it does NOT serialize two simultaneous seeds,
// since under READ COMMITTED a zero-row SELECT takes no lock and there's no UNIQUE(investment_id).
// the CALLING ACTION owns auth + revalidation.
export async function seedInvestmentFromPreset(
  payload: Payload,
  investmentId: number,
  presetId: number,
): Promise<SeedResultT> {
  if (!(await isTemplateInvestment(await getDb(payload), presetId))) return 'not-found'

  return withPayloadTransaction(
    payload,
    async (req): Promise<SeedResultT> => {
      const txDb = await getDb(payload, req)
      const existing = await txDb.execute(
        sql`SELECT 1 FROM kosztorys_sections WHERE investment_id = ${investmentId} LIMIT 1`,
      )
      if (existing.rows.length > 0) return 'not-empty'
      await applyPreset(payload, req, investmentId, await serializeKosztorysAsPreset(presetId, req))
      return 'ok'
    },
    { skipRevalidation: true },
  )
}
