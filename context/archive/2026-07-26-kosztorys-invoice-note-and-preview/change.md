---
change_id: kosztorys-invoice-note-and-preview
title: Notatka column and per-row invoice preview in the kosztorys Wydatki list
status: archived
linear: EX-585
created: 2026-07-26
updated: 2026-07-26
archived_at: 2026-07-26T13:19:30Z
branch: feat/ex-569-kosztorys-client-invoices
worktree: .claude/worktrees/ex-569-invoice-note
---

## Notes

Extends EX-569's Wydatki list (`materials-transactions-table.tsx`) with a „Notatka" column and a
per-row invoice preview — the two things the bulk-ZIP slice deliberately left out.

### Why

The AI receipt scan's extracted invoice data lands in exactly one place — `transactions.invoiceNote`:
**line 1 = numer faktury, then each pozycja, newline-separated**. The note was already surfaced on
every other transfer surface (CSV „Notatka", the Google tab), but not in the kosztorys Wydatki list.

The „Notatka" cell shows **line 1 only** (`firstNoteLine`, `src/lib/utils/invoice-note.ts`); the
pozycje below it live solely in the tooltip. Not a blind one-line flatten: line 1 is what a client
uses to match a row to a paper faktura, and the virtualized row can't carry the rest anyway.

> **Superseded (c1cd4e11 and later):** `InvoicePreviewButton` is now `MediaPreviewButton`
> (`src/components/dialogs/media-preview-button`), `invoiceMimeType` became an `invoices` array
> (multi-page invoices), `HintTooltip` is `SimpleTooltip`, and `MaterialTransactionRowT` lives in
> `src/types/transfers.ts`.

### Owner rulings (2026-07-26)

- **Reverses EX-569's "bulk ZIP only, no per-row preview".** That decision was scoped to avoid
  pulling in `InvoiceCell`, which also owns upload + delete; the preview button is the read-only pair.
- **Client exposure needs no new gate.** The note is per-pozycja supplier prices in text — but the
  attached PDF _is_ the supplier invoice, so the ZIP and the preview already leak strictly more.
  Raised again at the review gate because `invoiceNote` is a hand-editable textarea that could carry
  internal staff remarks on the unauthenticated `/k/<token>` share view — **owner: accept, the note
  is client-safe.**
- **Hover-only overlay, accepted.** A popover was offered and declined, so the pozycje under line 1
  are unreachable on a phone — and the client share view is the surface most likely to be opened on
  one. The numer faktury alone is what a client matches against paper. Recorded so the touch gap is
  not rediscovered as a bug.
