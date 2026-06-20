import { cn } from '@/lib/cn'

// VERCEL_ENV is 'production' | 'preview' | 'development' on Vercel; undefined locally,
// where NODE_ENV ('development') is the right signal. NODE_ENV alone can't tell a
// Preview deploy from prod (both are 'production'), so prefer VERCEL_ENV when present.
const ENV = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) as EnvT

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

// Pull ONLY the database name out of the connection string — never the user, password,
// host, or port. `URL.pathname` is `/<dbname>`; query params (e.g. `?sslmode`) are dropped.
function dbNameFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).pathname.replace(/^\//, '') || undefined
  } catch {
    return undefined
  }
}

const DB_NAME = dbNameFromUrl(process.env.DB_POSTGRES_URL)

export function EnvBadge() {
  // Never show in production — the badge exists only to flag non-prod environments.
  if (ENV === 'production') return null

  const label = DB_NAME ? `${ENV_LABELS[ENV] ?? ENV} · ${DB_NAME}` : (ENV_LABELS[ENV] ?? ENV)

  return (
    <div
      className={cn(
        'fixed top-1/2 right-0 z-[10000] -translate-y-1/2 rounded-l-lg px-3 py-6',
        'font-mono text-lg font-bold tracking-widest uppercase shadow-xl select-none',
        '[writing-mode:vertical-rl]',
        ENV_STYLES[ENV] ?? ENV_STYLES.production,
      )}
      title={`Środowisko: ${ENV}${DB_NAME ? ` · baza: ${DB_NAME}` : ''}`}
    >
      {label}
    </div>
  )
}
