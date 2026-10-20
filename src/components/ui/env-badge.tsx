import { EnvBadgeShell, type EnvT } from '@/components/ui/env-badge-shell'
import { serverEnv } from '@/lib/env/server'

// NODE_ENV alone can't tell a Preview deploy from prod (both are 'production'), so prefer VERCEL_ENV when present.
const ENV = (serverEnv.VERCEL_ENV ?? process.env.NODE_ENV) as EnvT

// Password is never in the output — we read only pathname/host/port.
function dbLabel(): string | undefined {
  try {
    const url = new URL(serverEnv.DB_POSTGRES_URL)
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
    if (!database) return undefined
    return url.port ? `${database}:${url.port}` : `${database}@${url.hostname.split('.')[0]}`
  } catch {
    return undefined
  }
}

const DB = dbLabel()

export function EnvBadge() {
  if (ENV === 'production') return null

  return (
    <EnvBadgeShell
      env={ENV}
      db={DB}
      title={DB ? `Środowisko: ${ENV} · DB: ${DB}` : `Środowisko: ${ENV}`}
    />
  )
}
