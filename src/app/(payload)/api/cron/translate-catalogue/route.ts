import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { fillCatalogueTranslations } from '@/lib/ai/fill-catalogue-translations'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { isAuthorizedCronRequest } from '@/lib/cron/verify-cron-request'
import { getDb } from '@/lib/db/get-db'

// Scheduled from vercel.json.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config })
    const { items, failed } = await fillCatalogueTranslations(await getDb(payload))

    if (items > 0) revalidateTag(CACHE_TAGS.workCatalogue, EXPIRE_NOW)

    return NextResponse.json({ ok: true, items, failed }, { status: 200 })
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: the katalog stays untranslated until the next run or the button.
    console.error('[cron/translate-catalogue] Fill failed', err)

    return NextResponse.json({ error: 'Catalogue translation fill failed' }, { status: 500 })
  }
}
