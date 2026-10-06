# Worker expense AI prefill (EX-1001) — Plan Brief

> Full plan: `context/changes/2026-10-06-worker-expense-ai-prefill/plan.md`
> Research: `context/changes/2026-10-06-worker-expense-ai-prefill/research.md`

## What & Why

EX-971 promised that the manager's „Nowy wydatek" opens filled with what the AI read from the
worker's receipt. It never did: the dialog opens blank, and no button reads the photos already on
the row. Now the AI reads when the worker sends, without making them wait, and the manager opens a
prefilled expense. A button re-reads the photos when that read failed.

## Starting Point

The worker's send stores the photos and the note only. The manager's dialog hangs every page on
one blank row. The AI receipt core already takes bytes; only a browser-`File` wrapper sits in
front of it. Draft lists are uncached. An uncommitted on-open `useEffect` stopgap sits in
`expense-form.tsx`.

## Desired End State

A worker sends 1–8 photos and, from 2 photos on, picks „Jeden wydatek" (the default) or „Kilka
wydatków". The send returns at once and the AI reads in `after()`. „Zobacz" opens one filled row,
or one filled row per photo, with AI file names. A row the AI did not read opens blank, next to an
„Odczytaj dodane zdjęcia" button.

## Key Decisions Made

| Decision            | Choice                                             | Why                                                            | Source   |
| ------------------- | -------------------------------------------------- | -------------------------------------------------------------- | -------- |
| When AI runs        | At the worker's send, in `after()`                 | The worker never waits; an AI failure is the manager's problem | Research |
| Unreadable receipt  | Row opens blank                                    | The re-read button then offers itself                          | Research |
| Page cap            | 8 (= `MAX_RECEIPT_PAGES`)                          | A draft is always readable in one call                         | Research |
| One vs many         | Both; the worker picks, as the manager's form does | A batch of receipts and a multi-page invoice are both real     | Research |
| Mode UI             | From 2 photos on, default „Jeden wydatek"          | Meaningless for one photo; matches today's one-row prefill     | Plan     |
| Mode edit           | Allowed in „Edytuj"; a change re-reads             | The same path as adding or removing a page                     | Plan     |
| Manager list status | No indicator                                       | The button covers „not finished" and „failed"                  | Plan     |
| Storage             | `ai_read jsonb` + `scan_mode`                      | A variable-length snapshot, written and read whole             | Research |
| Bytes               | Direct public Blob URL (shared helper)             | No extra request; the URL is derivable                         | Research |
| Staleness           | Clear on every change + compare-and-set write      | A late answer loses; nothing to check at read time             | Plan     |
| Retry model         | Unchanged                                          | Out of scope                                                   | Research |

## Scope

**In scope:** migration, guarded read in `after()` from send / add / remove / mode change, page cap
8, the worker's mode toggle (pl / uk / ru), prefill from the read, the re-read button, removing the
stopgap, specs, docs (test-plan risk #24, outgoing effects, manual checks).

**Out of scope:** a list indicator, a model change, splitting or merging rows, AI category, an
OpenRouter gate, live dialog refresh, E2E (folded into EX-997).

## Architecture / Approach

`after(readExpenseDraftReceipts)` loads the pages and the mode, fetches the bytes from public Blob,
calls `scanReceiptPages` (split out of `scanReceipt`) once or per page, and saves with
`UPDATE … WHERE pending AND same mode AND same ordered pages`. The page and mode statements set
`ai_read = NULL` in the same SQL. `handleOpen` → a pure `buildDraftPrefill(draft, files, category)`.

## Phases at a Glance

| Phase                               | What it delivers                                            | Key risk                                                      |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| 1. Schema and server-side read      | `ai_read` filled in `after()`, guarded against stale writes | Write guard wrong → a stale read prefills removed photos      |
| 2. Worker chooses the mode          | Toggle in send / edit, translated                           | 390px layout of the worker dialog                             |
| 3. Manager prefill + re-read button | Filled rows on „Zobacz", button, stopgap gone               | Positional `files` map misaligned with rows in per-photo mode |

**Prerequisites:** local + `db-test` migrated; prod re-count of drafts above 8 pages before push;
prod migrate before push (human).
**Estimated effort:** ~1–2 sessions, 3 phases.

## Open Risks & Assumptions

- The EX-971 specs these build on were never run green at its gate.
- Every environment makes real, billed reads on a worker's send (deliberately ungated).
- Locally, a photo newer than the last preview-store restore 404s, the read fails, and the row
  opens blank — expected, not a bug.

## Success Criteria (Summary)

- The manager opens a worker's zgłoszenie and finds Opis, kwota and netto already filled, without
  clicking anything.
- A failed or unfinished read is one click away from being redone.
- Removing a photo never leaves its figures in the prefill.
