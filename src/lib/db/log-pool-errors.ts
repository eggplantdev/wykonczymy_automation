import type { Payload } from 'payload'
import { logError } from '@/lib/utils/log-error'

// pg-pool re-emits an idle client's dead socket (Neon dropping a frozen instance's connections) on
// the pool, and an `error` event nobody listens to is an uncaught exception that kills the instance
// with every request it is serving.
export function logIdlePoolErrors(payload: Payload) {
  payload.db.pool?.on('error', (err) => {
    // TODO(EX-958) SENTRY-REQUIRED: a dropped idle connection is recovered by the pool, but how often it happens is only visible here.
    logError('[db] Idle pool client failed:', err)
  })
}
