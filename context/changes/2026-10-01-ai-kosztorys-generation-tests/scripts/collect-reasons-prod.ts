// Step 1 of the knowledge flow: every Powód zmiany the owner wrote on the investments at „Etap AI:
// Recenzja zakończona”, as one markdown list to discuss. Read-only. `INVESTMENTS` overrides the list.
// A Powód already decided in knowledge-ledger.json is left out: a later round sets the stage back, and
// the owner's Powody stay on their pozycje, so without the ledger every lifted one comes back.
//   TOKEN_FILE=… [INVESTMENTS=188,189] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/collect-reasons-prod.ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { api, itemsOf, norm } from './prod-client'

type LedgerEntryT = {
  investment: number
  item: number
  reason: string
  decision: 'lifted' | 'skipped'
  note: string
  date: string
}

const ledgerKey = (item: number, reason: string) => `${item}\t${norm(reason)}`

function decidedReasons() {
  const file = path.join(import.meta.dirname, '../knowledge-ledger.json')
  const ledger: LedgerEntryT[] = JSON.parse(readFileSync(file, 'utf8'))
  return new Set(ledger.map((entry) => ledgerKey(entry.item, entry.reason)))
}

async function reviewedInvestmentIds() {
  const { docs } = await api<{ docs: { id: number }[] }>(
    '/investments?where[aiStage][equals]=review_done&depth=0&pagination=false',
  )
  return docs.map((doc) => doc.id)
}

async function run() {
  const given = (process.env.INVESTMENTS ?? '').split(',').map(Number).filter(Boolean)
  const ids = given.length ? given : await reviewedInvestmentIds()
  if (!ids.length) {
    console.log('Żadna inwestycja nie ma etapu „Recenzja zakończona”.')
    return
  }
  const decided = decidedReasons()

  for (const id of ids) {
    const investment = await api<{ name: string }>(`/investments/${id}?depth=0`)
    const withReason = (await itemsOf(id)).filter((item) => item.changeReason?.trim())
    const items = withReason
      .filter((item) => !decided.has(ledgerKey(item.id, item.changeReason ?? '')))
      .sort(
        (a, b) =>
          a.section.displayOrder - b.section.displayOrder || a.displayOrder - b.displayOrder,
      )
    const skipped = withReason.length - items.length

    console.log(
      `\n## #${id} ${investment.name.trim()} — ${items.length} powodów` +
        `${skipped ? ` (+${skipped} już w knowledge-ledger.json)` : ''}\n`,
    )
    for (const item of items) {
      const katalog = item.catalogueItemId ? `katalog ${item.catalogueItemId}` : 'spoza katalogu'
      console.log(
        `- [${item.reviewStatus ?? '—'}] #${item.id} ${item.section.name.trim()} / ${item.description?.trim()} ` +
          `| AI ${item.aiPlannedQty ?? 0} → ${item.plannedQty} ${item.unit ?? ''} | ${katalog}\n` +
          `  POWÓD: ${item.changeReason?.trim()}`,
      )
    }
  }
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
