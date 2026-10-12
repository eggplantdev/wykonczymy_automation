// Step 1 of the knowledge flow: every Powód zmiany the owner wrote on the given investments, as one
// markdown list to discuss. Read-only.
//   TOKEN_FILE=… INVESTMENTS=188,189 \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/collect-reasons-prod.ts
import { api, itemsOf, type ItemT } from './prod-client'

type ReviewedItemT = ItemT & {
  aiPlannedQty: number | null
  changeReason: string | null
  reviewStatus: string | null
  catalogueItemId: number | null
}

async function run() {
  const ids = (process.env.INVESTMENTS ?? '').split(',').map(Number).filter(Boolean)
  if (!ids.length) throw new Error('INVESTMENTS is required, e.g. INVESTMENTS=188,189')

  for (const id of ids) {
    const investment = await api<{ name: string }>(`/investments/${id}?depth=0`)
    const items = ((await itemsOf(id)) as ReviewedItemT[])
      .filter((item) => item.changeReason?.trim())
      .sort(
        (a, b) =>
          a.section.displayOrder - b.section.displayOrder || a.displayOrder - b.displayOrder,
      )

    console.log(`\n## #${id} ${investment.name.trim()} — ${items.length} powodów\n`)
    for (const item of items) {
      const katalog = item.catalogueItemId ? `katalog ${item.catalogueItemId}` : 'spoza katalogu'
      console.log(
        `- [${item.reviewStatus ?? '—'}] ${item.section.name.trim()} / ${item.description?.trim()} ` +
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
