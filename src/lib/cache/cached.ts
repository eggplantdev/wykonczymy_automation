import { unstable_cache } from 'next/cache'
import { serverEnv } from '@/lib/env/server'

// The Data Cache outlives a deploy, so without this an entry built by the previous build's code
// reaches the new build's reader — and a payload missing a field the reader now dereferences
// crashes the page or renders NaN. A tag cannot help: it marks an entry stale but still serves it
// once. Next keys on `cb.toString()`, which misses every mapper the callback calls, so the shape is
// pinned by the deploy instead. Locally the process stands in, because `.next/cache` survives a
// dev-server restart — the pid, not a timestamp, so every module instance in one process agrees.
const DEPLOY_ID = serverEnv.VERCEL_DEPLOYMENT_ID ?? `local-${process.pid}`

// Without it, a render that read rows before a write but stored them after the tag expired serves
// those pre-write rows as fresh until the next write. A write landing during the epoch's own save
// still slips through — a window of milliseconds, accepted.
const tagEpoch = (tags: string[]) =>
  unstable_cache(async () => Date.now(), ['epoch', ...[...tags].sort(), DEPLOY_ID], { tags })

export const cached: typeof unstable_cache = (fn, keyParts = [], options) => {
  if (!options?.tags?.length) return unstable_cache(fn, [...keyParts, DEPLOY_ID], options)
  const readEpoch = tagEpoch(options.tags)
  const read = async (...args: Parameters<typeof fn>) => {
    const epoch = String(await readEpoch())
    return unstable_cache(fn, [...keyParts, DEPLOY_ID, epoch], options)(...args)
  }
  return read as typeof fn
}
