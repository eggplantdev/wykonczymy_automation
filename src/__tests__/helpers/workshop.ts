import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import {
  getWorkshop,
  resolveWorkshopInvestment,
  setWorkshopPreset,
} from '@/lib/db/workshop-investment'
import { deleteTestInvestment } from '@/__tests__/helpers/investment'

// A spec cannot create its own warsztat: `investments_single_szablon_idx` allows exactly one in the
// database, and `db:import:test` restores production's the moment production has one. So it borrows
// whichever warsztat is there — provisioning one only when the database has none — and `release`
// puts the pointer back where it found it rather than leaving a real row aimed at a test fixture.
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
