import 'server-only'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { getPreset } from '@/lib/db/presets'
import { applyPreset } from './apply-preset'

export type SeedResultT = 'ok' | 'not-found' | 'not-empty'

// Shared seed orchestration behind both the empty-editor seed action and the investment-create flow.
// Resolves the preset payload from its row (never a client value), then in ONE transaction re-checks
// the target tree is empty and applies it — a throw rolls back and the tree is untouched. The
// empty-guard's real job is to reject seeding an ALREADY-populated tree (the editor CTA on a
// non-empty investment). It does NOT serialize two simultaneous seeds on one empty investment: under
// READ COMMITTED a zero-row SELECT takes no lock and there's no UNIQUE(investment_id), so both could
// pass. Accepted for v1 (the plan's call) — the only live windows are a double-submit (blocked by the
// CTA's disabled-while-seeding state) and two concurrent tabs. Returns a discriminant; the CALLING
// ACTION owns auth + revalidation.
export async function seedInvestmentFromPreset(
  payload: Payload,
  investmentId: number,
  presetId: number,
): Promise<SeedResultT> {
  const preset = await getPreset(await getDb(payload), presetId)
  if (!preset) return 'not-found'

  return withPayloadTransaction(payload, async (req): Promise<SeedResultT> => {
    const txDb = await getDb(payload, req)
    const existing = await txDb.execute(
      sql`SELECT 1 FROM kosztorys_sections WHERE investment_id = ${investmentId} LIMIT 1`,
    )
    // Read-only bail: no writes happened, so committing this empty tree-check is equivalent to a rollback.
    if (existing.rows.length > 0) return 'not-empty'
    await applyPreset(payload, req, investmentId, preset.payload)
    // A preset carries no etapy; a kosztorys must always have at least one. Install the single blank
    // starting etap so a preset-seeded tree opens identically to a hand-started one.
    await txDb.execute(
      sql`INSERT INTO kosztorys_stages (investment_id, ordinal, label) VALUES (${investmentId}, 1, NULL)`,
    )
    return 'ok'
  })
}
