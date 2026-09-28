import { isConcurrentWrite } from '@/lib/db/with-payload-transaction'

// Says only what the pg code actually proves: nothing was written, and retrying is safe. It
// deliberately does NOT name a concurrent writer — `40001` proves one, `23505` does not, since that
// is equally what a wipe that half-succeeded leaves behind (restore-kosztorys.ts). Naming one would
// report our own bug to the owner as somebody else's edit. Postgres's own text is no better a substitute: an English dump of
// the failed statement and its fifty bind params, which `protectedAction` would put straight into
// the toast. The cause is recoverable from the `console.error` below, which carries the code and the
// constraint name.
const REPLACE_FAILED =
  'Nie udało się zapisać kosztorysu — nic nie zostało zapisane. Spróbuj ponownie.'

// A conflict means this attempt read a tree that is no longer current, so retrying is not hopeful
// repetition — the next attempt opens a fresh snapshot and sees the writer that beat it. Bounded
// because a genuinely hot kosztorys must eventually tell the owner rather than spin: two retries
// cover the realistic pile-up (a second tab, a double-click) and anything past that is worth
// surfacing.
const MAX_ATTEMPTS = 3

// For a `repeatable read` transaction that re-reads its input on every attempt — retrying anything
// else would just replay a stale decision.
export async function retryOnConcurrentWrite<T>(attempt: () => Promise<T>): Promise<T> {
  for (let n = 1; ; n += 1) {
    try {
      return await attempt()
    } catch (error) {
      if (!isConcurrentWrite(error)) throw error
      if (n >= MAX_ATTEMPTS) {
        // TODO(EX-449) SENTRY-REQUIRED: the pg code and constraint name are the only thing separating
        // a genuine race from a bug that merely looks like one — the toast below can't carry them.
        console.error('[replace-tree] concurrent write, attempts exhausted', error)
        throw new Error(REPLACE_FAILED)
      }
    }
  }
}
