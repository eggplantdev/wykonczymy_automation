// Attaches every file in FILES_DIR to a LOCAL investment. Kind: a file named rzut* is a `projekt`
// even as an image (a plan photographed or screenshotted), any other image a `zdjecie`, the rest a
// `projekt`. Restart dev afterwards — the hooks are skipped, so nothing revalidates.
//   INV=… FILES_DIR=… node --env-file=.env --conditions=react-server --import tsx \
//     context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/attach-files-local.ts
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { assertLocalDb } from '@/scripts/assert-local-db'

const INVESTMENT_ID = Number(process.env.INV)
const FILES_DIR = process.env.FILES_DIR ?? ''
const OWNER_ID = 16
if (!INVESTMENT_ID || !FILES_DIR) throw new Error('Set INV=<local investment id> and FILES_DIR')
assertLocalDb('attach-files-local')

function kindOf(name: string): 'projekt' | 'zdjecie' {
  if (/^rzut/i.test(name)) return 'projekt'
  return /\.(jpe?g|png|webp|heic)$/i.test(name) ? 'zdjecie' : 'projekt'
}

async function run() {
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: OWNER_ID })
  const investment = await payload.findByID({
    collection: 'investments',
    id: INVESTMENT_ID,
    depth: 0,
  })

  const assets = [...((investment.assets ?? []) as number[])]
  for (const name of readdirSync(FILES_DIR)
    .filter((f) => !f.startsWith('.'))
    .sort()) {
    const media = await payload.create({
      collection: 'media',
      data: { kind: kindOf(name), alt: path.parse(name).name },
      filePath: path.join(FILES_DIR, name),
      user,
      context: { skipRevalidation: true },
    })
    assets.push(Number(media.id))
    console.log(`media #${media.id} ${kindOf(name)} ${media.filename}`)
  }
  await payload.update({
    collection: 'investments',
    id: INVESTMENT_ID,
    data: { assets },
    user,
    context: { skipRevalidation: true },
  })
  console.log(`#${INVESTMENT_ID}: ${assets.length} assets`)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
