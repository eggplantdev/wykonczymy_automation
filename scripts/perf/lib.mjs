// Shared plumbing for the perf kit — how to use it: context/reference/perf-measurement.md
import fs from 'node:fs'

export const BASE = process.env.PERF_BASE ?? 'http://localhost:3100'
export const OUT_DIR = 'dumps/perf'
export const SQL_LOG = `${OUT_DIR}/sql.log`

const EMAILS = {
  OWNER: process.env.STAGING_QA_EMAIL,
  MANAGER: process.env.STAGING_QA_MANAGER_EMAIL,
  EMPLOYEE: process.env.STAGING_QA_WORKER_EMAIL,
}

export function credentials(role) {
  const email = EMAILS[role]
  if (!email || !process.env.STAGING_QA_PASSWORD)
    throw new Error(`STAGING_QA_* for ${role} missing — run with node --env-file=.env`)
  return { email, password: process.env.STAGING_QA_PASSWORD }
}

export async function login(role) {
  const res = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials(role)),
  })
  if (!res.ok)
    throw new Error(`login ${role}: ${res.status} — does the account exist? pnpm qa:staging-user`)
  const { user } = await res.json()
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return { cookie, userId: user.id }
}

export function headersFor(cookie, mode) {
  const headers = { cookie }
  if (mode !== 'html') headers.rsc = '1'
  if (mode === 'prefetch') headers['next-router-prefetch'] = '1'
  return headers
}

export const readSqlLines = () =>
  fs.existsSync(SQL_LOG)
    ? fs
        .readFileSync(SQL_LOG, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : []

export const kb = (bytes) => Math.round(bytes / 1024)
