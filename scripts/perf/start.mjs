// a leftover .env.local would keep pointing every later `pnpm dev` at preview.
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { OUT_DIR, SQL_LOG } from './lib.mjs'

if (!fs.existsSync('src/instrumentation.ts'))
  throw new Error('copy scripts/perf/instrumentation.ts to src/ and rebuild first — no SQL log without it')
if (!process.env.DB_POSTGRES_URL_PREVIEW) throw new Error('DB_POSTGRES_URL_PREVIEW missing')

const port = process.argv[2] ?? '3100'
fs.mkdirSync(OUT_DIR, { recursive: true })
fs.rmSync(SQL_LOG, { force: true })

spawn('pnpm', ['exec', 'next', 'start', '-p', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DB_POSTGRES_URL: process.env.DB_POSTGRES_URL_PREVIEW,
    PERF_SQL_LOG: `${process.cwd()}/${SQL_LOG}`,
  },
})
