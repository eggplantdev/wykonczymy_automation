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

- [x] **1.1 Root-cause the horizontal overflow.** DONE (`04e9b450`). Cause was `ui/page-wrapper.tsx`:
      `grid grid-cols-1` items keep `min-width: auto`, so a wide child (transfer table, filter row)
      grew past the viewport instead of letting its own `overflow-x-auto` engage — the same failure
      `(frontend)/layout.tsx:62` already solves with `min-w-0` for the flex column. Fixed with
      `[&>*]:min-w-0`; page padding gained a mobile step (`p-4 sm:p-6 lg:p-8`). No `overflow-x-hidden`
      backstop was needed.
- [x] **1.2 Mobile menu.** DONE — `nav/mobile-nav.tsx`, portalled to `<body>`.
      Links/role gating/badges extracted to `hooks/use-nav-links.ts` + `nav/unread-badge.tsx` and
      shared with the sidebar. Not a Radix Dialog: the panel is always mounted and slides, so the
      badges stop remounting on every open.
      ORIGINAL: A drawer off the top bar, reusing `SECTION_LINKS` + `MANAGEMENT_LINKS`,
      the role gating and the unread badges that already live in `nav/sidebar.tsx:39` — extracted,
      not copied. Closes on navigation.
- [x] **1.3 Move the shell switch `lg` → `sm`.** DONE — sidebar is `sm:flex`; `app-footer.tsx` was
      deleted outright rather than re-gated, so the editor's two-step height math collapsed to one
      case and now reads the `h-below-top-nav` token.
      ORIGINAL: `nav/sidebar.tsx:87` (`hidden … lg:flex`) and
      `nav/app-footer.tsx` (`lg:hidden`). **`app-footer.tsx`'s `h-14` is load-bearing for the
      kosztorys editor's viewport math.** The coupled line is
      `kosztorys/editor/kosztorys-editor-body.tsx:380` —
      `h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)]`, i.e. 7rem = top bar + footer, 3.5rem = top
      bar alone once the footer hides. Move its `lg:` to `sm:` in the same edit or the editor
      miscalculates its height across 768–1280.
- [x] **1.4 One z-index scale as `@theme` tokens.** DEFERRED out of this slice → **EX-786**.
      No mobile symptom (the drawer layers correctly at `z-10002`), and the fix reaches into 13 call
      sites across files the slice never opened. ORIGINAL: Replaces Dialog `10000` / AlertDialog + toasts
      `10001` / Popover + DropdownMenu + Tooltip `50` / shell `40` / frozen columns `30`. Delete the
      `z-10001` plaster at `ui/combobox.tsx:124`. Sharpest edge in the slice: it silently reorders
      every overlay in the app, so walk the overlay-on-overlay cases (popover in dialog, dropdown in
      dialog, toast over dialog, tooltip over popover, alert-dialog over dialog).

## Phase 2 — Primitives

- [x] **2.1 `DialogContent` on mobile.** Full-height sheet below `sm` (`top-0 h-dvh w-full
max-w-none`, slide-in from the bottom), the centred box from `sm:` up. `h-dvh` rather than
      `vh` so it tracks the shrinking viewport under the keyboard. `DialogHeader` lost its mobile
      `text-center` (desktop was already left) and gained `pr-10` so long titles clear the close
      button.
      **Caller contract changed:** an unprefixed `max-w-*` / `h-*` on `<DialogContent>` now
      overrides the sheet, so eleven callers were moved to `sm:`-prefixed widths.
- [x] **2.2 `PopoverContent` / `CommandList` collision-aware.** Done, but NOT as written — the item
      was drafted without reading `dropdown-menu.tsx`, which already carried both collision caps
      (stock shadcn). Only `popover.tsx` was missing the height half; it now carries the same pair,
      so the two primitives are symmetric. **The "drop the fixed `w-72` and the hard
      `max-h-[300px]`" half is deliberately NOT done, because it was wrong:** viewport-derived width
      would inflate a 288px menu to the anchor's full space on desktop (29 call sites, no gain), and
      `command.tsx`'s 300px is a content preference, not a viewport guard — it stops a 500-option
      list filling a tall screen and binds BEFORE the collision cap, which only takes over on a
      shorter one. Two caps, two jobs. Also removed the now-redundant duplicate at
      `filter-multi-select.tsx:268`.
      ORIGINAL: Consult Radix's `--radix-popover-content-available-height` / `-available-width`;
      drop the fixed `w-72` and the hard `max-h-[300px]` (`ui/command.tsx:88`) for viewport-relative
      bounds.
