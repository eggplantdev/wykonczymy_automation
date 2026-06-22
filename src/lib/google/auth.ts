import { google } from 'googleapis'
import { serverEnv } from '@/lib/env.server'

/**
 * Single source for the service-account credential parse + JWT construction.
 * Different scopes get different tokens, so each client (sheets, drive) calls
 * this with its own scope list — there is no shared JWT instance.
 */
export function createServiceAccountJWT(scopes: string[]) {
  const creds = JSON.parse(serverEnv.GOOGLE_SERVICE_ACCOUNT_JSON) as {
    client_email: string
    private_key: string
  }
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  })
}
