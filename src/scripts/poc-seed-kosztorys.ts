// One-off: seed rozpiski robocizny z testowego arkusza do inwestycji POC.
// TYLKO wykonczymy-poc. Czyta zakładkę kosztorys_robocizny (UNFORMATTED) i mapuje
// na schemat kosztorys_*. Czyści wcześniejsze wiersze inwestycji przed seedem.
//
//   node --env-file=.env --import tsx src/scripts/poc-seed-kosztorys.ts
import { google } from 'googleapis'
import { getPayload } from 'payload'
import config from '../payload.config'

const SHEET_ID = '1TWZuU7ZDElhUameN4ii2U5TztmQG387Gqcn9NgwwObE'
const TAB = 'kosztorys_robocizny'
const INVESTMENT_ID = 6
const STAGE_COUNT = 6

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))

async function fetchRows(): Promise<unknown[][]> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string)
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A4:O250`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  })
  return res.data.values ?? []
}

async function run() {
  const rows = await fetchRows()
  const payload = await getPayload({ config })

  // Wyczyść poprzednie wiersze inwestycji (sekcje kasują pozycje + postęp przez FK CASCADE).
  const ctx = { context: { skipRevalidation: true } }
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

  // 6 etapów (kolumny C–H).
  const stageIds: number[] = []
  for (let ord = 1; ord <= STAGE_COUNT; ord++) {
    const s = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: INVESTMENT_ID, ordinal: ord },
      ...ctx,
    })
    stageIds.push(s.id)
  }

  let currentSectionId: number | undefined
  let sectionOrder = 0
  let itemOrder = 0
  let sectionCount = 0
  let itemCount = 0
  let progressCount = 0

  for (const row of rows) {
    const a = row[0]
    const b = str(row[1])

    // Wiersz-nagłówek sekcji: kolumna A to tekst (nie numer).
    if (typeof a === 'string' && a.trim() !== '') {
      const name = b || a.trim()
      const section = await payload.create({
        collection: 'kosztorys-sections',
        data: {
          investment: INVESTMENT_ID,
          name,
          displayOrder: sectionOrder++,
          vatRate: 0.08,
          defaultCostVariant: 'w_tools',
        },
        ...ctx,
      })
      currentSectionId = section.id
      itemOrder = 0
      sectionCount++
      continue
    }

    // Pozycja: A numeryczne + niepusty opis. Puste wiersze pomijamy.
    if (typeof a === 'number' && b !== '') {
      if (currentSectionId == null) continue // pozycja przed pierwszą sekcją — pomiń
      const stageQty = [row[2], row[3], row[4], row[5], row[6], row[7]].map(num) // C–H
      const plannedQty = num(row[8]) // I
      const measuredQty = num(row[9]) // J
      const unit = str(row[10]) || null // K
      const clientPrice = num(row[11]) // L
      const rabat = num(row[12]) // M (ułamek, 0,05 = 5%)

      const item = await payload.create({
        collection: 'kosztorys-items',
        data: {
          investment: INVESTMENT_ID,
          section: currentSectionId,
          displayOrder: itemOrder++,
          description: b,
          unit,
          plannedQty,
          measuredQty,
          discountType: rabat > 0 ? 'percent' : null,
          discountValue: rabat > 0 ? rabat * 100 : 0,
          clientPrice,
          subcontractorWToolsPrice: 0,
          subcontractorOwnToolsPrice: 0,
          hiddenInExport: false,
        },
        ...ctx,
      })
      itemCount++

      for (let k = 0; k < STAGE_COUNT; k++) {
        if (stageQty[k] !== 0) {
          await payload.create({
            collection: 'stage-progress',
            data: { item: item.id, stage: stageIds[k], qtyDone: stageQty[k] },
            ...ctx,
          })
          progressCount++
        }
      }
    }
  }

  console.log(
    `Seeded inv ${INVESTMENT_ID}: ${sectionCount} sekcji, ${itemCount} pozycji, ${STAGE_COUNT} etapów, ${progressCount} wpisów postępu`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
