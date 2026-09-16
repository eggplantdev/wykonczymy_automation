---
change_id: rwd-mobile
plan_version: 1
created: 2026-09-16
updated: 2026-09-16
---

# Plan — O-02 rwd-mobile

**This is deliberately a thin plan.** The work is iterative and visual: look at a surface on a
phone, fix what's wrong, look again. Owner's call (2026-09-16): "I don't really see that much
planning here — it's gonna be a back and forth kind of work." So this file is a checklist and a
progress ledger, not a design document. Findings that turn out to need a decision get raised in the
conversation, not pre-decided here.

Context, baseline measurements and the approved phasing live in `change.md` — read it first.

## Guardrails

- **Fix shared primitives, not call sites.** Only 19 of 479 `.tsx` files use `sm:` at all. A fix in
  `ui/dialog.tsx` or `ui/popover.tsx` reaches every caller; a breakpoint sprinkled on one component
  reaches one. Prefer the former, always.
- **Every change here is visible on desktop too.** These are the shared overlay primitives and the
  app shell — check a desktop screen before calling any item done.
- **Don't mask the overflow.** `overflow-x-hidden` on `body` hides the symptom. Root-cause first,
  then decide whether the backstop is still worth having.
- The kosztorys editor is out of scope beyond not breaking the page.

## Phase 1 — Shell

- [ ] **1.1 Root-cause the horizontal overflow.** Needs a browser — measure which element exceeds
      the viewport width, don't reason about it. Fix at the source.
- [ ] **1.2 Mobile menu.** A drawer off the top bar, reusing `SECTION_LINKS` + `MANAGEMENT_LINKS`,
      the role gating and the unread badges that already live in `nav/sidebar.tsx:39` — extracted,
      not copied. Closes on navigation.
- [ ] **1.3 Move the shell switch `lg` → `sm`.** `nav/sidebar.tsx:87` (`hidden … lg:flex`) and
      `nav/app-footer.tsx` (`lg:hidden`). **`app-footer.tsx`'s `h-14` is load-bearing for the
      kosztorys editor's viewport math.** The coupled line is
      `kosztorys/editor/kosztorys-editor-body.tsx:380` —
      `h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)]`, i.e. 7rem = top bar + footer, 3.5rem = top
      bar alone once the footer hides. Move its `lg:` to `sm:` in the same edit or the editor
      miscalculates its height across 768–1280.
- [ ] **1.4 One z-index scale as `@theme` tokens.** Replaces Dialog `10000` / AlertDialog + toasts
      `10001` / Popover + DropdownMenu + Tooltip `50` / shell `40` / frozen columns `30`. Delete the
      `z-10001` plaster at `ui/combobox.tsx:124`. Sharpest edge in the slice: it silently reorders
      every overlay in the app, so walk the overlay-on-overlay cases (popover in dialog, dropdown in
      dialog, toast over dialog, tooltip over popover, alert-dialog over dialog).

## Phase 2 — Primitives

- [ ] **2.1 `DialogContent` on mobile.** Full-height sheet below `sm`, the current centred box from
      `sm:` up. Must survive the virtual keyboard.
- [ ] **2.2 `PopoverContent` / `CommandList` collision-aware.** Consult Radix's
      `--radix-popover-content-available-height` / `-available-width`; drop the fixed `w-72` and the
      hard `max-h-[300px]` (`ui/command.tsx:88`) for viewport-relative bounds.
- [ ] **2.3 Re-check every caller** of the two above on desktop — `combobox`, `filter-multi-select`,
      `column-toggle`, the date pickers, the kosztorys dialogs.

## Phase 3 — The two named flows

- [ ] **3.1 Adding a transaction** end to end on a phone: the three top-bar dialogs (deposit,
      internal transfer, expense) + the expense form incl. its file/invoice ingest.
- [ ] **3.2 Showing transactions** on a phone: the filters row (`filters/filter-grid.tsx` currently
      walls up ~10 triggers) and the table itself. The „Filtry" fold shipped 2026-09-16 already
      helps; decide what the filter row should actually BE on a phone.
- [ ] **3.3 `PageWrapper`** — `p-6 lg:p-8` has no mobile step.

## Phase 4 — The rest

Scoped after 1–3 land, with the owner. Candidates seen while shaping: the remaining list pages
(kasy, inwestycje, pracownicy, flota, sprzęt), `zgloszenia`, the auth pages, and deciding how much
"kind of works" the kosztorys editor gets.

## Progress

#### Automated

_(nothing yet)_
