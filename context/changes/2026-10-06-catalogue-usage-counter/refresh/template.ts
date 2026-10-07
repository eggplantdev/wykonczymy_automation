import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { bigrams, diceSimilarity } from '@/lib/utils/string-similarity'
import { investmentOf, isLegacySource } from './sources'

// Which szablon prac nobody uses — counting a praca typed under another name or j.m. as used, so
// the list can drive deleting prac from the szablon. Name similarity only PROPOSES a pair; whether
// it is the same praca is a human verdict kept in template-verdicts.tsv, and a pair nobody has
// judged yet is reported as such instead of being guessed.
const [out, dump, verdictsPath, reportPath, source = 'szablon'] = process.argv.slice(2)
// The same report over two lists of prac: one szablon, or the whole katalog prac.
const SOURCES = {
  szablon: {
    file: 'tpl.tsv',
    heading: `Szablon „${process.env.TEMPLATE ?? 'Kosztorys 2026 kolory'}” — użycie prac`,
    title: 'Użycie prac szablonu',
    twin: 'też w szablonie',
    twinNote: 'druga pozycja tego samego szablonu',
  },
  katalog: {
    file: 'cat-works.tsv',
    heading: 'Katalog prac — użycie prac',
    title: 'Użycie prac katalogu',
    twin: 'też w katalogu',
    twinNote: 'drugi wpis tego samego katalogu',
  },
} as const
const list = SOURCES[source as keyof typeof SOURCES]
const rows = (file: string) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => line.split('\t'))

// Bigram Dice catches spelling, the stem overlap catches reworded names („Klejenie paneli
// winylowych" ~ „Układanie paneli winylowych na klej"). Both are loose on purpose — a missed pair
// is a praca deleted while in use, an extra pair costs one verdict.
const DICE_MIN = 0.55
const STEMS_MIN = 0.4
const CANDIDATE_LIMIT = 8
// A praca about to be reported as never used gets a second, looser search before anyone deletes it:
// one distinctive word in common is enough („sylikon do parapetów" ~ „Silikonowanie parapetu"),
// which the two measures above miss whenever the rest of the name was reworded.
const LOOSE_LIMIT = 12
const LOOSE_STEM_LENGTH = 5
const DISTINCTIVE_SHARE = 0.03
const STOP_WORDS = new Set(['oraz', 'etc', 'itp', 'prac', 'min', 'pod', 'np'])
const stems = (text: string, length = 6) =>
  new Set(
    foldDescription(text)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      .map((word) => word.slice(0, length)),
  )
const stemOverlap = (left: Set<string>, right: Set<string>) => {
  const shared = [...left].filter((word) => right.has(word)).length
  return shared / Math.max(1, new Set([...left, ...right]).size)
}

// Every set holds investment ids, so an investment counts once whether the praca is named by its
// app kosztorys, by its old sheet, or by both. `usedInApp` is what lets the report say how much of
// a count rests on an old sheet alone.
type UsageT = {
  present: Set<string>
  used: Set<string>
  usedInApp: Set<string>
  planned: Set<string>
  done: Set<string>
}
type NameT = { description: string; unit: string }
const emptyUsage = (): UsageT => ({
  present: new Set(),
  used: new Set(),
  usedInApp: new Set(),
  planned: new Set(),
  done: new Set(),
})
const usage = new Map<string, UsageT>()
const spellings = new Map<string, Map<string, number>>()
// App kosztorysy plus the old Google sheets of the same investments and of those never brought into
// the app (legacy.ts).
const legacyFile = `${out}/legacy-items.tsv`
const itemRows = [...rows(`${out}/items.tsv`), ...(existsSync(legacyFile) ? rows(legacyFile) : [])]
for (const [source, , description, unit, planned, done] of itemRows) {
  const inv = investmentOf(source)
  const key = catalogueKey(description, unit || null)
  const entry = usage.get(key) ?? emptyUsage()
  entry.present.add(inv)
  if (Number(planned) > 0) entry.planned.add(inv)
  if (Number(done) > 0) entry.done.add(inv)
  if (Number(planned) > 0 || Number(done) > 0) {
    entry.used.add(inv)
    if (!isLegacySource(source)) entry.usedInApp.add(inv)
    const label = `${description.trim()}\t${unit}`
    const counts = spellings.get(key) ?? new Map<string, number>()
    counts.set(label, (counts.get(label) ?? 0) + 1)
    spellings.set(key, counts)
  }
  usage.set(key, entry)
}
const nameOf = (key: string): NameT => {
  const [label] = [...(spellings.get(key) ?? [])].sort((left, right) => right[1] - left[1])[0]
  const [description, unit] = label.split('\t')
  return { description, unit }
}

