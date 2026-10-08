// Attaches the client's plan to the LOCAL investment, mirroring the photo on production.
//   INV=180 node --env-file=.env --conditions=react-server --import tsx context/changes/2026-10-01-ai-kosztorys-generation-tests/cases/02-oliwa/scripts/attach-plan.ts
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { assertLocalDb } from '@/scripts/assert-local-db'

const INVESTMENT_ID = Number(process.env.INV)
const PLAN = path.join(import.meta.dirname, '../inputs/rzut.png')
const OWNER_ID = 16
if (!INVESTMENT_ID) throw new Error('Set INV=<local investment id>')
assertLocalDb('attach-plan')

async function run() {
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: OWNER_ID })
  const investment = await payload.findByID({
    collection: 'investments',
    id: INVESTMENT_ID,
    depth: 0,
  })

  const media = await payload.create({
    collection: 'media',
    data: { kind: 'zdjecie', alt: 'rzut' },
    filePath: PLAN,
    user,
    context: { skipRevalidation: true },
  })
  const assets = [...((investment.assets ?? []) as number[]), Number(media.id)]
  await payload.update({
    collection: 'investments',
    id: INVESTMENT_ID,
    data: { assets },
    user,
    context: { skipRevalidation: true },
  })
  console.log(`#${INVESTMENT_ID}: media #${media.id} ${media.filename} → ${media.url}`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
