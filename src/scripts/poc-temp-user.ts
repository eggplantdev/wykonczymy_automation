// One-off: tymczasowy OWNER do weryfikacji POC w przeglądarce. TYLKO wykonczymy-poc.
// Uruchom: node --env-file=.env --import tsx src/scripts/poc-temp-user.ts
import { getPayload } from 'payload'
import config from '../payload.config'

const EMAIL = 'poc@local.test'
const PASSWORD = 'poc12345'

async function run() {
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL } },
    limit: 1,
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'users',
      id: existing.docs[0].id,
      data: { password: PASSWORD, role: 'OWNER', active: true },
      context: { skipRevalidation: true },
    })
    console.log(`Updated temp OWNER: ${EMAIL} / ${PASSWORD}`)
  } else {
    await payload.create({
      collection: 'users',
      data: { email: EMAIL, password: PASSWORD, name: 'POC Owner', role: 'OWNER', active: true },
      context: { skipRevalidation: true },
    })
    console.log(`Created temp OWNER: ${EMAIL} / ${PASSWORD}`)
  }
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