type TemplateRowT = NameT & { key: string; sections: string[] }
const template = new Map<string, TemplateRowT>()
for (const [section, description, unit] of rows(`${out}/${list.file}`)) {
  const key = catalogueKey(description, unit || null)
  const row = template.get(key)
  if (row) row.sections.push(...[section.trim()].filter(Boolean))
  else
    template.set(key, {
      key,
      description: description.trim(),
      unit,
      sections: [section.trim()].filter(Boolean),
    })
}

type VerdictT = 'ta-sama' | 'inna'
const verdicts = new Map<string, VerdictT>()
const pairKey = (left: string, right: string) => `${left}→${right}`
if (existsSync(verdictsPath))
  for (const [description, unit, otherDescription, otherUnit, verdict] of rows(verdictsPath))
    verdicts.set(
      pairKey(
        catalogueKey(description, unit || null),
        catalogueKey(otherDescription, otherUnit || null),
      ),
      verdict as VerdictT,
    )

const usedPool = [...spellings.keys()].map((key) => {
  const name = nameOf(key)
  return {
    key,
    ...name,
    pairs: bigrams(foldDescription(name.description)),
    stems: stems(name.description),
    looseStems: stems(name.description, LOOSE_STEM_LENGTH),
  }
})
const namesWithStem = new Map<string, number>()
for (const { looseStems } of usedPool)
  for (const stem of looseStems) namesWithStem.set(stem, (namesWithStem.get(stem) ?? 0) + 1)
// „Montaż" stands in a third of all names and says nothing; „parapet" stands in a handful.
const distinctiveness = (stem: string) => {
  const names = namesWithStem.get(stem) ?? 0
  return names > 0 && names <= Math.max(3, usedPool.length * DISTINCTIVE_SHARE)
    ? Math.log(usedPool.length / names)
    : 0
}
const descriptionPart = (key: string) => key.slice(0, key.lastIndexOf('|'))

