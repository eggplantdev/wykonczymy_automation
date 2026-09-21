import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Lead } from '@/payload-types'
import { serverEnv } from '@/lib/env/server'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { verifySignature } from '@/lib/leads/verify-signature'
import {
  landingSubmissionSchema,
  landingToStoreLeadInput,
  MAX_LANDING_ASSETS,
} from '@/lib/leads/landing'
import { fetchLandingAsset } from '@/lib/leads/fetch-landing-asset'
import { captureLead } from '@/lib/leads/capture-lead'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { uploadFieldIds } from '@/lib/media/upload-field'
import { notifyShapeAlert, notifyAssetFailure } from '@/lib/leads/notify'
import { logError } from '@/lib/utils/log-error'

/**
 * The download loop is serial and each asset gets its own timeout, so the handler's worst case is
 * `MAX_LANDING_ASSETS × FETCH_TIMEOUT_MS` plus the capture. Declared explicitly rather than left to
 * the platform default, which would kill the invocation before any of our own timeouts reported.
 */
export const maxDuration = 300

/**
 * POST /api/webhooks/landing
 *
 * The landing (`landing_26`) POSTs a signed JSON envelope here once its form has validated
 * server-side. Files are NOT in the body: the visitor uploads them straight to the landing's own
 * blob store, and we pull each one back from an allowlisted URL — see `fetchLandingAsset` for why
 * that URL is the dangerous part.
 *
 * Authenticity is an HMAC over the RAW body, the same mechanism as Meta's, since the landing is our
 * own code and can sign properly (unlike the WordPress forwarder's shared header secret).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()

  if (
    !verifySignature(
      raw,
      request.headers.get('x-landing-signature'),
      serverEnv.LANDING_WEBHOOK_SECRET,
    )
  ) {
    console.warn('[landing] Bad or missing x-landing-signature — rejecting')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    logError('[landing] Body was not valid JSON', raw.slice(0, 500))
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  const parsed = landingSubmissionSchema.safeParse(json)
  if (!parsed.success) {
    logError('[landing] Submission failed schema validation', parsed.error.message)
    await notifyShapeAlert(payload, {
      leadgenId: 'landing',
      reason: `Landing submission failed schema validation: ${parsed.error.message}`,
      raw: json,
    }).catch((err) => logError('[landing] Shape alert failed', err))
    return NextResponse.json({ error: 'Bad shape' }, { status: 400 })
  }

  const submission = parsed.data

  // FIRST, and the only step allowed to fail the request: losing the enquiry is the outcome the
  // landing's retry queue exists to prevent. The files come after, because downloading up to
  // MAX_LANDING_ASSETS of them is by far the slowest thing here — behind it, a timeout would write
  // no lead at all, and the retry would find nothing, re-download the set and time out again.
  let lead: Lead
  let created: boolean
  try {
    ;({ lead, created } = await captureLead(payload, landingToStoreLeadInput(submission)))
  } catch (err) {
    logError('[landing] Failed to capture lead', err)
    return NextResponse.json({ error: 'Capture failed' }, { status: 500 })
  }

  // A redelivery that already carries its files must not download a second set. One that carries
  // none is the crash-between-capture-and-attach case, and does get another go.
  const assets = uploadFieldIds(lead.assets).length ? [] : (submission.assets ?? [])

  // Serial, not Promise.all: concurrent Payload writes share a Neon session and silently commit
  // one. Serial also keeps peak memory at one file rather than the whole set.
  const mediaIds: number[] = []
  const failed: { url: string; reason: string }[] = []
  for (const asset of assets.slice(0, MAX_LANDING_ASSETS)) {
    try {
      mediaIds.push(await fetchLandingAsset(payload, asset))
    } catch (err) {
      logError('[landing] Asset could not be stored', err)
      failed.push({ url: asset.url, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  if (mediaIds.length) {
    try {
      await payload.update({
        collection: 'leads',
        id: lead.id,
        data: { assets: mediaIds },
        overrideAccess: true,
      })
    } catch (err) {
      // The rows exist but nothing points at them, and Blob has no undelete — reclaim them rather
      // than bill for files no surface can ever show.
      logError('[landing] Failed to attach assets to the lead', err)
      await deleteUnreferencedMedia(payload, mediaIds)
      failed.push(
        ...mediaIds.map((id) => ({ url: `media:${id}`, reason: 'Nie udało się podpiąć do zgłoszenia' })),
      )
    }
  }

  // Only on a fresh capture: a redelivery would re-alert about files that were already reported.
  if (failed.length && created) {
    await notifyAssetFailure(payload, {
      submissionId: submission.submissionId,
      failed,
      stored: mediaIds.length,
    }).catch((err) => logError('[landing] Asset alert failed', err))
  }

  revalidateTag(CACHE_TAGS.leads, EXPIRE_NOW)
  return NextResponse.json({ received: true }, { status: 200 })
}