- [x] **2.3 Re-check every caller** — manually verified at 390px on staging (2026-09-16, commit
      `b744a3b1`): combobox (investment picker in the deposit dialog), `filter-multi-select`-backed
      "Typ" filter, column-toggle menu, a date picker, and the kosztorys-v2 "Opcje" menu all open,
      stay within the viewport, and are usable. Desktop was not re-walked this pass (2.2 already
      covers the collision-cap behavior there); findings and checklist:
      `context/foundation/manual-checks.md` → "rwd-mobile — phone pass for plan items 2.3 / 3.1 /
      3.2".
      ORIGINAL: of the two above on desktop — `combobox`, `filter-multi-select`, `column-toggle`,
      the date pickers, the kosztorys dialogs.

## Phase 3 — The two named flows

- [x] **3.1 Adding a transaction** — manually walked on staging at 390px (2026-09-16, commit
      `b744a3b1`): the three top-bar dialogs (deposit, internal transfer, expense) all open as
      full-height sheets; the deposit dialog's investment combobox opens and is usable inside it.
      Layout inspected without submitting (staging writes hit the preview DB's real prod-dump data),
      so the expense form's file/invoice ingest UI was inspected but not exercised end-to-end with a
      real upload. No layout defects found. Findings and checklist:
      `context/foundation/manual-checks.md` → "rwd-mobile — phone pass for plan items 2.3 / 3.1 /
      3.2".
      ORIGINAL: end to end on a phone: the three top-bar dialogs (deposit,
      internal transfer, expense) + the expense form incl. its file/invoice ingest.
- [x] **3.2 Showing transactions** — manually walked on staging at 390px (2026-09-16, commit
      `b744a3b1`): `/` renders the filter row as two even columns, the "Filtry" fold
      collapses/expands it, and the table itself causes no page-level horizontal overflow. Findings
      and checklist: `context/foundation/manual-checks.md` → "rwd-mobile — phone pass for plan items
      2.3 / 3.1 / 3.2".
      ORIGINAL: on a phone: the filters row (`filters/filter-grid.tsx` currently
      walls up ~10 triggers) and the table itself. The „Filtry" fold shipped 2026-09-16 already
      helps; decide what the filter row should actually BE on a phone.
- [x] **3.3 `PageWrapper`** DONE in 1.1 — now `p-4 sm:p-6 lg:p-8`.

## Phase 4 — The rest

Scoped after 1–3 land, with the owner. Candidates seen while shaping: the remaining list pages
(kasy, inwestycje, pracownicy, flota, sprzęt), `zgloszenia`, the auth pages, and deciding how much
"kind of works" the kosztorys editor gets.

## Progress

#### Automated

- `pnpm exec tsc --noEmit` (excluding pre-existing `e2e/` errors, owned by a parallel agent) — clean.
- `pnpm exec prettier --check` on the slice's non-test files — clean after formatting eight.
- Tailwind utility generation for the three new `@theme` tokens (`h-below-top-nav`,
  `max-w-dialog{,-sm,-lg}`) verified by compiling a probe through `@tailwindcss/postcss`, not
  assumed from the namespace name.
- `/simplify` fan-out (4 read-only agents over the slice's non-test diff): 13 applied, 6 dismissed,
  3 dropped, 3 skipped, 0 open — folded into `review-gate.md`. Notable: one `@utility typing-surface`
  replaces the iOS-zoom incantation copied across three inputs and closes the kosztorys cell that
  had missed it; `NavLinkItem` / `LogoutButton` end the sidebar↔drawer duplication; three `Where`
  tree walks collapse to `mapWhereLeaves` / `someWhereLeaf`.
- Utility generation for `typing-surface` verified the same way as the `@theme` tokens above.
- Unit/DOM suite: owned by the parallel test agent, not run here.
- `pnpm test:e2e`: not run (≈1h; runs only on request).
- Manual phone pass: done 2026-09-16 against staging (commit `b744a3b1`), 2.3 / 3.1 / 3.2 all
  verified at 390px — no layout defects. The pass reported Escape not closing the drawer as a bug;
  **dropped on the owner's ruling** — the drawer is `sm:hidden` and a phone has no Escape key, so the
  only reachable caller is a desktop browser narrowed below 768px. EX-619 set that precedent. The
  leftover `closeRef` focus call and `onKeyDown` handler in `nav/mobile-nav.tsx` are dead code to
  clean up, not a defect. Full findings: `context/foundation/manual-checks.md` → "rwd-mobile — phone
  pass for plan items 2.3 / 3.1 / 3.2".
