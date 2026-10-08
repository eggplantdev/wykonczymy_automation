// Three-way comparison of one szablon against the katalog prac: szablon before the kierownik's
// edits (BASE), szablon now, katalog now. Writes an HTML report for the owner and plan.json for
// the sync step.
// Usage (repo root): node --import tsx …/sync/diff.ts EXPORT_DIR REPORT.html
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  classify,
  type CatalogueRowT,
  type FieldDiffT,
  type FieldT,
  type FieldValueT,
  type RowT,
  type TemplateRowT,
} from './classify'

const [exportDir, reportPath] = process.argv.slice(2)
if (!exportDir || !reportPath) throw new Error('usage: diff.ts EXPORT_DIR REPORT.html')

const read = <T>(name: string): T => JSON.parse(readFileSync(join(exportDir, name), 'utf8')) as T
const baseTemplate = read<TemplateRowT[]>('base-template.json')
const nowTemplate = read<TemplateRowT[]>('now-template.json')
const report = classify(
  baseTemplate,
  nowTemplate,
  read<CatalogueRowT[]>('base-catalogue.json'),
  read<CatalogueRowT[]>('now-catalogue.json'),
)
const lastEdit = (rows: TemplateRowT[]) =>
  rows
    .map((row) => row.updated_at)
    .sort()
    .at(-1)
    ?.slice(0, 16)
    .replace('T', ' ') ?? '—'

