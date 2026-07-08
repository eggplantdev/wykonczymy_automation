import { cn } from '@/lib/cn'
import { serverEnv } from '@/lib/env.server'

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

export function EnvBadge() {
  // Never show in production — the badge exists only to flag non-prod environments.
  if (ENV === 'production') return null

  return (
    <div
      className={cn(
        'fixed top-1/2 right-0 z-10000 -translate-y-1/2 rounded-l-lg px-3 py-6',
        'font-mono text-lg font-bold tracking-widest uppercase shadow-xl select-none',
        '[writing-mode:vertical-rl]',
        ENV_STYLES[ENV] ?? ENV_STYLES.production,
      )}
      title={`Środowisko: ${ENV}`}
    >
      {ENV_LABELS[ENV] ?? ENV}
    </div>
  )
}