type CandidateT = NameT & { key: string; count: number; verdict?: VerdictT; inTemplate: boolean }
const report = [...template.values()].map((row) => {
  const pairs = bigrams(foldDescription(row.description))
  const rowStems = stems(row.description)
  const judged = (key: string) => verdicts.has(pairKey(row.key, key))
  const toCandidate = (other: (typeof usedPool)[number]): CandidateT => ({
    key: other.key,
    description: other.description,
    unit: other.unit,
    count: usage.get(other.key)?.used.size ?? 0,
    verdict: verdicts.get(pairKey(row.key, other.key)),
    inTemplate: template.has(other.key),
  })
  const scored = usedPool
    .filter((other) => other.key !== row.key)
    .map((other) => ({
      other,
      dice: diceSimilarity(pairs, other.pairs),
      overlap: stemOverlap(rowStems, other.stems),
      sameDescription: descriptionPart(other.key) === descriptionPart(row.key),
    }))
  // Which pairs get proposed must not depend on the verdicts already given, or judging one batch
  // would surface the next one forever.
  const proposed = scored
    .filter(
      ({ dice, overlap, sameDescription }) =>
        sameDescription || dice >= DICE_MIN || overlap >= STEMS_MIN,
    )
    .sort(
      (left, right) =>
        Number(right.sameDescription) - Number(left.sameDescription) ||
        Math.max(right.dice, right.overlap) - Math.max(left.dice, left.overlap),
    )
    .filter(({ sameDescription }, index) => sameDescription || index < CANDIDATE_LIMIT)
    .map(({ other }) => other)
  const proposedKeys = new Set(proposed.map((other) => other.key))
  const usedUnderOwnOrJudgedName =
    (usage.get(row.key)?.used.size ?? 0) > 0 ||
    scored.some(({ other }) => verdicts.get(pairKey(row.key, other.key)) === 'ta-sama')
  const looseStems = stems(row.description, LOOSE_STEM_LENGTH)
  const loose = usedUnderOwnOrJudgedName
    ? []
    : scored
        .filter(({ other }) => !proposedKeys.has(other.key))
        .map(({ other }) => ({
          other,
          score: [...looseStems]
            .filter((stem) => other.looseStems.has(stem))
            .reduce((sum, stem) => sum + distinctiveness(stem), 0),
        }))
        .filter(({ score }) => score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, LOOSE_LIMIT)
        .map(({ other }) => other)
  const shownKeys = new Set([...proposedKeys, ...loose.map((other) => other.key)])
  const judgedOnly = scored
    .filter(({ other }) => judged(other.key) && !shownKeys.has(other.key))
    .map(({ other }) => other)
  const candidates = [...proposed, ...loose, ...judgedOnly].map(toCandidate)
  const same = candidates.filter((candidate) => candidate.verdict === 'ta-sama')
  const union = (pick: (entry: UsageT) => Set<string>) =>
    new Set(
      [row.key, ...same.map((candidate) => candidate.key)].flatMap((key) => [
        ...pick(usage.get(key) ?? emptyUsage()),
      ]),
    )
  return {
    ...row,
    present: usage.get(row.key)?.present.size ?? 0,
    exact: usage.get(row.key)?.used.size ?? 0,
    total: union((entry) => entry.used).size,
    legacy: union((entry) => entry.used).size - union((entry) => entry.usedInApp).size,
    planned: union((entry) => entry.planned).size,
    done: union((entry) => entry.done).size,
    candidates,
  }
})
const unreviewed = report.flatMap((row) =>
  row.candidates
    .filter((candidate) => candidate.verdict === undefined)
    .map((candidate) =>
      [row.description, row.unit, candidate.description, candidate.unit, '', candidate.count].join(
        '\t',
      ),
    ),
)
writeFileSync(`${out}/unreviewed-${source}.tsv`, unreviewed.join('\n'))

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const candidateLine = (candidate: CandidateT) =>
  `<li>${escape(candidate.description)} <span class="unit">(${escape(candidate.unit)})</span> <b>${candidate.count}</b>${candidate.inTemplate ? ` <span class="twin">${list.twin}</span>` : ''}</li>`
const listOf = (candidates: CandidateT[]) =>
  candidates.length ? `<ul>${candidates.map(candidateLine).join('')}</ul>` : ''
const sourcesOf = (legacy: boolean) =>
  new Set(
    itemRows
      .filter(([source]) => isLegacySource(source) === legacy)
      .map(([source]) => investmentOf(source)),
  )
const kosztorysy = sourcesOf(false).size
const legacySheets = sourcesOf(true).size
const legacyOnlySheets = [...sourcesOf(true)].filter((inv) => !sourcesOf(false).has(inv)).length

