'use server'

import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { protectedAction } from '@/lib/actions/run-action'
import { OWNER_ONLY_CLIENT_VIEW_DEFAULTS_MESSAGE } from '@/lib/kosztorys/owner-only-messages'
import {
  sanitizeClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view/settings'
import { findClientViewRow } from '@/lib/queries/kosztorys-client-view'
import type { ActionResultT } from '@/types/action'

export async function saveClientViewSettingsAction(
  investmentId: number,
  settings: ClientViewSettingsT,
): Promise<ActionResultT> {
  return protectedAction('saveClientViewSettingsAction', async ({ payload }) => {
    const data = sanitizeClientViewSettings(settings)
    const row = await findClientViewRow(payload, investmentId)

    if (row) {
      await payload.update({ collection: 'kosztorys-client-view', id: row.id, data })
      return { success: true }
    }

    try {
      await payload.create({
        collection: 'kosztorys-client-view',
        data: { ...data, investment: investmentId },
      })
    } catch (error) {
      // find-then-create is not atomic and `investment` is unique — two saves at once race here.
      // The loser re-reads and updates rather than surfacing a raw constraint error. Logged because
      // a validation or FK failure lands here too and is indistinguishable from the race otherwise.
      // TODO(EX-449) SENTRY-REQUIRED:
      console.error('saveClientViewSettingsAction: create failed, retrying as update', error)
      const rowAfterRace = await findClientViewRow(payload, investmentId)
      if (!rowAfterRace) return { success: false, error: 'Nie udało się zapisać ustawień' }
      await payload.update({ collection: 'kosztorys-client-view', id: rowAfterRace.id, data })
    }
    // No revalidation: the settings are read outside the preview's cached payload, so the next
    // request already sees them.
    return { success: true }
  })
}

export async function saveClientViewDefaultsAction(
  settings: ClientViewSettingsT,
): Promise<ActionResultT> {
  return ownerOnlyAction(
    'saveClientViewDefaultsAction',
    OWNER_ONLY_CLIENT_VIEW_DEFAULTS_MESSAGE,
    async ({ payload }) => {
      await payload.updateGlobal({
        slug: 'kosztorys-client-view-defaults',
        data: sanitizeClientViewSettings(settings),
      })
      return { success: true }
    },
  )
}
