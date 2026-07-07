// LOCAL backfill of historical FB Lead Ads submissions into the `leads` collection.
//
// WHY THIS EXISTS: the webhook only captures NEW leads. Everything already submitted
// lives in the gitignored dump at `.local/fb-leads/fb_leads_dataset.json` (real PII —
// never committed). This script runs each historical lead through the same
// normalizeLead + storeLead path the webhook uses, so /zgloszenia shows real rows
// locally. Idempotent on (source, externalId) → safe to re-run.
//
// RUN: pnpm backfill:leads
//   (node --env-file=.env --import tsx src/scripts/backfill-leads.ts)
//
// SAFETY: local DB only. Refuses to run if DB_POSTGRES_URL points at Neon/prod.
// Reads PII from the gitignored dump — no personal data is hardcoded here.
import { readFileSync, existsSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizeLead } from '@/lib/leads/normalize-lead'
import { storeLead } from '@/lib/leads/store-lead'
import { toLeadFormQuestions, type LeadFieldT } from '@/lib/leads/lead-schema'

const DUMP_PATH = '.local/fb-leads/fb_leads_dataset.json'

type DumpFormT = {
  id: string
  name?: string
  questions?: { key: string; type?: string; label?: string }[]
}
type DumpLeadT = { id: string; created_time: string; field_data: LeadFieldT[] }
type DumpT = { forms: DumpFormT[]; leads_by_form: Record<string, DumpLeadT[]> }

function assertLocalDb(): void {
  const url = process.env.DB_POSTGRES_URL ?? ''
  const prod = process.env.DB_POSTGRES_URL_PROD ?? ''
  if (!url) throw new Error('DB_POSTGRES_URL is not set — cannot verify the target is local.')
  if (/neon\.tech/i.test(url) || (prod !== '' && url === prod)) {
    throw new Error(
      'Refusing to run: DB_POSTGRES_URL looks like prod/Neon. Backfill is local-only.',
    )
  }
}

async function main(): Promise<void> {
  assertLocalDb()
  if (!existsSync(DUMP_PATH)) {
    throw new Error(
      `Dump not found at ${DUMP_PATH} — see docs/facebook-leads-setup.md (Backfilling).`,
    )
  }

  const dump = JSON.parse(readFileSync(DUMP_PATH, 'utf8')) as DumpT
  const formById = new Map(dump.forms.map((form) => [form.id, form]))
  const payload = await getPayload({ config })

  let created = 0
  let skipped = 0
  let total = 0

  for (const [formId, leads] of Object.entries(dump.leads_by_form)) {
    const form = formById.get(formId)
    console.log(`[backfill-leads] form ${formId} "${form?.name ?? '?'}" — ${leads.length} leads`)
    const formQuestions = toLeadFormQuestions(form?.questions)

    for (const lead of leads) {
      total += 1
      const normalized = normalizeLead(lead.field_data, form?.questions)
      const { lead: stored, created: wasCreated } = await storeLead(
        payload,
        {
          source: 'facebook_lead_ads',
          externalId: lead.id,
          email: normalized.email,
          name: normalized.name,
          phone: normalized.phone,
          rawData: normalized.rawData,
          formQuestions,
          formId,
          formName: form?.name,
          submittedAt: lead.created_time,
          isTest: normalized.isTest,
        },
        { skipRevalidation: true },
      )
      if (wasCreated) {
        created += 1
      } else {
        skipped += 1
        // storeLead leaves existing rows untouched; enrich them with formQuestions
        // so a re-run backfills the map onto leads captured before this field existed.
        if (formQuestions.length) {
          await payload.update({
            collection: 'leads',
            id: stored.id,
            data: { formQuestions },
            overrideAccess: true,
            context: { skipRevalidation: true },
          })
        }
      }
    }
  }

  console.log(
    `[backfill-leads] done — ${total} processed, ${created} created, ${skipped} already present`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfill-leads]', err)
    process.exit(1)
  })