const table = (id: string, title: string, note: string, group: typeof report) => {
  const body = group.map((row) => {
    const pending = row.candidates.filter((candidate) => candidate.verdict === undefined)
    const same = row.candidates.filter((candidate) => candidate.verdict === 'ta-sama')
    const other = row.candidates.filter((candidate) => candidate.verdict === 'inna')
    const label = [`${row.description} (${row.unit})`, row.sections.join(', ')]
      .filter(Boolean)
      .join(' — ')
    return `<tr data-search="${escape(`${row.description} ${row.sections.join(' ')} ${row.candidates.map((candidate) => candidate.description).join(' ')}`.toLowerCase())}">
<td><input type="checkbox" data-key="${escape(row.key)}" data-label="${escape(label)}"></td>
<td class="work">${escape(row.description)}<div class="sections">${escape(row.sections.join(' · '))}</div></td>
<td>${escape(row.unit)}</td><td class="num">${row.present}</td><td class="num">${row.exact}</td><td class="num total">${row.total}</td><td class="num">${row.legacy}</td><td class="num">${row.planned}</td><td class="num">${row.done}</td>
<td class="list">${listOf(same)}</td>
<td class="list muted">${listOf(other)}${pending.length ? `<div class="pending">NIESPRAWDZONE</div>${listOf(pending)}` : ''}</td></tr>`
  })
  return `<section id="${id}"><h2>${title} <span class="count">${group.length}</span></h2><p class="note">${note}</p>
<div class="scroll"><table><colgroup><col style="width:36px"><col style="width:30%"><col style="width:52px"><col style="width:60px"><col style="width:64px"><col style="width:64px"><col style="width:64px"><col style="width:72px"><col style="width:56px"><col><col></colgroup>
<thead><tr><th></th><th>praca</th><th>j.m.</th><th title="w ilu kosztorysach stoi, także z zerami">jest w</th><th title="Przedmiar lub etapy pod dokładnie tą nazwą i j.m.">tą nazwą</th><th title="tą nazwą + ta sama praca pod inną nazwą / j.m.">łącznie</th><th title="ile z „łącznie” widać wyłącznie w starym arkuszu Google">w tym stare ark.</th><th>przedmiar</th><th>etapy</th><th>ta sama praca pod inną nazwą / j.m.</th><th>podobne, ale inna praca</th></tr></thead>
<tbody>${body.join('\n')}</tbody></table></div></section>`
}

const byTotal = (left: (typeof report)[number], right: (typeof report)[number]) =>
  left.total - right.total || left.exact - right.exact
const neverUsed = report.filter((row) => row.total === 0)
const renamed = report.filter((row) => row.exact === 0 && row.total > 0).sort(byTotal)
const used = report.filter((row) => row.exact > 0).sort(byTotal)

