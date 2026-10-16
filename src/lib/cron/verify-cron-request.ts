import type { NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env/server'

export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = serverEnv.CRON_SECRET
  if (!secret) return false

  return request.headers.get('authorization') === `Bearer ${secret}`
}
