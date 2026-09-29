---
change_id: kosztorys-importer
title: Pull kosztorys data from the linked Google Sheet into the editor
status: archived
created: 2026-08-11
updated: 2026-08-14
archived_at: 2026-08-14T16:40:00Z
branch: konradantonik/ex-417-kosztorys-importer
worktree: ../wykonczymy-worktrees/kosztorys-importer
---

## Notes

Roadmap slice **S-15** (`kosztorys-importer`, band 3). Its blocking open question — PRD Q8 /
roadmap open question 7, "what concretely triggers this importer" — is **answered**: a button in the
editor's "Opcje" menu, invoked per investment on demand. Not a one-shot migration.

### Shaped with the owner (2026-08-11)

**Direction and scope.** Sheet → app only. Imports **rabat, robocizna (stawki), etapy** and the item
tree. Deliberately untouched: settlement mode, materials net rate, global discount, VAT, the global
coefficients, per-etap worker (EX-613), stage labels, section colors, notes — none of that exists in
any sheet, so it stays hand-entered per investment.

> **Superseded (06bf1b04):** the stage settlement plane is now chosen once in the import dialog.

**Authority.** The `kosztorys_robocizny` tab is the item tree's source of truth (owner's ruling).
Rates come from **both** `zakres pracy` tabs, one tab chosen per row.

> **Superseded:** cenniki that disagree are no longer auto-resolved — the praca imports with a blank
> stawka and the conflict is listed for the owner (`resolve-rates.ts`). `Pomiar z natury` is no longer
> ignored: it is read and refreshed by „Porównaj z arkuszem" (`2026-08-13-sheet-live-compare`).

**Column resolution.** Never by offset; columns are found by label (the header-block traps are
documented in `src/lib/kosztorys/sheet-import/columns.ts` / `resolve-columns.ts`). Validated against
all 45 real sheets in the DB: "Przedmiar" lives in six different columns (I…N), stage counts run
3–10, and stage headers get renamed to crew names — so stage columns are located by row 2 ==
"wykonano", not by their label. 43/45 resolve; the 2 that don't (Dąbrowskiego 86, Ryżowa 66/127)
need one header cell fixed by the owner.

**Safety.** Preview → confirm → apply, with a shared plan builder so the two can't disagree; apply
re-derives server-side and never trusts the client payload. Automatic named snapshot before apply.

> **Superseded:** items missing from the sheet are no longer kept — „Zastąp" drops them after listing
> them in the preview (`build-import-plan.ts`, `DroppedItemT`).

**Identity key:** (section name, item description, nth occurrence) — not row number. Validated on
Białostocka: 324/324 matched by description alone.

**Role gate (owner ruling, review gate):** the import stays on `MANAGEMENT_ROLES`, not OWNER/ADMIN.
Every other kosztorys mutation — including `restoreSnapshotAction`, which replaces the whole tree the
same way — sits there, so narrowing protected nothing and hid the feature from the role that runs
sites day to day.

### Local rehearsal → prod strategy (decided 2026-08-11)

Rejected: a fourth database. The local dev DB on 5433 is already the staging ground, and crucially
it is restored from prod dumps, so **investment ids match prod** — an empty DB would have no
investments to attach to.

The durable artifact is **files**: one parsed JSON payload per investment, replayable into the DB
without touching Google. That survives `db:import` (which overwrites local with prod), makes sheet
edits visible as a diff between two reads, and doubles as the dev seed corpus.

**Prod does not receive migrated rows** — an OWNER clicks the same button on prod, which reads the
sheet itself. The local pass is a rehearsal whose output is a **list of corrections**, not data.

Where a correction lives (this was the crux):

- **In the sheet** — wrong header, typo, rate typed in only one tab. Travels for free and stays true.
  Expected to cover almost everything.
- **In the parser** — misresolved column or rate. Fix the code; the button ships the same code.
- **In app-only fields** — the out-of-scope list above. Safe, because sync never overwrites them.
- **Nowhere else.** A hand correction to a _synced_ field is silently clobbered by the next sync, so
  "correct locally, seed prod" is a trap, not a safety net — regardless of which DB it lives in.
  Contingency only: a committed exception file (investment id + row + value + why) applied after the
  sheet read. Deliberately ugly, visible in review, built only if the rehearsal proves it necessary.

**Quality gate:** each sheet carries its own footer totals (`wartość netto`, `R netto - suma prac
wykonannych`). Comparing the app's computed total against the sheet's own number, for all 45,
is automatic proof the parse is right — it depends on every price, rabat and quantity individually.
Located by label, since the footer row position varies per sheet.

### Sheets we can read (owner-shared, growing list)

All shared read-only with the service account in `GOOGLE_SERVICE_ACCOUNT_JSON`; tab
`kosztorys_robocizny`, `gid=70964819` on each. Dump one with:

```bash
SHEET_ID=<id> TABS="kosztorys_robocizny" MAX_ROWS=6 node --env-file=./.env scripts/inspect-sheet.mjs
```

| #   | Sheet id                                       | Etapy    | Przedmiar | What it proves                                                                                                                                                                  |
| --- | ---------------------------------------------- | -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `1EgNFob2baPlKUMTSQlfbzc2HJI5zmITPZUQsJbkomz4` | 10 (D–M) | N         | The wide baseline. Both footer rows present; `S = Pomiar × cena − rabat` with `O = N`, so „wartość netto" is the **offered** total here.                                        |
| 2   | `15zV_w5Z2EmGZCkWvm1wzXJgmGVAO0_V98-wufGF3Tn4` | 6 (D–I)  | **J**     | Narrow layout **and** stages renamed to crews in row 3 („1 etap PAWEL AES", „3 etap EKIPA MYKOLA"). The case that kills label-based stage detection.                            |
| 3   | `1ma2HMdjK8GirBNJeLJKy4l5ADJSI5Z20Ru1gsx3pBJM` | 10 (D–M) | N         | Wide like #1, but the wartość block starts at **V**, not U, with „komentarz" at U — a blank column between „Wartość netto" and the money block. Kills any adjacency assumption. |
