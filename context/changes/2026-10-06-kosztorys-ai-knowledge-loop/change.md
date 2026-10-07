---
change_id: kosztorys-ai-knowledge-loop
title: Capture house knowledge for the kosztorys agent — katalog notes, AI przedmiar review, filters
status: planned
created: 2026-10-06
updated: 2026-10-07
archived_at: null
branch: null
worktree: null
---

## Notes

Origin: `context/changes/2026-10-01-ai-kosztorys-generation-tests/` (case 1 vs the owner's #175).
The agent measures well but loses money on trade knowledge and position choice — knowledge that lives
only in employees' heads. This change gives them a way to write it down, and the agent a way to read it.

Design agreed 2026-10-06 — still brainstorming; a spike validates it before `/10x-plan`:

**1. Notatka do pracy (house knowledge)**

- One note per katalog prac entry (`work_catalogue_items`), written by people only — nothing is
  seeded or generated. Fields start empty.
- Editable in /katalog-prac and from any kosztorys, szablon included. A save from a kosztorys always
  updates the katalog entry, so every kosztorys and szablon with that praca (matched by opis + j.m.)
  shows it. Never copied onto kosztorys rows.
- A position with no katalog match goes through the existing „Zapisz do katalogu" first; a note always
  belongs to a katalog entry.
- Edited from a kosztorys through a dialog, not in the cell (owner, 2026-10-06; to be checked in the
  spike). The dialog states the edit changes every kosztorys and szablon with that praca (vs Komentarz,
  which belongs to this kosztorys and its szablon).
- The Notatka do pracy column exists in every kosztorys and szablon, AI or not — hidden by default,
  switched on in the column picker. It reads the katalog live by opis + j.m., so a katalog edit shows
  everywhere at once; nothing is synced on a szablon update. A row whose opis / j.m. does not match
  the katalog shows no note (the same row the katalog comparison lists as missing).
- The agent reads every note before it reads the client's documents and selects works.

**2. Correction loop on the AI draft**

- Test and training phase (owner, 2026-10-06): **the agent writes only AI przedmiar, never Przedmiar.**
  The manager checks every position and types their own Przedmiar. AI przedmiar is the agent's answer,
  Przedmiar is the manager's — and the offer. Nothing is frozen or copied.
- The agent's draft lives on the offer's kosztorys itself (not a copy).
- New per-position columns: **AI przedmiar** (written by the agent, read-only for people),
  **Powód zmiany** (why the manager's Przedmiar differs), **Notatka do pracy** (the katalog note from 1).
- Removing a position = Przedmiar 0, never deleting the row (the AI value and the reason must survive).
- The agent writes AI przedmiar on **every** position it was given, 0 on the ones it does not pick
  (owner, 2026-10-06). Empty AI przedmiar therefore means "the agent never saw this row" — the manager
  added it afterwards.
- **Status is the manager's stored decision, a select** (owner, 2026-10-06) — not derived. A derived
  status could not tell "not reached yet" from "removed" (both are Przedmiar 0), and made the manager
  retype every quantity the AI got right.

  | Status        | What it does to Przedmiar                                     | Powód zmiany |
  | ------------- | ------------------------------------------------------------- | ------------ |
  | (empty)       | nothing — the row is „do sprawdzenia"                         | —            |
  | Zaakceptowana | Przedmiar = AI przedmiar                                      | no           |
  | Odrzucona     | Przedmiar = 0                                                 | owed         |
  | Edytowana     | the manager types their own quantity                          | owed         |
  | Dodana        | the manager types a quantity where AI przedmiar is 0 or empty | owed         |

  „Do sprawdzenia" is AI przedmiar > 0 with no status. A row where AI przedmiar is 0 and Przedmiar
  stays 0 needs no status — the manager agrees by leaving it.

- Proposed, not yet confirmed: typing a quantity into Przedmiar sets the status itself — „Edytowana"
  when it differs from AI przedmiar, „Dodana" when AI przedmiar is 0 or empty — so the status never
  contradicts Przedmiar and the select is mostly used for accept / reject.
- The two kinds of „Dodana" stay readable from AI przedmiar for analysis: 0 = the agent had the praca
  and did not pick it (knowledge: when to add it); empty = the agent never had it (the szablon or
  katalog lacks the praca).
- Powód zmiany never blocks anything — a missing one only shows in „bez powodu". A reason that is a
  rule about the praca, not about this one job, belongs in that praca's Notatka do pracy afterwards.
- Row filters: „do sprawdzenia" (AI przedmiar > 0, no status — the manager's to-do list), „bez
  powodu" (Odrzucona / Edytowana / Dodana with an empty reason). A row leaves a filter only on
  „Odśwież — ukryj poprawione", never mid-typing.
- **No „with AI / without AI" switch.** A kosztorys is an AI one when any position has AI przedmiar. A
  quick kosztorys made without the agent has none, so it shows no status, no AI filters and no AI
  columns — it works exactly as today.
- None of the new columns ever reach the investor (the client column allowlist keeps them out).

**3. Column filters**

- „Oferta" = Opis, Przedmiar, j.m., Cena j.m., Wartość netto przedmiar — computed by the same rule as
  the investor document (client view settings + settlement columns hidden until the first etap entry),
  not a hand-written list.
- „Przegląd AI" = „Oferta" + AI przedmiar, Status, Powód zmiany, Notatka do pracy, Komentarz (the
  agent's source for the quantity).

**Spike results (owner, 2026-10-07, in the browser)**

- Auto-status on a typed Przedmiar: confirmed — „Edytowana” / „Dodana” set themselves; the select is
  for accept / reject.
- The note is edited by **clicking its cell**, which opens the dialog. An entry in the row's „Akcje”
  menu was rejected. The cell is not greyed when it can be edited.
- „Przegląd AI” as a fixed view works.
- The note column sits with the other AI columns (AI przedmiar, Status, Powód zmiany), not beside
  Komentarz.
- Column names carry a short description, no header tooltips: „AI przedmiar (na ile AI wyceniło
  pracę)”, „Powód zmiany (co AI zrobiło źle)”, „Komentarz do pracy (wiedza firmowa — niewidoczna dla
  klienta)”.
- **Final name: „Komentarz do pracy”** — company knowledge, never shown to the client. It replaces
  „Notatka do pracy” everywhere (column, dialog, /katalog-prac). Whether the crew sees it is open:
  EX-1011.
- „Nowa praca” dialog: „Dodaj pracę do katalogu prac” is **ticked by default**, and while it is ticked a
  „Komentarz do pracy” field sits right under „Opis pracy”; it is written to the katalog entry in the same
  save. A blank field never erases an existing comment on „Nadpisz w katalogu”. On „Tylko do kosztorysu”
  the typed comment is dropped (the katalog stays untouched).
- AI style = the app's `ai` button accent in cyan only (no fuchsia): cyan cell lines, a light cyan
  background and cyan header text on the AI columns; the „Przegląd AI” toggle is a `variant="ai"`
  button.

**Spike (2026-10-06) — built**

- Branch `spike/kosztorys-ai-knowledge-loop`, worktree `../wykonczymy-worktrees/kosztorys-ai-knowledge-loop`.
  Not pushed, not merged; throwaway — the real change goes through `/10x-plan`.
- Its migration (`ai_planned_qty`, `change_reason`, `review_status` on items, `work_note` on katalog) is
  applied to the local 5433 DB. Investment 171 („test”) holds the case-1 AI draft; reload it with
  `INV=171 node --env-file=.env --conditions=react-server --import tsx src/scripts/spike-ai-draft.ts`
  (resets status and reason).
- Cut on purpose: snapshots / sheet import / szablon strip ignore the new fields, no `hasAiDraft` gate,
  Powód zmiany doesn't wrap, the /katalog-prac note is read-only, no tests.
- Questions the spike must answer: does auto-status on a typed Przedmiar feel right; is the note dialog
  the right edit surface; does „Przegląd AI” as a fixed view work. „Oferta” waits on
  `offer-hides-remaining`. Manual checks: `manual-checks.md` § „2026-10-06 — kosztorys-ai-review (spike)”
  on the spike branch.

Out of scope: rules that belong to no single praca („one section per bathroom"), per-author attribution
and note history, an agent-facing API (the experiment's scripts write AI przedmiar through the existing
item save action, which accepts the field; no grid cell sends it), storing a position's katalog origin (the opis-rewrite limit).
