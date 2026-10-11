import { getPayload } from 'payload'
import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { getDb } from '@/lib/db/get-db'
import { translate } from '@/lib/i18n/translations'
import { isPushConfigured, sendPushToUser } from '@/lib/push/send-push'

/** The private key lives only on production, so this is the one way to check delivery end to end there. */
export async function GET() {
  const user = await getCurrentUserJwt()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await getDb(await getPayload({ config }))
  const sent = await sendPushToUser(db, user.id, (locale) => ({
    title: translate(locale, 'workerPage', 'testPushTitle'),
    body: translate(locale, 'workerPage', 'testPushBody'),
    url: '/',
    tag: 'test',
  }))
  return NextResponse.json({ sent, configured: isPushConfigured() })
}
