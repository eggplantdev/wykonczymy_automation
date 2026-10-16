import 'server-only'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import {
  sanitizeClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view/settings'
import type { ColumnRanksT } from '@/lib/table/column-order'

export type ClientViewSettingsReadT = {
  settings: ClientViewSettingsT
  defaultColumnRanks: ColumnRanksT
}

/**
 * `overrideAccess` is NOT the gate here and must stay on: neither caller carries a session on its
 * payload client, so evaluating collection access would answer „no user, no row" and fail the save
 * with a generic Forbidden.
 */
export async function findClientViewRow(payload: Payload, investmentId: number) {
  const rows = await payload.find({
    collection: 'kosztorys-client-view',
    where: { investment: { equals: investmentId } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  return rows.docs[0] ?? null
}

/**
 * Deliberately uncached and outside `cachedPreviewKosztorysEditorData`: two indexed reads mean a
 * save is live on the next request with no cache tag, and changing the firm-wide default does not
 * invalidate every investment's tree payload.
 */
export async function getClientViewSettings(investmentId: number): Promise<ClientViewSettingsT> {
  return (await getClientViewSettingsRead(investmentId)).settings
}

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
