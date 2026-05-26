import { google } from 'googleapis'

/**
 * Single source for the service-account credential parse + JWT construction.
 * Different scopes get different tokens, so each client (sheets, drive) calls
 * this with its own scope list — there is no shared JWT instance.
 */
export function createServiceAccountJWT(scopes: string[]) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set')
  const creds = JSON.parse(raw) as { client_email: string; private_key: string }
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes,
  })
}
