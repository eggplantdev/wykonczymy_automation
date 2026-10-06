---
change_id: worker-expense-ai-prefill
title: AI reads a worker's expense photos on send; manager gets a prefilled wydatek + a re-read button (EX-1001)
status: implemented
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: worker-expense-ai-prefill
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/worker-expense-ai-prefill
---

## Notes

Linear: **EX-1001**, follow-up to **EX-971** (`context/archive/2026-10-05-worker-expenses/`).

### The gap

EX-971's owner decision says the manager's „Nowy wydatek" dialog opens filled with „tym, co AI
odczyta z paragonu". It never did: `PendingExpenseDrafts.handleOpen` prefills inwestycja, kasa and
the photos only, and „Wygeneruj z paragonów" (`line-items-field.tsx`) opens a file picker for NEW
photos — nothing reads photos already on a row. (The empty-pick branch in `scanReceipts` that
should re-run generation is unreachable: a cancelled picker fires `cancel`, not `change`.)

A stopgap landed this session, uncommitted: a mount `useEffect` in `expense-form.tsx` that runs
`generateFromReceipts` once when `prefill` is set, plus its spec in
`src/__tests__/components/forms/expense-form/expense-form-prefill.test.tsx`. This change replaces
the effect.

### Decided with the owner (2026-10-06)

1. **AI reads at the worker's send, in `after()`.** The worker never waits on the AI and may
   navigate away — `after()` keeps the function alive past the response on Vercel. Precedent:
   `after(() => translateReportExtras(...))` in `worker-report.ts`.
2. **Send succeeds = photos + note stored.** An AI failure is the manager's problem, never the
   worker's — the draft is simply left unread.
3. **The read is stored on the draft** and prefills the manager's dialog.
4. **„Odczytaj dodane zdjęcia" button** in the expense form re-reads photos already attached to a
   still-blank row — covers a failed read and opening before the read finished.
5. **One change for both** (owner, 2026-10-06).

### Known seams for the plan

- Hand-written additive migration on `worker_expense_drafts` → prod migrate BEFORE push.
- Server-side read takes the stored Blob pages, not browser `File`s — `scanReceipt` takes `File[]`
  today. No request body involved, so the 4.5 MB `/api/extract-receipt` cap does not apply.
- `addExpenseDraftPagesAction` / `removeExpenseDraftPageAction` change the photos → the stored read
  is stale; clear it and re-read in `after()`.
- The AI filename: today the client renames the file before upload; on accept the pages are
  downloaded and re-uploaded, so the stored filename can be applied there.
- `after()` runs where the response is gone → `revalidateTag(…, EXPIRE_NOW)`, not `updateTag`, if
  the manager's pending list is cached.
