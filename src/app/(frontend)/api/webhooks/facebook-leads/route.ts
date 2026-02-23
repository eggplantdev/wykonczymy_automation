import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/webhooks/facebook-leads
 * Meta webhook verification challenge (one-time handshake).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[facebook-leads] Webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  console.log('[facebook-leads] Webhook verification failed', { mode, token })
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST /api/webhooks/facebook-leads
 * Receives lead notifications from Meta. Currently just logs the payload.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  console.log('[facebook-leads] Webhook received:', JSON.stringify(body, null, 2))

  // Always return 200 to Meta (otherwise it retries)
  return NextResponse.json({ received: true }, { status: 200 })
}
