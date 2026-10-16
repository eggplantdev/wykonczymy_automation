import { google } from 'googleapis'
import { serverEnv } from '@/lib/env/server'

export type ServiceAccountCredentialsT = { client_email: string; private_key: string }

// The Editor credential is absent everywhere but Vercel Production BY DESIGN — that absence is the gate, not a misconfiguration.
const EDITOR_ACCOUNT_EMAIL = 'kosztorys-sheets@wykonczymy-kosztorys-bk.iam.gserviceaccount.com'

export function parseServiceAccountCredentials(): ServiceAccountCredentialsT {
  return JSON.parse(serverEnv.GOOGLE_SERVICE_ACCOUNT_JSON) as ServiceAccountCredentialsT
}

// Module-private on purpose: the only route to the Editor key is minting a token from it.
function parseWriteServiceAccountCredentials(): ServiceAccountCredentialsT {
  const raw = serverEnv.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
  if (!raw) {
    throw new Error(
      'Refusing to write to Google Sheets: GOOGLE_SERVICE_ACCOUNT_WRITE_JSON is not set. ' +
        'The Editor credential lives only in Vercel Production — every other environment reads ' +
        'sheets with a Viewer account on purpose. Repairing a sheet happens from production.',
    )
  }
  return JSON.parse(raw) as ServiceAccountCredentialsT
}

export function hasWriteServiceAccountCredentials(): boolean {
  return Boolean(serverEnv.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON)
}

export function writeServiceAccountEmail(): string {
  if (!hasWriteServiceAccountCredentials()) return EDITOR_ACCOUNT_EMAIL
  return parseWriteServiceAccountCredentials().client_email || EDITOR_ACCOUNT_EMAIL
}

function createJWT(creds: ServiceAccountCredentialsT, scopes: string[]) {
  return new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes })
}

export function createServiceAccountJWT(scopes: string[]) {
  return createJWT(parseServiceAccountCredentials(), scopes)
}

export function createWriteServiceAccountJWT(scopes: string[]) {
  return createJWT(parseWriteServiceAccountCredentials(), scopes)
}
