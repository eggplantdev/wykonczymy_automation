// Seed one investment's FULL kosztorys tree from the owner's Google Sheet (local dev DB). Białostocka-
// SPECIFIC: the column mapping and the two-tab join below match THIS sheet. Every investment's sheet
// drifts (formulas differ, layout shifts), so a new investment needs its own fixture + a column re-check
// — this is a blueprint, not a universal importer.
//
// DURABILITY — the fixture, not the sheet, is the store of record. `REFETCH=1` re-pulls both tabs and
// overwrites the committed fixture; the default run seeds straight from the fixture, so a DB wipe (or
// lost sheet access) never loses the data. Commit the fixture.
//
//   REFETCH=1 node --env-file=.env --import tsx src/scripts/seed-investment-from-sheet.ts  # re-pull sheet → fixture → seed
//           node --env-file=.env --import tsx src/scripts/seed-investment-from-sheet.ts    # seed from fixture (offline)
//
// TWO tabs, joined 1:1 by row (bez-narzędzi rN mirrors kosztorys_robocizny row N via formula):
//   kosztorys_robocizny  = the TRUE inputs — sekcje, opis, j.m., Cena j.m. (Q), Przedmiar (N), rabat (R,
//                          a fraction), and the 10 „etap ilość” columns D–M (per-etap wykonano).
//   zakres pracy bez narz. = ADDS only the two subcontractor rate columns: R „z narzędziami”, T „bez
//                          narzędzi” (mostly =P×0,65 / ×0,85, with per-item hardcoded overrides).
// clientPrice + the two rates → per-item `'coeff'` overrides (calc.ts: clientPrice × value), preserved by
// serialize-preset. So the stripped, reusable preset falls out of the app's „Zapisz jako preset” run
// against this investment — no separate preset write here.
//
// A `server-only` guard makes insertKosztorysTree unimportable from a tsx script, so this seeds via the
// Payload API (like seed-kosztorys.ts) rather than the raw bulk insert.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { google } from 'googleapis'
import { getPayload } from 'payload'
import config from '../payload.config'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '../lib/kosztorys/constants'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '../lib/kosztorys/snapshot-format'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
  SubcontractorOverrideTypeT,
} from '../lib/kosztorys/types'

const SHEET_ID = process.env.SHEET_ID ?? '1EgNFob2baPlKUMTSQlfbzc2HJI5zmITPZUQsJbkomz4'
const ROBOCIZNA_TAB = process.env.ROBOCIZNA_TAB ?? 'kosztorys_robocizny'
const RATES_TAB = process.env.RATES_TAB ?? 'zakres pracy bez narzędzi'
const INVESTMENT_ID = Number(process.env.INV ?? 42) // Bialostocka 5
const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'kosztorys-bialostocka.json',
)

// kosztorys_robocizny column offsets, 0-based from the A4 fetch origin (so index 0 = column A).
const ROB = {
  section: 0, // A — section name, repeated on member rows; authoritative on header rows
  description: 2, // C
  etapFirst: 3, // D — „1 etap ilość”; ten contiguous columns D–M
  headerMarkPrzedmiar: 13, // N = „x” on a section header (else the Przedmiar quantity)
  headerMarkPomiar: 14, // O = „x” on a section header (else Pomiar z natury)
  unit: 15, // P — j.m.
  clientPrice: 16, // Q — Cena j.m.
  rabat: 17, // R — rabat as a fraction (0,09 = 9%)
} as const
const ETAP_COUNT = 10 // D–M

// zakres-pracy-bez-narzędzi column offsets (same A4 origin) — only the two rate columns are read here.
const RATE = {
  wToolsRate: 17, // R — cennik z narzędziami
  ownToolsRate: 19, // T — cennik bez narzędzi
} as const

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6

