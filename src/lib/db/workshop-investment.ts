// No `server-only` (like presets.ts beside it): the module is reachable from the Payload graph.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'
import { getDb, type DbExecutorT } from './get-db'

const WORKSHOP_INVESTMENT_NAME = 'Warsztat szablonów'

// `presetId` = which szablon the workbench currently holds (null before anything was opened into it).
export type WorkshopT = { id: number; presetId: number | null }

// Recognised by its status rather than by a hardcoded id — an id would not survive `db:import`
// restoring another database's rows, and would have to be seeded by hand on production.
export async function getWorkshop(db: DbExecutorT): Promise<WorkshopT | null> {
  const res = await db.execute(sql`
    SELECT id, template_preset_id FROM investments
    WHERE status = ${TEMPLATE_INVESTMENT_STATUS}
    ORDER BY id LIMIT 1
  `)
  const row = res.rows[0]
  if (!row) return null
  return {
    id: Number(row.id),
    presetId: row.template_preset_id == null ? null : Number(row.template_preset_id),
  }
}

/**
 * Provisioned on first use, which is what lets the status stay unpickable in the investment form.
 * Creating is a MUTATION, so only an action may call this — a page that finds none redirects.
 */
export async function resolveWorkshopInvestment(payload: Payload): Promise<number> {
  const existing = await getWorkshop(await getDb(payload))
  if (existing) return existing.id

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

/** Set by „Otwórz", never by save. */
export async function setWorkshopPreset(
  db: DbExecutorT,
  investmentId: number,
  presetId: number | null,
): Promise<void> {
  await db.execute(sql`
    UPDATE investments SET template_preset_id = ${presetId} WHERE id = ${investmentId}
  `)
}
