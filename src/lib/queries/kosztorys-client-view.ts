import 'server-only'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import {
  sanitizeClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view-settings'
import type { ColumnRanksT } from '@/lib/table/column-order'

export type ClientViewSettingsReadT = {
  settings: ClientViewSettingsT
  // The firm-wide order alone — what „Przywróć domyślną kolejność" restores. Read off the global
  // even when the investment's own row wins, since that row is exactly what a reset departs from.
  defaultColumnRanks: ColumnRanksT
}

/**
 * `investment` is unique, so this is the row-or-nothing lookup every caller wants — the resolver
 * below, and both branches of the save action.
 *
 * `overrideAccess` is NOT the gate here and must stay on: neither caller carries a session on its
 * payload client, so evaluating collection access would answer „no user, no row" and fail the save
 * with a generic Forbidden. The token entrance has nobody to authenticate by design, and the save
 * already ran its role gate before reaching this line.
 */
export async function findClientViewRow(payload: Payload, investmentId: number) {
  const rows = await payload.find({
    collection: 'kosztorys-client-view',
    where: { investment: { equals: investmentId } },
    depth: 0,
    // No COUNT query for a lookup a unique index already caps at one row.
    pagination: false,
    overrideAccess: true,
  })
  return rows.docs[0] ?? null
}

/**
 * The one answer to "how is investment N configured for its client": its own row, else the firm-wide
 * default, else the code default. The settings dialog and the preview entrances read the same
 * answer, so the dialog can never show a starting state the client does not get. The row wins as a
 * whole: a row whose `hiddenColumns` is NULL resolves to the code default, not to the global.
 *
 * Deliberately uncached and outside `cachedPreviewKosztorysEditorData`: two indexed reads mean a
 * save is live on the next request with no cache tag, and changing the firm-wide default does not
 * invalidate every investment's tree payload. `overrideAccess` because the token entrance has no
 * session at all — exactly like the token lookup beside it.
 *
 * Both reads are issued at once. Until an investment saves its own row — the common state — the
 * fallback is the answer, so awaiting the row first would put every such request through two
 * round-trip depths to reach it; the wasted global read when a row does exist is one row of a
 * single-row table.
 */
export async function getClientViewSettings(investmentId: number): Promise<ClientViewSettingsT> {
  return (await getClientViewSettingsRead(investmentId)).settings
}

// The same two reads, with the firm-wide order kept beside the answer for the settings dialog.
export async function getClientViewSettingsRead(
  investmentId: number,
): Promise<ClientViewSettingsReadT> {
  const payload = await getPayload({ config })

  const [row, defaults] = await Promise.all([
    findClientViewRow(payload, investmentId),
    payload.findGlobal({
      slug: 'kosztorys-client-view-defaults',
      depth: 0,
      overrideAccess: true,
    }),
  ])

  return {
    settings: sanitizeClientViewSettings(row ?? defaults ?? {}),
    defaultColumnRanks: sanitizeClientViewSettings(defaults ?? {}).columnRanks,
  }
}
