import type { Payload } from 'payload'
import { MEDIA_RELATIONS, mediaReferenceWhere } from '@/lib/media/relating-collections'
import { logError } from '@/lib/utils/log-error'

/**
 * Delete only the media rows nothing points at any more. Call it AFTER the write that dropped the
 * reference, so the count reflects the new state.
 *
 * The reference check is the whole point: the `_rels` FKs are ON DELETE cascade, so deleting a row
 * still attached elsewhere silently strips that page from whatever else holds it. Nothing enforces
 * "a media row is only ever linked from the upload that created it" — the admin panel's picker can
 * attach one file twice, and a client-side cleanup can fire while the write it thought failed
 * actually committed. The collections checked are `MEDIA_RELATIONS` — the same list the delete
 * guard probes, because this used to be a hand-maintained copy and lost `equipment-events` to the
 * drift.
 *
 * **One id at a time, never `Promise.all`.** On the deployed database (Neon through
 * `@payloadcms/db-vercel-postgres`) concurrent Payload writes share a session: every `delete`
 * resolves as if it succeeded, and only one of them is actually committed. Deleting the pages of a
 * multi-page invoice in parallel therefore left every page but one in storage with nothing pointing
 * at it — silently, because none of the calls reported an error. Reproduced against that database;
 * a local single-connection Postgres never showed it. The reads are serialized for the same reason:
 * a count that comes back wrong is a page leaked, not a page deleted twice.
 *
 * Best-effort per id: this always runs after the write it cleans up for, so a failed delete must
 * leak a file rather than fail the mutation the user actually asked for.
 */
export async function deleteUnreferencedMedia(payload: Payload, mediaIds: number[]): Promise<void> {
  for (const id of mediaIds) {
    try {
      let referenced = false
      for (const { collection, field } of MEDIA_RELATIONS) {
        const { totalDocs } = await payload.count({
          collection,
          where: mediaReferenceWhere(field, id),
        })
        if (totalDocs > 0) {
          referenced = true
          break
        }
      }
      if (referenced) continue

      await payload.delete({ collection: 'media', id })
    } catch (err) {
      logError('[invoices] delete unreferenced media failed', err)
    }
  }
}
