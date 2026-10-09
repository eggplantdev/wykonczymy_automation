// Adds the sekcje a draft needs beyond the szablon (load-ai-draft skips a row whose sekcja is missing)
// and appends the agent's notes appendix to the investment's notes. LOCAL DB only.
//   INV=<id> [SECTIONS="A|B"] [NOTES_FILE=<path>] node --env-file=.env --conditions=react-server --import tsx \
//     context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/prepare-case-local.ts
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { assertLocalDb } from '@/scripts/assert-local-db'

const INVESTMENT_ID = Number(process.env.INV)
if (!INVESTMENT_ID) throw new Error('Set INV=<local investment id>')
assertLocalDb('prepare-case-local')

async function run() {
  const payload = await getPayload({ config })
  const wanted = (process.env.SECTIONS ?? '').split('|').filter(Boolean)
  if (wanted.length) {
    const { docs } = await payload.find({
      collection: 'kosztorys-sections',
      where: { investment: { equals: INVESTMENT_ID } },
      limit: 500,
      pagination: false,
    })
    let order = Math.max(0, ...docs.map((s) => s.displayOrder))
    for (const name of wanted) {
      if (docs.some((s) => s.name === name)) continue
      await payload.create({
        collection: 'kosztorys-sections',
        data: { investment: INVESTMENT_ID, name, displayOrder: ++order },
        context: { skipRevalidation: true },
      })
      console.log(`sekcja: ${name}`)
    }
  }
  if (process.env.NOTES_FILE) {
    const appendix = readFileSync(process.env.NOTES_FILE, 'utf8').trim()
    const investment = await payload.findByID({ collection: 'investments', id: INVESTMENT_ID })
    if (!(investment.notes ?? '').includes(appendix.split('\n')[0])) {
      await payload.update({
        collection: 'investments',
        id: INVESTMENT_ID,
        data: { notes: `${investment.notes ?? ''}\n\n${appendix}` },
        context: { skipRevalidation: true },
      })
      console.log('notatki dopisane')
    }
  }
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
