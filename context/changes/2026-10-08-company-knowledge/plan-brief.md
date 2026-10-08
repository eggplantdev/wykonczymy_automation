# Wiedza firmowa — Plan Brief

> Full plan: `context/changes/2026-10-08-company-knowledge/plan.md`

## What & Why

A book of company rules that belong to no single praca, such as the wall height to assume when the
inquiry gives none. Management opens it in one click, and the AI agent reads all of it before
drafting a przedmiar. EX-1032.

## Starting Point

Knowledge about one praca already lives in the katalog's „Komentarz do pracy”. General rules exist
only as prose in the AI-tests procedure. The agent has no way to read either from a script.

## Desired End State

- A „Wiedza firmowa” button in the top bar on desktop and in the mobile menu on a phone. It opens a
  dialog where management lists, adds, edits and deletes entries (topic + text).
- Entries keep the order management drags them into. Search (ignoring Polish letters) and the sorts
  „Alfabetycznie” / „Ostatnio zmienione” sit on top. This is the spike the owner approved, now backed
  by the database.
- EMPLOYEE sees nothing.
- The book starts with 9 rules taken from the procedure.
- A case script writes `inputs/wiedza-firmowa.md`, holding the book plus the katalog notes, for the
  agent to read.

## Key Decisions Made

| Decision          | Choice                                                                      | Why                                                                                |
| ----------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Form              | Dialog, not a page; top bar + mobile menu                                   | Owner: one click from anywhere                                                     |
| Access            | ADMIN / OWNER / MANAGER read and write                                      | Owner; enforced on the server by `protectedAction` and collection access           |
| Delete            | Permanent, after a confirm, by any manager                                  | Like the katalog prac and magazyny; no `/kosz`                                     |
| Starting content  | The procedure's general rules, inserted by the migration                    | A full book from day one, and one source                                           |
| Book vs katalog   | Book = rules for no single praca; katalog notes stay                        | Avoids two homes for one rule                                                      |
| Agent's read path | REST dump script beside the case scripts, book + katalog notes              | Prod is reached only through the app; it also closes the „must read the notes” gap |
| Phone             | Deliberate exception, recorded in AGENTS.md, checked at 390px               | Owner                                                                              |
| Shape             | Entries, not one document; search + sort + drag order                       | Owner, after the click-through spike                                               |
| Order             | A `displayOrder` column; a drag never bumps `updatedAt`; new entries on top | „Ostatnio zmienione” stays meaningful                                              |
| Search/sort       | On the client, over the whole loaded book                                   | Tens of entries; no server round trip                                              |

## Scope

**In scope:** the collection (with `displayOrder`), migration and seed; the query and 4 actions
(create, update, delete, reorder); the spike's dialog wired to them; 2 triggers; the AGENTS.md note;
the dump script and the procedure step.

**Out of scope:** categories, history, the trash, server-side search, the agent writing to the book, and
re-running the analysed AI cases.

## Phases at a Glance

| Phase                | What it delivers                    | Key risk                                                                   |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------- |
| 1. Collection + seed | Table with 9 entries                | The tree is shared: check `git status src/migrations` before migrating     |
| 2. Reads/writes      | Cached query + 4 actions            | A reorder must leave `updated_at` alone                                    |
| 3. Dialog + triggers | The spike, backed by the server     | Failed writes must roll the local list back; drag is not testable in jsdom |
| 4. Agent read path   | `inputs/wiedza-firmowa.md` per case | Runs against production with a session token                               |

**Prerequisites:** none. **Estimated effort:** one session.

## Open Risks & Assumptions

- The seed wording is mine, condensed from the procedure. Review the table in plan.md Phase 1 before
  implementation.
- Prod: `pnpm db:migrate:prod` (a human) before the push.

## Success Criteria (Summary)

- A manager adds a rule on the phone at a site and sees it on desktop.
- The agent's next case input contains every rule, and its „Co / ile założono” names the rule it used.
