# Worker work reports — slice 1 (EX-947) — Plan Brief

> Full plan: `context/changes/2026-09-30-worker-work-reports/plan.md`
> Research: `context/changes/2026-09-30-worker-work-reports/research.md`

## What & Why

A worker reports the quantities he executed from a named link, on a phone or a desktop. A kierownik
ticks and corrects the lines in the rozpiska and accepts them. Accepted quantities are **added** to
an etap. Today the approved UI spike runs on localStorage; this plan makes it real.

## Starting Point

- **Spike UI.** The whole UI exists as an uncommitted spike: the report grid with „Zgłaszam”, prace
  spoza rozpiski, and the review dialog. It runs on four localStorage/session seams. Everything
  else in it is kept.
- **Links, gates and writes.** The worker rozpiska link, the share-token machinery, the investment
  lock gate and the etap + worker-split writes already exist.
- **Stage quantities are absolute**; nothing adds to them yet.

## Desired End State

- **The worker's side.** A worker opens „Link do zgłoszeń” without logging in and types what he did.
  The szkic stays in his browser. He sends it, and sees each report as czeka / przyjęte / odrzucone.
- **Finding pending reports.** The kierownik sees them in the nav („Zgłoszenia prac”, with a
  count), on the rozpiska toolbar and in the „Pracownicy” menu.
- **Accepting.** He accepts into the worker's etap or a new one. The figures appear in place, and
  any other open window reloads on focus.

## Key Decisions Made

| Decision              | Choice                                                                                                                 | Why                                                                              | Source                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------ |
| Storage               | Two raw tables `worker_reports` + `worker_report_lines`, no Payload collection                                         | Precedent `kosztorys_stage_workers`; skips the 9-item collection checklist       | Research                       |
| Szkic                 | Browser `localStorage`, keyed by investment + worker                                                                   | A dozen lines typed in one sitting; server side later is self-contained          | Owner #23                      |
| Report link           | Its own collection `worker-report-shares`, reusing `share-token.ts`                                                    | Two links stay separate (#18); revoke never touches reports                      | Owner #18 / Research           |
| Public write auth     | `tokenAction`: token → lock gate → active worker + ready scope → pozycje belong to the investment                      | The token is the whole credential; the client never supplies an id               | Research / Owner #13, #21, #22 |
| Acceptance write      | One transaction: claim pending → validate → auto version → new etap → extras → additive upsert → lines → revision bump | Atomic, double-click safe, reversible from „Wczytaj”                             | Plan                           |
| Accepting window      | Drain the cell saves, then adopt the etap → append rows → patch the server's absolute figures → prune undo             | An in-flight absolute save could erase the addition; rows are mount-frozen       | Plan (lessons ~165, ~172)      |
| Other windows         | Revision check on focus → reload                                                                                       | Precise, since cell edits don't bump the revision; the hot write stays untouched | Plan / Owner #25               |
| Nav path              | `/zgloszenia-prac`; badge match gets the `${href}/` boundary                                                           | Otherwise it zeroes the leads badge                                              | Owner                          |
| Nav count             | A pending queue, not an unread cursor                                                                                  | It must not zero on its own page                                                 | Plan                           |
| Report vs editor body | Keep the single `report` prop; hook branches become seams; extraction filed to Linear                                  | A real extraction touches every editor surface                                   | Plan                           |
| Lost pozycja          | Szkic: dropped with a notice. Sent report: „do przypisania ręcznie”                                                    | No stable ids across a restore                                                   | Owner #14, #24                 |

## Scope

**In scope:**

- tables and the report link;
- the public route and send;
- the worker's status list;
- accept / reject;
- in-place patching and the other-window reload;
- nav page and count;
- the deep link `?zgloszenie=`;
- Lp + j.m. at ≥768px;
- editor seams;
- docs.

**Out of scope:**

- a server-side szkic;
- withdrawing or editing a sent report;
- token hardening;
- mail;
- Google-Sheet investments;
- translations and paper → AI (slices 2–3);
- stable ids;
- a compare-and-set on the cell write;
- extracting the report grid component.

## Architecture / Approach

The worker page (`/zgloszenie-prac/⟨nazwisko⟩/⟨token⟩`, allowlisted in `proxy.ts`) posts through
`tokenAction` into `worker_reports`. The kierownik's dialog, inside `KosztorysActionsProvider`,
reads the reports uncached. It accepts through `investmentAction` → one transaction that adds to
`stage_progress`. The editor's leaf hook `use-worker-report-acceptance` patches the grid from the
returned absolute figures.

## Phases at a Glance

| Phase               | What it delivers                                                          | Key risk                                                                         |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Storage          | Migration, `lib/db` layer, report-link collection, delete guard           | FK indexes missing → slow restore                                                |
| 2. Worker's side    | Link minting, `tokenAction`, public route, send, status, szkic prune      | A gate order that lets a revoked or zakończona link write                        |
| 3. Kierownik's side | Reads, reject, accept, lane drain, in-place adoption, other-window reload | An in-flight save erasing an addition; the new etap key missing on appended rows |
| 4. Surfacing        | Nav page + count, badge boundary, deep link, shared dialog toggle         | Leads badge regression                                                           |
| 5. Layout + seams   | Media-query hook, Lp + j.m. ≥768px, report branches as seams              | Regressing the other editor surfaces                                             |
| 6. Docs             | Lessons 253, AGENTS.md phone exception, domain notes                      | —                                                                                |

**Prerequisites:**

- The spike's uncommitted fixes (incl. „no red on documents”) ride with this change and are
  reviewed together; they land in Phase 5.
- A human runs `pnpm db:migrate:prod` before the push.

**Estimated effort:** ~4–5 sessions across 6 phases.

## Open Risks & Assumptions

- **A restore after an accept.** Restoring the pre-accept auto version removes the added quantities
  while the report still reads „Przyjęte”. This is accepted and documented.
- **„Problemy” noise.** Accepted prace spoza rozpiski show as „wykonane bez przedmiaru” — the owner's
  bez-przedmiaru rule.
- **A worker with no etap left** (#20). He has no plane to inherit, so the kierownik picks one. Any
  choice that would mix his rozliczenia is refused.
- **Staging links point at production** (`NEXT_PUBLIC_FRONTEND_URL`), so manual QA swaps the host.

## Success Criteria (Summary)

- A worker sends a report from his phone with no login, and sees its status change.
- A kierownik accepts it from the nav's deep link. The etap figure grows by exactly the accepted
  amount, with no reload and no lost edit.
- A revoked, zakończona or foreign link can never write.
