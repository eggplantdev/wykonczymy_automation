import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { resolveWorkshopInvestment } from '@/lib/actions/provision-workshop'
import { getWorkshop, setWorkshopPreset } from '@/lib/db/workshop-investment'
import { deleteTestInvestment } from '@/__tests__/helpers/investment'

// A spec can't create its own warsztat — `investments_single_szablon_idx` allows exactly one, and
// `db:import:test` restores production's the moment production has one. This borrows whichever
// warsztat exists (provisioning only if none), and `release` puts the pointer back where it found it.
export async function acquireTestWorkshop(
  payload: Payload,
): Promise<{ id: number; release: () => Promise<void> }> {
  const db = await getDb(payload)
  const existing = await getWorkshop(db)
  const id = await resolveWorkshopInvestment(payload)

  return {
    id,
    release: async () => {
      if (!existing) return deleteTestInvestment(payload, id)
      await setWorkshopPreset(db, id, existing.presetId)
    },
  }
}
