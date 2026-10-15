// Template — copy to src/instrumentation.ts in a measuring worktree, never commit it there: it patches
// the pg client app-wide and reads raw process.env. Usage: context/reference/perf-measurement.md
// With PERF_SQL_LOG=<file>, appends one JSON line per SQL statement: start, duration, in-flight count.
// PERF_SQL_STACK=<sql fragment> also records the caller stack of statements containing it.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const logFile = process.env.PERF_SQL_LOG
  if (!logFile) return

  const { createRequire } = await import('node:module')
  const fs = await import('node:fs')
  const rootRequire = createRequire(`${process.cwd()}/package.json`)
  // pg is a dependency of the Payload adapter, not of the app — resolve it from there.
  const pg = createRequire(rootRequire.resolve('@payloadcms/db-postgres'))('pg')

  let inFlight = 0
  const original = pg.Client.prototype.query

  pg.Client.prototype.query = function patchedQuery(this: unknown, ...args: unknown[]) {
    const first = args[0] as string | { text?: string } | undefined
    const text = typeof first === 'string' ? first : (first?.text ?? '?')
    const start = Date.now()
    const t0 = performance.now()
    const inFlightAtStart = ++inFlight
    const callerStack = process.env.PERF_SQL_STACK
      ? (new Error().stack ?? '').split('\n').slice(2, 30).join('\n')
      : undefined
    const done = (ok: boolean) => {
      inFlight--
      const sql = text.replace(/\s+/g, ' ').trim()
      fs.appendFileSync(
        logFile,
        JSON.stringify({
          start,
          ms: Math.round((performance.now() - t0) * 10) / 10,
          inFlight: inFlightAtStart,
          ok,
          sql: sql.slice(0, 220),
          ...(process.env.PERF_SQL_STACK && sql.includes(process.env.PERF_SQL_STACK)
            ? { stack: callerStack }
            : {}),
        }) + '\n',
      )
    }

    const last = args[args.length - 1]
    if (typeof last === 'function') {
      args[args.length - 1] = (err: unknown, res: unknown) => {
        done(!err)
        ;(last as (e: unknown, r: unknown) => void)(err, res)
      }
      return original.apply(this, args)
    }

    const result = original.apply(this, args)
    if (result && typeof result.then === 'function') {
      return result.then(
        (res: unknown) => {
          done(true)
          return res
        },
        (err: unknown) => {
          done(false)
          throw err
        },
      )
    }
    done(true)
    return result
  }
}
