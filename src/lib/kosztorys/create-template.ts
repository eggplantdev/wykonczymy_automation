import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { getDb } from '@/lib/db/get-db'
import { markPresetEdited, presetNameHolder } from '@/lib/db/presets'
import { applyPreset } from './apply-preset'
import { SETTLEMENT_MODE_DEFAULT } from './settlement-mode'
import type { StoredSnapshotPayloadT } from './snapshot-format'

// Both ways a szablon is born — empty, or „Zapisz jako nowy szablon" from a kosztorys — go through
// here. THE CALLER OWNS THE TRANSACTION (`req`), so a failed tree insert takes the new investment
// with it. The name check words the refusal in Polish; `investments_szablon_name_idx` stays the real
// guard against a concurrent create with the same name.
export async function createTemplate(
  payload: Payload,
  req: PayloadRequest,
  { name, tree }: { name: string; tree?: StoredSnapshotPayloadT },
): Promise<{ id: number } | 'name-taken' | 'name-in-trash'> {
  const db = await getDb(payload, req)
  const holder = await presetNameHolder(db, name)
  if (holder === 'live') return 'name-taken'
  if (holder === 'trashed') return 'name-in-trash'

  const created = await payload.create({
    collection: 'investments',
    data: { name, status: TEMPLATE_INVESTMENT_STATUS, settlementMode: SETTLEMENT_MODE_DEFAULT },
    req,
  })
  if (tree) await applyPreset(payload, req, created.id, tree)
  await markPresetEdited(db, created.id)
  return { id: created.id }
}
