// Step 1 of the knowledge flow: every Powód zmiany the owner wrote on the investments at „Etap AI:
// Recenzja zakończona”, as one markdown list to discuss. Read-only. `INVESTMENTS` overrides the list.
//   TOKEN_FILE=… [INVESTMENTS=188,189] \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/collect-reasons-prod.ts
import { api, itemsOf } from './prod-client'

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

  for (const id of ids) {
    const investment = await api<{ name: string }>(`/investments/${id}?depth=0`)
    const items = (await itemsOf(id))
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
