import { cn } from '@/lib/utils/cn'
import { serverEnv } from '@/lib/env/server'

// VERCEL_ENV is 'production' | 'preview' | 'development' on Vercel; undefined locally,
// where NODE_ENV ('development') is the right signal. NODE_ENV alone can't tell a
// Preview deploy from prod (both are 'production'), so prefer VERCEL_ENV when present.
const ENV = (serverEnv.VERCEL_ENV ?? process.env.NODE_ENV) as EnvT

type EnvT = 'production' | 'preview' | 'development'

// Literal classes per env — Tailwind can't scan a template string, so no `bg-${...}`.
const ENV_STYLES: Record<EnvT, string> = {
  production: 'bg-green-600 text-white',
  preview: 'bg-amber-500 text-black',
  development: 'bg-blue-600 text-white',
}

const ENV_LABELS: Record<EnvT, string> = {
  production: 'PROD',
  preview: 'PREVIEW',
  development: 'LOCAL',
}

// Which DB the app is actually wired to, from the live connection string — proves at a
// glance that a preview isn't pointed at prod (and that the app never sees the test DB).
// `dbname:port` locally; port-less Neon URLs fall back to `dbname@<host-first-label>`.
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
  // Never show in production — the badge exists only to flag non-prod environments.
  if (ENV === 'production') return null

  return (
    <div
      className={cn(
        'fixed top-1/2 right-0 z-10000 flex -translate-y-1/2 items-center gap-2 rounded-l-lg px-3 py-2',
        'font-mono font-bold tracking-widest uppercase shadow-xl select-none',
        '[writing-mode:vertical-rl]',
        ENV_STYLES[ENV] ?? ENV_STYLES.production,
      )}
      title={DB ? `Środowisko: ${ENV} · DB: ${DB}` : `Środowisko: ${ENV}`}
    >
      <span className="text-lg">{ENV_LABELS[ENV] ?? ENV}</span>
      {DB && (
        <span className="text-xs font-normal tracking-normal normal-case opacity-80">{DB}</span>
      )}
    </div>
  )
}
