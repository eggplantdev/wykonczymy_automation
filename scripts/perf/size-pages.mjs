// HTML + RSC bytes per page as OWNER, optionally counting a needle (a field name you suspect rides along).
//   node --env-file=.env scripts/perf/size-pages.mjs [needle] [path ...]
//   --save writes each RSC body to dumps/perf/<path>.rsc for rsc-rows.mjs
import fs from 'node:fs'
import { BASE, OUT_DIR, headersFor, kb, login } from './lib.mjs'

const args = process.argv.slice(2)
const save = args.includes('--save')
const [needle, ...paths] = args.filter((a) => a !== '--save')
const PAGES = paths.length ? paths : ['/', '/kasy', '/pracownicy', '/inwestycje']

const { cookie } = await login('OWNER')
for (const page of PAGES) {
  const row = [page.padEnd(32)]
  for (const mode of ['html', 'rsc']) {
    const body = await (await fetch(`${BASE}${page}`, { headers: headersFor(cookie, mode) })).text()
    const hits = needle ? ` ${needle}×${body.split(needle).length - 1}` : ''
    row.push(`${mode} ${String(kb(body.length)).padStart(5)} KB${hits}`)
    if (save && mode === 'rsc') {
      fs.mkdirSync(OUT_DIR, { recursive: true })
      fs.writeFileSync(`${OUT_DIR}/${page.replace(/\W+/g, '_') || 'root'}.rsc`, body)
    }
  }
  console.log(row.join('  '))
}
