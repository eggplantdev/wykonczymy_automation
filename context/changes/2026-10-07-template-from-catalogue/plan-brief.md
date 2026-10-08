# Szablon jako lista prac z katalogu — Plan Brief (EX-1017)

> Full plan: `context/changes/2026-10-07-template-from-catalogue/plan.md`
> Research: `context/changes/2026-10-07-template-from-catalogue/research.md`

## What & Why

A szablon held its own copy of every praca, so it drifted from the katalog prac (big bag 450 vs 600
reached six investments). Owner decision 2026-10-07: szablon content and prices are 1:1 from the
katalog. A szablon becomes a list of katalog entries in sekcje; editing it edits the katalog.

## Starting Point

No pozycja knows its katalog entry — everything matches by opis + j.m. text. A szablon is an ordinary
kosztorys tree with status `szablon`. Prod is clean: the one live szablon (302 prace) equals the
katalog in every field as of 2026-10-08.

## Desired End State

The szablon shows katalog values live; a cena / opis / stawka / tłumaczenie edit there lands in the
katalog. `/katalog-prac` names the szablony a praca is in and deleting removes it from them. Every
kosztorys pozycja remembers its entry, so „Aktualizuj pozycję w katalogu prac", comparison and
„Komentarz do pracy" survive renames. Kosztorysy never change on their own.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Katalog delete of a szablon praca | Warn, then remove from all szablony | One step; owner's call | Plan (owner) |
| Existing kosztorysy | Link once by opis + j.m. | One matching path afterwards | Plan (owner) |
| „Komentarz" in szablon | Removed (empty everywhere) | „Komentarz do pracy" covers it | Plan (owner) |
| Wrong price recovery | Manual fix; no katalog history | Prices change rarely, visible at once | Plan (owner) |
| Szablon edit → katalog | Immediate, no confirm; rename collision refused | Model pkt 4 | change.md |
| Szablon data model | Read-through (overlay on read), not copy + fan-out | Nothing can drift | Research → Plan |
| Reference type | Soft (no FK), index, live-id filter on copy | Answers both prior rejections | Research → Plan |
| Unlinked szablon row | Behaves as today | Transition safe in any order | Plan |
| Linking | Re-runnable script; szablon rows only if identical | Never overwrites the kierownik's edits | Plan |

## Scope

**In scope:** column + plumbing; link script; szablon overlay + write-through; katalog warnings and
delete; Aktualizuj by id; save-as-szablon skips unlinked; id-first matching; docs + runbook.

**Out of scope:** katalog history; live refresh of an open szablon; worker-report translations from
the katalog; FK constraint; any katalog → kosztorys flow.

## Architecture / Approach

`kosztorys_items.catalogue_item_id` (soft ref). Tree read LEFT JOINs the katalog for szablon rows only
and overlays its values; every apply path already reads the szablon through the tree, so founding /
„Wczytaj szablon" / „Sekcja z szablonu" get katalog values for free. `updateItemFieldAction` on a
linked szablon row redirects content fields to the katalog entry.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Remembered entry | Column carried by every copy/insert path | A builder missing the field (tsc catches) |
| 2. Link script | Existing rows linked, diffs reported | Szablon edited between check and link |
| 3. Szablon ↔ katalog | Overlay read + write-through, „Komentarz" gone | Stawka pair written as two updates |
| 4. Katalog prac | Szablon names in edit/delete; delete prunes szablony | Trashed szablon keeping a dead row |
| 5. Kosztorys side | Aktualizuj by id, save-as-szablon, id-first matching | Cached readers needing a key bump |
| 6. Prod + docs | Runbook, domain notes, S-09 note | Order: migrate → push → link |

**Prerequisites:** fresh dump; prod migration applied by a human before the push.
**Estimated effort:** ~3–4 sessions.

## Open Risks & Assumptions

- Assumes the kierownik's szablon edits between the final comparison and the link are few; the script
  reports them instead of guessing.
- Katalog ids are never reused (serial, no TRUNCATE … RESTART IDENTITY) — the soft reference relies on it.

## Success Criteria (Summary)

- A price changed in the szablon is the katalog price, and the next investment gets it.
- No szablon praca can disagree with the katalog.
- Renaming a praca no longer cuts kosztorysy off from „Aktualizuj" and „Komentarz do pracy".
