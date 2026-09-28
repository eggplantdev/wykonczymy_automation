import 'server-only'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { lockInvestmentForReplace } from '@/lib/db/lock-investment-for-replace'
import { getPreset } from '@/lib/db/presets'
import { getWorkshop, setWorkshopPreset } from '@/lib/db/workshop-investment'
import { retryOnConcurrentWrite, withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import { mirrorWorkshopPresetInTransaction } from './mirror-workshop-preset'
import { resolveWorkshopInvestment } from './provision-workshop'
import { restoreKosztorys } from './restore-kosztorys'
import type { KosztorysTreeT } from './types'

export type WorkshopTreeT = { investmentId: number; tree: KosztorysTreeT }

export type OpenedWorkshopT = WorkshopTreeT & { libraryChanged: boolean }

/**
 * „Otwórz szablon" as one transaction: eviction mirror, tree swap, pointer and the tree read all
 * commit together or not at all. Split across commits, two concurrent opens could interleave as
 * A-replace, B-replace, B-set, A-set and leave B's tree under pointer A — and the next mirror would
 * then write B's content into szablon A.
 *
 * `null` = no such szablon; nothing was written.
 *
 * No snapshot: the outgoing szablon's library copy, mirrored inside this same transaction, is its
 * restore point.
 */
export async function openPresetInWorkshop(
  payload: Payload,
  { presetId }: { presetId: number },
): Promise<OpenedWorkshopT | null> {
  const investmentId = await resolveWorkshopInvestment(payload)

  return retryOnConcurrentWrite(
    () =>
      withPayloadTransaction(
        payload,
        async (req) => {
          const db = await getDb(payload, req)
          // First, so the pointer read below cannot go stale before the swap: the throttled mirror and
          // the tree replace take the same row first, and either run wholly before this or wholly after.
          await lockInvestmentForReplace(db, investmentId)

          const held = await getWorkshop(db)
          if (held?.presetId === presetId) {
            return {
              investmentId,
              tree: await buildKosztorysTree(investmentId, req),
              libraryChanged: false,
            }
          }

          const preset = await getPreset(db, presetId)
          if (!preset) return null

          // Eviction: this is the last moment the outgoing szablon can still receive its edits, and the
          // throttle may have just refused the last of them. On this transaction, so a failure rolls
          // the whole switch back rather than wiping edits that never reached the library.
          const libraryChanged =
            held?.presetId != null
              ? await mirrorWorkshopPresetInTransaction(payload, req, {
                  investmentId,
                  templatePresetId: held.presetId,
                })
              : false

          // A szablon's `settings` are inert: VAT and coefficients belong to the warsztat, and without
          // the key `restoreKosztorys` leaves them as they are.
          await restoreKosztorys(
            payload,
            req,
            investmentId,
            { ...preset.payload, settings: undefined },
            { clearGlobalDiscount: true },
          )
          await setWorkshopPreset(db, investmentId, presetId)

          return { investmentId, tree: await buildKosztorysTree(investmentId, req), libraryChanged }
        },
        { skipRevalidation: true },
        // The pointer is read once and acted on, so the whole swap has to see one snapshot.
        { isolationLevel: 'repeatable read' },
      ),
    {
      logLabel: 'open-preset',
      failedMessage:
        'Nie udało się otworzyć szablonu — nic nie zostało zmienione. Spróbuj ponownie.',
    },
  )
}
