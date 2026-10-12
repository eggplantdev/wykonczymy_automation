---
change_id: investment-ai-stage
title: „Etap AI” on the investment
status: archived
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12T18:29:27Z
branch: staging
worktree: null
linear: EX-1046
---

## Notes

Agreed with the user on 2026-10-12, in the session that lifted the #188–#191 Powody zmiany into the
knowledge (`context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md`, Method step 9).

**Why.** The knowledge flow needs three facts per investment that nothing records today:

- it is ready for an AI analysis (the notes and documents are in);
- the owner has finished reviewing the AI draft, so the knowledge can be extracted;
- the knowledge has already been extracted, so nobody reads its Powody zmiany again.

**One field, not three flags.** `Etap AI` on the investment:

| Value                   | Set by                                                    |
| ----------------------- | --------------------------------------------------------- |
| Uzupełnianie informacji | default (no stored stage — `null`)                        |
| Gotowa do analizy       | by hand                                                   |
| Przeanalizowana         | by hand, or lifted on the listing by a loaded AI draft    |
| Recenzja zakończona     | by hand (owner, after reviewing the draft)                |
| Wiedza wyekstraktowana  | by hand, once `apply-knowledge-prod.ts` edits are on prod |

„Przeanalizowana” replaces the derived „Szkic wgrany” (user, 2026-10-12): a loaded draft IS the
analysis, so the listing's „Analiza AI” column shows „Przeanalizowana” for an investment with a draft
whose stored stage is still „—” or „Gotowa do analizy”, and never pulls back a later stage. One step
list, no derived-only value beside the stored ones.

No reset: a Powód zmiany written after the extraction leaves the stage as it is (user, 2026-10-12 —
accepted; reset by hand if it matters).

**Scope:**

- hand-written migration + the collection field;
- set it on the investment page (a select in the header);
- listing: show it with „Analiza AI”, plus a filter;
- `collect-reasons-prod.ts` takes only „Recenzja zakończona” when no `INVESTMENTS` are given;
  `apply-knowledge-prod.ts` is untouched — its edits carry no source investment.

Plan: `plan.md` (brief: `plan-brief.md`).
