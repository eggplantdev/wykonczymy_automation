import { describe, it, expect, vi } from 'vitest'
import { Leads } from '@/collections/leads'
import { ERASED_LEAD_FIELDS } from '@/lib/leads/erase-lead'

vi.mock('server-only', () => ({}))

// What a tombstone may keep: the dedup key the reconcile cron reads, and bookkeeping that names
// nobody. Anything else on a lead is erased — a new field fails here until someone decides which.
const KEPT_FIELDS = [
  'source',
  'externalId',
  'investment',
  'formId',
  'formName',
  'submittedAt',
  'contactStatus',
  'notifyStatus',
  'autoReplyStatus',
  'trashedAt',
  'erasedAt',
]

describe('eraseTrashedLead — the tombstone', () => {
  it('erases every lead field it does not deliberately keep', () => {
    const fieldNames = Leads.fields.flatMap((field) => ('name' in field ? [field.name] : []))

    expect([...KEPT_FIELDS, ...Object.keys(ERASED_LEAD_FIELDS)].sort()).toEqual(fieldNames.sort())
  })
})
