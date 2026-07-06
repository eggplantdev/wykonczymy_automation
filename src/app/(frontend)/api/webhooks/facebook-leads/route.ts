import { NextRequest, NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env.server'

/**
 * GET /api/webhooks/facebook-leads
 * Meta webhook verification challenge (one-time handshake).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === serverEnv.META_VERIFY_TOKEN) {
    console.log('[facebook-leads] Webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  console.log('[facebook-leads] Webhook verification failed', { mode, token })
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST /api/webhooks/facebook-leads
 * Meta delivers only a leadgen_id per lead; the actual field data (name, email,
 * phone) must be fetched with a Page token in a second authenticated call.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  console.log('[facebook-leads] Webhook received:', JSON.stringify(body, null, 2))

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const leadgenId = change.value?.leadgen_id
      if (!leadgenId) continue

      const url = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${serverEnv.META_PAGE_ACCESS_TOKEN}`
      const res = await fetch(url)
      const lead = await res.json()

      console.log('[facebook-leads] Lead data:', JSON.stringify(lead, null, 2))
    }
  }

  // Always return 200 to Meta (otherwise it retries)
  return NextResponse.json({ received: true }, { status: 200 })
}
