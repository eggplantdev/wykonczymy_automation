// After `load-draft-sql-prod.ts` writes AI przedmiar straight into the DB, nothing has expired the editor's
// cache. Saving the first sekcja under its own name goes through the app and bumps the kosztorys tree
// tags; the total printed after it is read back from production, as the check that the load landed.
// The loader's SQL also leaves the pozycje it added or re-worded without a translation (or with one
// for the old opis), so the editor's „Uzupełnij tłumaczenia (AI)” runs here too.
//   TOKEN_FILE=… INVESTMENT=207 \
//     node --import tsx scripts/ai-kosztorys/touch-kosztorys-prod.ts
import { api, callAction, itemsOf, resolveActions } from './prod-client'

type SectionT = { id: number; name: string }

const INVESTMENT = Number(process.env.INVESTMENT)

async function run() {
  if (!INVESTMENT) throw new Error('INVESTMENT is required')
  const page = `/inwestycje/${INVESTMENT}/kosztorys_v2`
  const { docs: sections } = await api<{ docs: SectionT[] }>(
    `/kosztorys-sections?where[investment][equals]=${INVESTMENT}&limit=1&sort=displayOrder`,
  )
  if (!sections.length) throw new Error(`#${INVESTMENT} has no sekcje`)
  await resolveActions(page, ['updateSectionFieldAction', 'fillKosztorysTranslationsAction'])
  await callAction('updateSectionFieldAction', page, [sections[0].id, { name: sections[0].name }])

  const fill = await callAction<{ data?: { items: number; sections: number; failed: number } }>(
    'fillKosztorysTranslationsAction',
    page,
    [INVESTMENT],
  )
  if (!fill.data) throw new Error(`translations failed: ${JSON.stringify(fill)}`)
  const { items: translated, sections: sectionNames, failed } = fill.data
  console.log(
    `tłumaczenia: ${translated} pozycji, ${sectionNames} nazw sekcji, ${failed} nieudanych`,
  )

  const items = await itemsOf(INVESTMENT)
  const loaded = items.filter((item) => (item.aiPlannedQty ?? 0) > 0)
  const total = items.reduce((sum, item) => sum + (item.aiPlannedQty ?? 0) * item.clientPrice, 0)
  console.log(`AI przedmiar: ${total.toFixed(2)} zł, ${loaded.length} pozycji > 0 → ${page}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
