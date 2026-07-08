import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env/server'

/**
 * GET /api/test-email?to=you@example.com
 * Verifies SMTP connection, then sends a test email.
 * ADMIN only.
 */
export async function GET(request: Request) {
  const user = await getCurrentUserJwt()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const to = searchParams.get('to')

  if (!to) {
    return NextResponse.json({ error: 'Missing ?to= query param' }, { status: 400 })
  }

  // Verify SMTP connection independently first
  const transport = nodemailer.createTransport({
    host: serverEnv.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: serverEnv.EMAIL_USER,
      pass: serverEnv.EMAIL_PASS,
    },
  })

  try {
    await transport.verify()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'SMTP connection failed',
        detail: message,
        config: {
          host: serverEnv.EMAIL_HOST,
          user: serverEnv.EMAIL_USER,
          passSet: !!serverEnv.EMAIL_PASS,
        },
      },
      { status: 500 },
    )
  }

  // Connection verified — now send via Payload
  try {
    const payload = await getPayload({ config })

    const info = await payload.sendEmail({
      to,
      subject: 'Wykonczymy — test email',
      text: 'If you see this, the email adapter works.',
    })

    return NextResponse.json({ success: true, to, info })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Send failed', detail: message }, { status: 500 })
  }
}
