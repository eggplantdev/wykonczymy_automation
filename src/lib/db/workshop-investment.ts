// No `server-only` (like presets.ts beside it): the module is reachable from the Payload graph.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { getDb, type DbExecutorT } from './get-db'

// The szablon workbench: ONE investment the template editor works over, recognised by its status
// rather than by a hardcoded id — an id would not survive `db:import` restoring another database's
// rows, and would have to be seeded by hand on production.
const WORKSHOP_INVESTMENT_NAME = 'Warsztat szablonów'

/**
 * Id of the workbench investment, creating it on first use. Auto-provisioning is what lets the
 * status stay unpickable in the investment form: there is no hand route to a second workbench.
 */
export async function resolveWorkshopInvestment(payload: Payload): Promise<number> {
  const db = await getDb(payload)
  const res = await db.execute(sql`
    SELECT id FROM investments WHERE status = ${TEMPLATE_INVESTMENT_STATUS} ORDER BY id LIMIT 1
  `)
  const existing = res.rows[0]
  if (existing) return Number(existing.id)

  const created = await payload.create({
    collection: 'investments',
    data: {
      name: WORKSHOP_INVESTMENT_NAME,
      status: TEMPLATE_INVESTMENT_STATUS,
      settlementMode: SETTLEMENT_MODE_DEFAULT,
    },
  })
  return created.id
}

/** Point the workbench at the preset whose content now sits in it. Set by „Otwórz", never by save. */
export async function setWorkshopPreset(
  db: DbExecutorT,
  investmentId: number,
  presetId: number,
): Promise<void> {
  await db.execute(sql`
    UPDATE investments SET template_preset_id = ${presetId} WHERE id = ${investmentId}
  `)
}

/** Which preset the workbench currently holds — null when nothing has been opened into it yet. */
export async function getWorkshopPresetId(
  db: DbExecutorT,
  investmentId: number,
): Promise<number | null> {
  const res = await db.execute(sql`
    SELECT template_preset_id FROM investments WHERE id = ${investmentId}
  `)
  const value = res.rows[0]?.template_preset_id
  return value == null ? null : Number(value)
}