const FIELD_LABELS: Record<FieldT, string> = {
  clientPrice: 'Cena j.m.',
  wTools: 'Stawka z narzędziami (podwykonawca)',
  ownTools: 'Stawka bez narzędzi (pracownik)',
  uk: 'Opis (UK)',
  ru: 'Opis (RU)',
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const money = (value: number) => `${value.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} zł`

const show = (value: FieldValueT | undefined): string => {
  if (value === undefined) return '<span class="muted">—</span>'
  if (typeof value === 'number') return money(value)
  if (typeof value === 'string')
    return value === '' ? '<span class="muted">brak</span>' : escape(value)
  if (value.coeff != null) return `× ${value.coeff.toLocaleString('pl-PL')} ceny`
  if (value.rate != null) return money(value.rate)
  return '<span class="muted">auto</span>'
}

const work = (row: RowT) =>
  `<div class="work">${escape(row.work.description)} <span class="muted">(${escape(row.work.unit || '—')})</span></div>
   <div class="muted small">${escape(row.now.section_name)}</div>`

const diffTable = (
  id: string,
  title: string,
  note: string,
  rows: RowT[],
  verdict: FieldDiffT['verdict'],
) => {
  const lines = rows.flatMap((row) =>
    row.diffs
      .filter((diff) => diff.verdict === verdict)
      .map(
        (diff, index) => `<tr>
          <td>${index === 0 ? work(row) : ''}</td>
          <td>${FIELD_LABELS[diff.field]}</td>
          <td>${show(diff.base)}</td>
          <td class="now">${show(diff.now)}</td>
          <td>${show(diff.catalogue)}</td>
        </tr>`,
      ),
  )
  return section(
    id,
    title,
    note,
    rows.length,
    `<table><thead><tr><th style="width:32%">Praca</th><th style="width:14%">Pole</th><th>Szablon wczoraj</th><th>Szablon teraz</th><th>Katalog teraz</th></tr></thead><tbody>${lines.join('')}</tbody></table>`,
  )
}

const workTable = (id: string, title: string, note: string, rows: RowT[]) =>
  section(
    id,
    title,
    note,
    rows.length,
    `<table><thead><tr><th style="width:50%">Praca</th><th>Cena j.m.</th><th>Zmieniona</th></tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr><td>${work(row)}</td><td>${money(row.work.clientPrice)}</td><td class="muted">${row.now.updated_at.slice(0, 16).replace('T', ' ')}</td></tr>`,
      )
      .join('')}</tbody></table>`,
  )

const renamedTable = (rows: RowT[]) =>
  section(
    'renamed',
    'Zmieniony opis lub j.m. — do decyzji',
    'Według ustaleń inna treść to inna praca. Do rozstrzygnięcia przy każdej: zmienić nazwę wpisu w katalogu (zmieni się wszędzie) czy dodać nową pracę obok starej.',
    rows.length,
    `<table><thead><tr><th>Wczoraj</th><th>Teraz</th><th>Katalog</th></tr></thead><tbody>${rows
      .map(
        (row) => `<tr>
          <td>${escape(row.baseWork?.description ?? '')} <span class="muted">(${escape(row.baseWork?.unit || '—')})</span></td>
          <td class="now">${escape(row.work.description)} <span class="muted">(${escape(row.work.unit || '—')})</span><div class="muted small">${escape(row.now.section_name)}</div></td>
          <td>${row.catalogue ? 'nowa treść już jest w katalogu' : '<b>nowej treści nie ma w katalogu</b>'}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`,
  )

const removedTable = (rows: TemplateRowT[]) =>
  section(
    'removed',
    'Usunięte z szablonu',
    'Tylko informacja — w katalogu zostają.',
    rows.length,
    `<table><thead><tr><th>Praca</th><th>Sekcja</th></tr></thead><tbody>${rows
      .map(
        (row) =>
          `<tr><td>${escape(row.description)} <span class="muted">(${escape(row.unit || '—')})</span></td><td class="muted">${escape(row.section_name)}</td></tr>`,
      )
      .join('')}</tbody></table>`,
  )

function section(id: string, title: string, note: string, count: number, body: string) {
  if (count === 0) {
    return `<h2 id="${id}">${title} <span class="count">0</span></h2>`
  }
  return `<h2 id="${id}">${title} <span class="count">${count}</span></h2>
<p class="note">${note}</p><div class="scroll">${body}</div>`
}

const fieldCount = (verdict: FieldDiffT['verdict']) =>
  [...report.toCatalogue, ...report.conflicts, ...report.fillCatalogue]
    .filter((row, index, all) => all.indexOf(row) === index)
    .flatMap((row) => row.diffs)
    .filter((diff) => diff.verdict === verdict).length

const summary: [string, string, number][] = [
  ['to-catalogue', 'Szablon → do katalogu', report.toCatalogue.length],
  ['conflicts', 'Konflikty', report.conflicts.length],
  ['fill-catalogue', 'Tłumaczenia, których katalog nie ma', report.fillCatalogue.length],
  ['renamed', 'Zmieniony opis lub j.m.', report.renamed.length],
  ['new-missing', 'Nowe prace spoza katalogu', report.newMissing.length],
  ['old-missing', 'Prace spoza katalogu sprzed edycji', report.oldMissing.length],
  ['removed', 'Usunięte z szablonu', report.removed.length],
]

const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Szablon a katalog prac</title>
<style>
:root { --bg:#fff; --fg:#1c1c1c; --muted:#6b6b6b; --line:#e3e3e3; --head:#f5f5f5; --now:#0b5d1e; --now-bg:#e8f6ec; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#161616; --fg:#e8e8e8; --muted:#9a9a9a; --line:#2e2e2e; --head:#202020; --now:#8fe0a5; --now-bg:#14301c; } }
:root[data-theme="dark"] { --bg:#161616; --fg:#e8e8e8; --muted:#9a9a9a; --line:#2e2e2e; --head:#202020; --now:#8fe0a5; --now-bg:#14301c; }
* { box-sizing:border-box; }
body { margin:0; padding:24px 16px 80px; background:var(--bg); color:var(--fg); font:14px/1.45 -apple-system, system-ui, sans-serif; }
h1 { font-size:22px; margin:0 0 8px; } h2 { font-size:17px; margin:32px 0 4px; } .count { color:var(--muted); font-weight:400; }
.note, .legend { color:var(--muted); margin:4px 0 8px; max-width:1000px; }
.summary { border-collapse:collapse; min-width:0; width:auto; } .summary td { padding:3px 12px 3px 0; border:0; }
.scroll { overflow-x:auto; }
table { width:100%; min-width:900px; table-layout:fixed; border-collapse:collapse; }
th, td { border-bottom:1px solid var(--line); padding:6px 8px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
th { background:var(--head); font-size:12px; font-weight:600; }
td.now { background:var(--now-bg); color:var(--now); }
.work { font-weight:500; } .small { font-size:12px; } .muted { color:var(--muted); }
a { color:var(--fg); }
</style></head><body>
<h1>Szablon „${escape(process.env.TEMPLATE ?? 'Kosztorys 2026 kolory')}” a katalog prac</h1>
<p class="legend">Szablon wczoraj: ostatnia zmiana pozycji ${lastEdit(baseTemplate)} UTC (przed poprawkami kierownika) · szablon teraz: ostatnia zmiana ${lastEdit(nowTemplate)} UTC · katalog z tej samej kopii co „teraz”.
${nowTemplate.length} prac w szablonie, z czego ${report.inSync} zgodnych z katalogiem we wszystkich polach.</p>
<table class="summary"><tbody>${summary
  .map(([id, label, count]) => `<tr><td><a href="#${id}">${label}</a></td><td>${count}</td></tr>`)
  .join('')}</tbody></table>
<p class="legend">Liczby to prace. Pól do przeniesienia do katalogu: ${fieldCount('toCatalogue')}, pól w konflikcie: ${fieldCount('conflict')}, tłumaczeń do uzupełnienia w katalogu: ${fieldCount('fillCatalogue')}.</p>
${diffTable('to-catalogue', 'Szablon → do katalogu', 'Szablon różni się od katalogu — wygrywa szablon. Te wartości trafią do katalogu.', report.toCatalogue, 'toCatalogue')}
${diffTable('conflicts', 'Konflikty', 'Zmienione w szablonie i w katalogu, albo ta sama praca stoi w szablonie kilka razy z różnymi wartościami. Do decyzji ręcznie.', report.conflicts, 'conflict')}
${diffTable('fill-catalogue', 'Tłumaczenia, których katalog nie ma', 'Szablon ma tłumaczenie, katalog przy tej pracy nie ma żadnego. Trafią do katalogu.', report.fillCatalogue, 'fillCatalogue')}
${renamedTable(report.renamed)}
${workTable('new-missing', 'Nowe prace spoza katalogu', 'Kierownik dodał je do szablonu, katalog ich nie zna. Do dodania do katalogu.', report.newMissing)}
${workTable('old-missing', 'Prace spoza katalogu sprzed edycji', 'Były w szablonie już wczoraj i katalog ich nie zna.', report.oldMissing)}
${removedTable(report.removed)}
</body></html>
`
writeFileSync(reportPath, html)

writeFileSync(
  join(exportDir, 'plan.json'),
  JSON.stringify(
    [...new Set([...report.toCatalogue, ...report.fillCatalogue])].map((row) => ({
      catalogueId: row.catalogue?.id,
      description: row.work.description,
      unit: row.work.unit,
      fields: row.diffs
        .filter((diff) => diff.verdict === 'toCatalogue' || diff.verdict === 'fillCatalogue')
        .map((diff) => ({ field: diff.field, value: diff.now })),
    })),
    null,
    2,
  ),
)

console.error(
  summary.map(([, label, count]) => `${label}: ${count}`).join('\n') + `\nzgodne: ${report.inSync}`,
)
