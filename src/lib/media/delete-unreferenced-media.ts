import { after } from 'next/server'
import type { Payload } from 'payload'
import { MEDIA_RELATIONS, mediaReferenceWhere } from '@/lib/media/relating-collections'
import { uploadFieldIds, type UploadFieldT } from '@/lib/media/upload-field'
import { logError } from '@/lib/utils/log-error'

/**
 * Delete only the media rows nothing points at any more. Call it AFTER the write that dropped the
 * reference, so the scan reflects the new state.
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
 * a local single-connection Postgres never showed it. The scan is serialized for the same reason: a
 * reference read that comes back wrong is a page leaked, not a page deleted twice.
 *
 * Best-effort per id: this always runs after the write it cleans up for, so a failed delete must
 * leak a file rather than fail the mutation the user actually asked for.
 */
export async function deleteUnreferencedMedia(payload: Payload, mediaIds: number[]): Promise<void> {
  if (mediaIds.length === 0) return

  let referenced: Set<number>
  try {
    referenced = await findReferencedMedia(payload, mediaIds)
  } catch (err) {
    // The batch scan answers for every id at once, so losing it means knowing nothing about any of
    // them — and an unanswered reference question must leak rather than cascade a live row away.
    logError('[media] reference scan failed, deleting nothing', err)
    return
  }

  for (const id of mediaIds) {
    if (referenced.has(id)) continue
    try {
      await payload.delete({ collection: 'media', id })
    } catch (err) {
      logError('[media] delete unreferenced media failed', err)
    }
  }
}

/**
 * The same reclaim, moved off the response's critical path.
 *
 * Nothing the caller returns depends on it: the reference that made the file reachable is already
 * gone, and the worst outcome of a reclaim that never runs is a file left in Blob — the same
 * best-effort outcome a failed delete already has. Awaiting it instead charged the user for one
 * round-trip per relation plus one per file, on an action whose answer was ready before any of them.
 *
 * Outside a request scope — a script, a node spec — `after` throws, and there is no later for the
 * work to happen in, so that case runs it inline.
 */
export async function reclaimUnreferencedMedia(
  payload: Payload,
  mediaIds: number[],
): Promise<void> {
  const reclaim = () => deleteUnreferencedMedia(payload, mediaIds)
  try {
    after(reclaim)
  } catch {
    await reclaim()
  }
}

/**
 * Which of `mediaIds` anything still points at — one query per relation rather than one per
 * relation per id, which is what made removing a whole investment gallery cost `6N` round-trips.
 */
async function findReferencedMedia(payload: Payload, mediaIds: number[]): Promise<Set<number>> {
  const candidates = new Set(mediaIds)
  const referenced = new Set<number>()

  for (const { collection, field } of MEDIA_RELATIONS) {
    const { docs } = await payload.find({
      collection,
      where: mediaReferenceWhere(field, mediaIds),
      depth: 0,
      pagination: false,
    })
    for (const doc of docs) {
      // A matched doc carries its OTHER attachments too, so the ids are filtered back down to the
      // batch — otherwise an unrelated page of the same invoice would enter the set and spare a
      // file the caller did ask to reclaim.
      for (const id of uploadFieldIds((doc as unknown as Record<string, UploadFieldT>)[field])) {
        if (candidates.has(id)) referenced.add(id)
      }
    }
  }

  return referenced
}
