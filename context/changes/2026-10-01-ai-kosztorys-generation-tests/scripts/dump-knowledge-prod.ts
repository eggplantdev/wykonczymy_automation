// Re-run before each case — the book changes in the app, not here.
//   TOKEN_FILE=… CASE=02-<slug> \
//     node --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/dump-knowledge-prod.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { api } from './prod-client'

type KnowledgeT = { topic: string; content: string }
type CatalogueItemT = { description: string; unit: string | null; workNote: string | null }

async function run() {
  const caseId = process.env.CASE
  if (!caseId) throw new Error('CASE is required, e.g. CASE=02-mokotow-60m2')
  const inputsDir = path.join(import.meta.dirname, '../cases', caseId, 'inputs')

  const [knowledge, catalogue] = await Promise.all([
    api<{ docs: KnowledgeT[] }>('/company-knowledge?limit=0&sort=displayOrder,id&depth=0'),
    api<{ docs: CatalogueItemT[] }>(
      '/work-catalogue-items?where[workNote][exists]=true&limit=0&depth=0&sort=description',
    ),
  ])
  // `exists` also matches a note cleared to an empty string.
  const notes = catalogue.docs.filter((item) => item.workNote?.trim())

  const lines = [
    '# Wiedza firmowa',
    '',
    ...knowledge.docs.flatMap((entry) => [`### ${entry.topic}`, '', entry.content.trim(), '']),
    '# Komentarze do prac z katalogu',
    '',
    ...notes.flatMap((item) => [
      `### ${item.description}${item.unit ? ` [${item.unit}]` : ''}`,
      '',
      item.workNote?.trim() ?? '',
      '',
    ]),
  ]

  mkdirSync(inputsDir, { recursive: true })
  const file = path.join(inputsDir, 'wiedza-firmowa.md')
  writeFileSync(file, lines.join('\n'))
  console.log(`${knowledge.docs.length} wpisów, ${notes.length} komentarzy → ${file}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
