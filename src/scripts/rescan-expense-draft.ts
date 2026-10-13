// Sends a worker's zgłoszenie wydatku again as a new pending one over the same photos, read paragon
// by paragon, and leaves the original pending beside it for comparison — #13 summed 13 Leroy Merlin
// paragony into one 1058.05 zł row. Reject one of the two by hand: accepting both books them twice.
//
//   DRAFT=13 node --env-file=.env --conditions=react-server --import tsx src/scripts/rescan-expense-draft.ts
//
// Production, once migration 20261012_1 is applied there:
//
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" DRAFT=13 node --env-file=.env --conditions=react-server \
//     --import tsx src/scripts/rescan-expense-draft.ts
//
// The pages are always read from the production Blob store: the local DB is a prod dump, and the
// preview store lacks every photo newer than its last restore. A second run refuses while a copy of
// the same zgłoszenie is still pending.
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { readExpenseDraftReceipts } from '@/lib/actions/read-expense-draft-receipts'
import { getDb } from '@/lib/db/get-db'
import { insertWorkerExpenseDraft } from '@/lib/db/worker-expense-drafts'
import { PROD_BLOB_STORE_ID } from '@/lib/env/schema'

const SOURCE_DRAFT_ID = Number(process.env.DRAFT)
if (!SOURCE_DRAFT_ID) throw new Error('Set DRAFT=<zgłoszenie id>')

const NOTE = `Ponowny odczyt zgłoszenia #${SOURCE_DRAFT_ID}, paragon po paragonie`

const sumAmounts = (rows: { amount?: number }[]) =>
  rows.reduce((total, row) => total + (row.amount ?? 0), 0).toFixed(2)

async function run() {
  const db = await getDb(await getPayload({ config }))
  const sourceRes = await db.execute(sql`
    SELECT d.worker_id, d.investment_id, d.cash_register_id, d.ai_read,
      ARRAY(
        SELECT dm.media_id FROM worker_expense_draft_media dm
        WHERE dm.draft_id = d.id ORDER BY dm.position
      ) AS media_ids,
      EXISTS (
        SELECT 1 FROM worker_expense_drafts copy WHERE copy.note = ${NOTE} AND copy.status = 'pending'
      ) AS has_pending_copy
    FROM worker_expense_drafts d WHERE d.id = ${SOURCE_DRAFT_ID}
  `)
  const source = sourceRes.rows[0]
  if (!source) throw new Error(`No zgłoszenie #${SOURCE_DRAFT_ID}`)
  if (source.has_pending_copy) throw new Error(`A copy of #${SOURCE_DRAFT_ID} is already pending`)

  const draftId = await insertWorkerExpenseDraft(db, {
    workerId: Number(source.worker_id),
    investmentId: source.investment_id == null ? null : Number(source.investment_id),
    cashRegisterId: Number(source.cash_register_id),
    note: NOTE,
    mediaIds: (source.media_ids as number[]).map(Number),
  })
  if (draftId === null) throw new Error('Insert refused: a page is not media the worker uploaded')
  console.log(`#${SOURCE_DRAFT_ID} → new pending zgłoszenie #${draftId}`)

  const read = await readExpenseDraftReceipts(db, draftId, PROD_BLOB_STORE_ID)
  if (!read) throw new Error(`#${draftId} is stored, but its read failed — „Zobacz" retries it`)
  for (const row of read.rows) {
    console.log(
      `  photo ${row.mediaIds.join(',')} | ${row.documentDate ?? '—'} | ${row.documentNumber ?? '—'} | ${row.amount ?? '—'} zł | ${row.description ?? '(no answer)'}`,
    )
  }
  const sourceRows = (source.ai_read as { rows?: { amount?: number }[] } | null)?.rows ?? []
  console.log(
    `#${SOURCE_DRAFT_ID}: ${sourceRows.length} row(s), ${sumAmounts(sourceRows)} zł | #${draftId}: ${read.rows.length} row(s), ${sumAmounts(read.rows)} zł`,
  )
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