const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${list.title}</title>
<style>
:root { --bg:#fff; --fg:#1c1c1c; --muted:#6b6b6b; --line:#e3e3e3; --head:#f5f5f5; --accent:#b4231b; --twin:#8a5a00; --twin-bg:#fff3d6; --checked:#fdecea; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#161616; --fg:#e8e8e8; --muted:#9a9a9a; --line:#2e2e2e; --head:#202020; --accent:#ff7a70; --twin:#f0c060; --twin-bg:#3a2e10; --checked:#3a1d1b; } }
:root[data-theme="dark"] { --bg:#161616; --fg:#e8e8e8; --muted:#9a9a9a; --line:#2e2e2e; --head:#202020; --accent:#ff7a70; --twin:#f0c060; --twin-bg:#3a2e10; --checked:#3a1d1b; }
* { box-sizing:border-box; }
body { margin:0; padding:24px 16px 80px; background:var(--bg); color:var(--fg); font:14px/1.45 -apple-system, system-ui, sans-serif; }
h1 { font-size:22px; margin:0 0 8px; } h2 { font-size:17px; margin:32px 0 4px; } .count { color:var(--muted); font-weight:400; }
.legend, .note { color:var(--muted); margin:4px 0; max-width:1000px; }
.toolbar { position:sticky; top:0; z-index:3; background:var(--bg); display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:10px 0; border-bottom:1px solid var(--line); }
.toolbar input[type=search] { flex:1 1 240px; padding:6px 10px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--fg); font:inherit; }
.toolbar button { padding:6px 12px; border:1px solid var(--line); border-radius:6px; background:var(--head); color:var(--fg); font:inherit; cursor:pointer; }
.toolbar a { color:var(--fg); }
.scroll { overflow-x:auto; }
table { width:100%; min-width:1100px; table-layout:fixed; border-collapse:collapse; }
th, td { border-bottom:1px solid var(--line); padding:6px 8px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
th { position:sticky; top:52px; background:var(--head); font-size:12px; font-weight:600; z-index:2; }
td.num { text-align:right; font-variant-numeric:tabular-nums; } td.total { font-weight:700; }
.work { font-weight:500; } .sections { color:var(--muted); font-size:12px; font-weight:400; margin-top:2px; }
.list ul { margin:0; padding-left:16px; font-size:12.5px; } .list li { margin-bottom:3px; }
.muted { color:var(--muted); } .unit { color:var(--muted); }
.twin { background:var(--twin-bg); color:var(--twin); border-radius:4px; padding:0 4px; font-size:11px; white-space:nowrap; }
.pending { color:var(--accent); font-weight:700; font-size:12px; margin-top:4px; }
tr.checked td { background:var(--checked); }
</style></head><body>
<h1>${escape(list.heading)}</h1>
<p class="legend">Dump: ${escape(dump)} · ${kosztorysy} kosztorysów w aplikacji (bez szablonów i kosza) + ${legacySheets} starych arkuszy Google, z czego ${legacyOnlySheets} to inwestycje bez kosztorysu w aplikacji, a ${legacySheets - legacyOnlySheets} — starsza kopia kosztorysu, który w aplikacji jest. Liczby to <b>liczba inwestycji</b>; inwestycja liczy się raz, choćby praca stała i w aplikacji, i w arkuszu:
<b>jest w</b> — w ilu praca stoi, także z zerami; <b>tą nazwą</b> — w ilu ma Przedmiar lub etapy pod dokładnie tą nazwą i j.m.;
<b>łącznie</b> — j.w. plus ta sama praca pod inną nazwą / j.m., bez podwójnego liczenia; <b>w tym stare ark.</b> — ile z „łącznie” widać wyłącznie w starym arkuszu (w aplikacji tej pracy w tej inwestycji nie ma albo ma zera); <b>przedmiar</b> / <b>etapy</b> — z „łącznie”.</p>
<p class="legend">Przy pracy pod inną nazwą: nazwa (j.m.) i <b>w ilu inwestycjach użyta</b>; <span class="twin">${list.twin}</span> — ${list.twinNote}, czyli praca wpisana dwa razy.
Czy to „ta sama praca”, czy „inna”, rozstrzyga ręczna ocena w <code>refresh/template-verdicts.tsv</code>. ${unreviewed.length === 0 ? 'Wszystkie pary są ocenione.' : `<span class="pending">${unreviewed.length} par nieocenionych.</span>`}</p>
<div class="toolbar">
<input type="search" id="search" placeholder="Szukaj pracy lub sekcji…">
<a href="#never">Nigdy nieużyte (${neverUsed.length})</a> · <a href="#renamed">Pod inną nazwą (${renamed.length})</a> · <a href="#used">Używane (${used.length})</a>
<button id="copy">Kopiuj zaznaczone (<span id="picked">0</span>)</button>
</div>
${table('never', 'Nigdy nieużyte — także pod inną nazwą', 'Kandydaci do usunięcia. Kolumna „podobne, ale inna praca” pokazuje, co odrzuciłem jako inną pracę — sprawdź, czy słusznie.', neverUsed)}
${table('renamed', 'Ta nazwa nieużywana, ale ta sama praca używana pod inną nazwą / j.m.', 'Praca jest potrzebna — nieużywana jest tylko ta nazwa.', renamed)}
${table('used', 'Używane — od najrzadziej', '', used)}
<script>
const STORE = '${source}-usage-picked'
const read = () => { try { return new Set(JSON.parse(localStorage.getItem(STORE) || '[]')) } catch { return new Set() } }
const picked = read()
const boxes = [...document.querySelectorAll('input[type=checkbox][data-key]')]
const sync = () => {
  boxes.forEach((box) => box.closest('tr').classList.toggle('checked', box.checked))
  document.getElementById('picked').textContent = boxes.filter((box) => box.checked).length
  try { localStorage.setItem(STORE, JSON.stringify(boxes.filter((box) => box.checked).map((box) => box.dataset.key))) } catch {}
}
boxes.forEach((box) => { box.checked = picked.has(box.dataset.key); box.addEventListener('change', sync) })
sync()
document.getElementById('copy').addEventListener('click', () => {
  const text = boxes.filter((box) => box.checked).map((box) => box.dataset.label).join('\\n')
  navigator.clipboard.writeText(text)
})
document.getElementById('search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase()
  document.querySelectorAll('tbody tr').forEach((row) => { row.hidden = query !== '' && !row.dataset.search.includes(query) })
})
</script>
</body></html>
`
writeFileSync(reportPath, html)
console.error(
  `${reportPath}: ${neverUsed.length} / ${renamed.length} / ${used.length}, nieocenione pary: ${unreviewed.length} (${out}/unreviewed-${source}.tsv)`,
)
