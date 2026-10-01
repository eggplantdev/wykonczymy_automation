import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '/Users/konradantonik/workspace/yolo/wykonczymy/src/payload.config'
import { createInvestment } from '/Users/konradantonik/workspace/yolo/wykonczymy/src/lib/investments/create-investment'

const DIR = '/Users/konradantonik/Downloads/Pliki dla wyceny wykończenia mieszkania 2'
const FILES: { name: string; kind: 'projekt' | 'inne' }[] = [
  { name: '1_Projekt_mieszkania_dokumentacja_techniczna.pdf', kind: 'projekt' },
  { name: '2_RYS.6_-_ELEKTRYKA.pdf', kind: 'projekt' },
  { name: '3_RYS_7_-_OŚWIETLENIE.pdf', kind: 'projekt' },
  { name: '4_Modyfikacje_Ethernet.pdf', kind: 'projekt' },
  { name: '5_Lista_zakupowa_plytki_okładziny_armatura.pdf', kind: 'inne' },
]
const PRESET_ID = 165
const OWNER_ID = 16

async function run() {
  const payload = await getPayload({ config })
  const user = await payload.findByID({ collection: 'users', id: OWNER_ID })

  const assetIds: number[] = []
  for (const file of FILES) {
    const media = await payload.create({
      collection: 'media',
      data: { kind: file.kind, alt: file.name.replace(/\.pdf$/, '') },
      filePath: path.join(DIR, file.name),
      user,
    })
    assetIds.push(Number(media.id))
    console.log(`media #${media.id} ${media.filename} → ${media.url}`)
  }

  const notes = readFileSync(path.join(import.meta.dirname, 'notes.txt'), 'utf8').trim()
  const result = await createInvestment(payload, {
    name: '[klientka]',
    address: 'Warszawa, Bemowo',
    phone: '[telefon]',
    email: '[e-mail]',
    contactPerson: '[klientka]',
    notes,
    review: '',
    status: 'planowana',
    presetId: String(PRESET_ID),
    assets: assetIds,
  })
  console.log('investment', result)
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
