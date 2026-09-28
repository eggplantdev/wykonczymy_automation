'use server'

import { ownerOnlyAction } from '@/lib/actions/owner-only-action'
import { protectedAction } from '@/lib/actions/run-action'
import { OWNER_ONLY_CLIENT_VIEW_DEFAULTS_MESSAGE } from '@/lib/kosztorys/owner-only-messages'
import {
  sanitizeClientViewConfig,
  sanitizeClientViewVariant,
  type ClientViewConfigT,
  type ClientViewModeT,
} from '@/lib/kosztorys/client-view-settings'
import { findClientViewRow } from '@/lib/queries/kosztorys-client-view'
import type { ActionResultT } from '@/types/action'

export async function saveClientViewSettingsAction(
  investmentId: number,
  config: ClientViewConfigT,
): Promise<ActionResultT> {
  return protectedAction('saveClientViewSettingsAction', async ({ payload }) => {
    const data = sanitizeClientViewConfig(config)
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

// Read-modify-write, one variant at a time: „Zapisz jako domyślne" on the offer must not wipe the
// firm-wide settlement default, which the owner is not even looking at when they press it. The other
// variant is carried over RAW rather than through `sanitizeClientViewConfig` — sanitizing would
// materialise today's code default into the row, freezing a variant nobody has ever chosen.
//
// `mode` scopes WHICH variant is written and is deliberately never stored here. The firm-wide mode
// decides what every investment without a row of its own serves, so writing it would flip live
// client links across the whole firm from a button whose confirm speaks about one investment.
export async function saveClientViewDefaultsAction(
  config: ClientViewConfigT,
  mode: ClientViewModeT,
): Promise<ActionResultT> {
  return ownerOnlyAction(
    'saveClientViewDefaultsAction',
    OWNER_ONLY_CLIENT_VIEW_DEFAULTS_MESSAGE,
    async ({ payload }) => {
      const current = await payload.findGlobal({
        slug: 'kosztorys-client-view-defaults',
        depth: 0,
      })
      const storedVariants =
        typeof current?.variants === 'object' && current.variants !== null ? current.variants : {}

      await payload.updateGlobal({
        slug: 'kosztorys-client-view-defaults',
        data: {
          variants: {
            ...storedVariants,
            [mode]: sanitizeClientViewVariant(config.variants[mode], mode),
          },
        },
      })
      return { success: true }
    },
  )
}