// One view's per-item subcontractor override. A rate over a positive client price becomes a `'coeff'`
// (tracks the client price); a rate with no client price is frozen as a flat `'amount'`. A blank rate
// means 0, NOT "inherit the default coeff": the sheet has no inherit concept, and its subcontractor
// total (`SUM` over per-etap wartości) drops such rows to zero — a `null` override would instead invent
// a section/global-coeff cost the sheet never has. So a blank rate freezes an explicit flat 0.
function deriveOverride(
  rate: number,
  clientPrice: number,
): { type: SubcontractorOverrideTypeT | null; value: number } {
  if (rate <= 0) return { type: 'amount', value: 0 }
  if (clientPrice > 0) return { type: 'coeff', value: round6(rate / clientPrice) }
  return { type: 'amount', value: rate }
}

async function fetchRows(tab: string): Promise<unknown[][]> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string)
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A4:T450`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  return res.data.values ?? []
}

function buildPayload(robRows: unknown[][], rateRows: unknown[][]): SnapshotPayloadT {
  const sections: KosztorysSectionT[] = []
  const items: KosztorysItemT[] = []
  const progress: StageProgressT[] = []
  const sectionIdByName = new Map<string, number>()
  let currentSection = ''
  let nextSectionId = 1
  let nextItemId = 1
  let maxEtap = 0 // highest 1-based etap index carrying any executed qty — trims empty trailing stages

  robRows.forEach((rob, i) => {
    // A section header marks N or O with „x” and carries the section name in A.
    const isHeader =
      str(rob[ROB.headerMarkPrzedmiar]) === 'x' || str(rob[ROB.headerMarkPomiar]) === 'x'
    if (isHeader) {
      const name = str(rob[ROB.section])
      if (name) currentSection = name
      return
    }

    const description = str(rob[ROB.description])
    if (!description || !currentSection) return

    let sectionId = sectionIdByName.get(currentSection)
    if (sectionId === undefined) {
      sectionId = nextSectionId++
      sectionIdByName.set(currentSection, sectionId)
      sections.push({
        id: sectionId,
        name: currentSection,
        displayOrder: sections.length,
        defaultCostVariant: 'w_tools',
        wToolsCoeff: null,
        ownToolsCoeff: null,
      })
    }

    const clientPrice = num(rob[ROB.clientPrice])
    const rate = rateRows[i] ?? []
    const wTools = deriveOverride(num(rate[RATE.wToolsRate]), clientPrice)
    const ownTools = deriveOverride(num(rate[RATE.ownToolsRate]), clientPrice)
    const rabat = num(rob[ROB.rabat])

    const itemId = nextItemId++
    items.push({
      id: itemId,
      sectionId,
      displayOrder: items.length,
      description,
      unit: str(rob[ROB.unit]) || null,
      plannedQty: num(rob[ROB.headerMarkPrzedmiar]), // N — Przedmiar (a number on data rows)
      discountType: rabat > 0 ? 'percent' : null,
      discountValue: rabat > 0 ? round6(rabat * 100) : 0,
      clientPrice,
      wToolsOverrideType: wTools.type,
      wToolsOverrideValue: wTools.value,
      ownToolsOverrideType: ownTools.type,
      ownToolsOverrideValue: ownTools.value,
      costVariant: null,
      hiddenInExport: false,
      note: null,
    })

    // Per-etap wykonano → stage_progress. Stage id == 1-based etap ordinal (remapped on seed).
    for (let k = 0; k < ETAP_COUNT; k++) {
      const qty = num(rob[ROB.etapFirst + k])
      if (qty !== 0) {
        progress.push({ itemId, stageId: k + 1, qtyDone: qty })
        if (k + 1 > maxEtap) maxEtap = k + 1
      }
    }
  })

  const stageCount = Math.max(1, maxEtap)
  const stages: KosztorysStageT[] = Array.from({ length: stageCount }, (_, k) => ({
    id: k + 1,
    ordinal: k + 1,
    label: null,
  }))

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections,
    items,
    stages,
    progress,
    settings: {
      wToolsCoeff: DEFAULT_COEFFS.wTools,
      ownToolsCoeff: DEFAULT_COEFFS.ownTools,
      vatRate: DEFAULT_VAT,
      globalDiscountType: null,
      globalDiscountValue: 0,
    },
  }
}

async function seed(tree: SnapshotPayloadT): Promise<void> {
  const payload = await getPayload({ config })
  const ctx = { context: { skipRevalidation: true } }

  // Wipe the investment's existing tree. Deleting sections cascades items + progress; stages are separate.
  await payload.delete({
    collection: 'kosztorys-sections',
    where: { investment: { equals: INVESTMENT_ID } },
    ...ctx,
  })
  await payload.delete({
    collection: 'kosztorys-stages',
    where: { investment: { equals: INVESTMENT_ID } },
    ...ctx,
  })

  const stageMap = new Map<number, number>()
  for (const s of tree.stages) {
    const created = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: INVESTMENT_ID, ordinal: s.ordinal, label: s.label ?? undefined },
      ...ctx,
    })
    stageMap.set(s.id, created.id)
  }

  const sectionMap = new Map<number, number>()
  for (const sec of tree.sections) {
    const created = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: INVESTMENT_ID,
        name: sec.name,
        displayOrder: sec.displayOrder,
        defaultCostVariant: sec.defaultCostVariant,
        wToolsCoeff: sec.wToolsCoeff ?? undefined,
        ownToolsCoeff: sec.ownToolsCoeff ?? undefined,
      },
      ...ctx,
    })
    sectionMap.set(sec.id, created.id)
  }

  const itemMap = new Map<number, number>()
  for (const it of tree.items) {
    const section = sectionMap.get(it.sectionId)
    if (section === undefined) continue
    const created = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: INVESTMENT_ID,
        section,
        displayOrder: it.displayOrder,
        description: it.description ?? undefined,
        unit: it.unit ?? undefined,
        plannedQty: it.plannedQty,
        discountType: it.discountType ?? undefined,
        discountValue: it.discountValue,
        clientPrice: it.clientPrice,
        wToolsOverrideType: it.wToolsOverrideType ?? undefined,
        wToolsOverrideValue: it.wToolsOverrideValue,
        ownToolsOverrideType: it.ownToolsOverrideType ?? undefined,
        ownToolsOverrideValue: it.ownToolsOverrideValue,
        costVariant: it.costVariant ?? undefined,
        hiddenInExport: it.hiddenInExport,
        note: it.note ?? undefined,
      },
      ...ctx,
    })
    itemMap.set(it.id, created.id)
  }

  let progressCount = 0
  for (const p of tree.progress) {
    const item = itemMap.get(p.itemId)
    const stage = stageMap.get(p.stageId)
    if (item === undefined || stage === undefined) continue
    await payload.create({
      collection: 'stage-progress',
      data: { item, stage, qtyDone: p.qtyDone },
      ...ctx,
    })
    progressCount++
  }

  console.log(
    `Seeded inv ${INVESTMENT_ID}: ${tree.sections.length} sekcji, ${tree.items.length} prac, ` +
      `${tree.stages.length} etapów, ${progressCount} wpisów postępu.`,
  )
}

async function run() {
  let tree: SnapshotPayloadT
  if (process.env.REFETCH === '1') {
    const [robRows, rateRows] = await Promise.all([fetchRows(ROBOCIZNA_TAB), fetchRows(RATES_TAB)])
    tree = buildPayload(robRows, rateRows)
    if (tree.items.length === 0) {
      throw new Error(`No items parsed from ${ROBOCIZNA_TAB} — check SHEET_ID / TAB / sharing.`)
    }
    mkdirSync(dirname(FIXTURE), { recursive: true })
    writeFileSync(FIXTURE, JSON.stringify(tree, null, 2) + '\n')
    console.log(`Fixture written: ${FIXTURE}`)
  } else {
    tree = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  }

  await seed(tree)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
