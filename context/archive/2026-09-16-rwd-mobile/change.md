---
change_id: rwd-mobile
title: RWD — make the app usable on a phone (navigation, transactions, primitives)
status: archived
created: 2026-09-16
updated: 2026-09-17
archived_at: 2026-09-17T09:14:36Z
branch: null
worktree: null
---

## Notes

Cross-cutting UI work, outside the kosztorys arc — same standing as `O-01`. Roadmap slice: **O-02**. Linear: **EX-785**.

**Owner's framing (2026-09-16):** phased, not a parity push. Not everything needs to work on a
phone. What must: **navigation**, **adding a transaction**, **showing transactions**. Fix the
obvious, cheap mistakes first, then re-decide. The in-app kosztorys editor is explicitly a desktop
thing — "make it work, kind of", nothing more.

### The five reported symptoms (owner, verbatim in substance)

1. Horizontal overflow — the page shifts around on mobile.
2. No mobile menu.
3. Dropdowns behave badly on mobile.
4. Filters behave badly on mobile.
5. Dialogs look bad on mobile — all of them.

### Baseline found while shaping (2026-09-16)

- **No navigation below 1280px.** `src/components/nav/sidebar.tsx:87` is `hidden … lg:flex`;
  `top-nav.tsx` offers only a brand link + the three action dialogs. The link data
  (`SECTION_LINKS` + `MANAGEMENT_LINKS`, role gating, unread badges) already lives in `sidebar.tsx:39`
  and should be reused, not redefined.
- **A mobile pass was started and abandoned.** `nav/app-footer.tsx` is `lg:hidden`; its `h-14` is
  load-bearing for the kosztorys editor's viewport math (comment in that file).
- **Desktop-first by default:** 19 of 479 `.tsx` files use `sm:` at all (35 occurrences), almost all
  in dialogs and a couple of `ui/` primitives. `PageWrapper` is `p-6 lg:p-8` with no mobile step.
- **The z-index scale is ad hoc and contradictory** — this is the concrete bug behind "dropdowns
  work like shit":

  | Surface                  | z       |
  | ------------------------ | ------- |
  | Dialog overlay + content | `10000` |
  | AlertDialog              | `10001` |
  | Toasts                   | `10001` |
  | Popover                  | `50`    |
  | DropdownMenu             | `50`    |
  | Tooltip                  | `50`    |
  | Sidebar / TopNav         | `40`    |
  | Datasheet frozen columns | `30`    |

  A Popover or DropdownMenu opened **inside a dialog** paints under the dialog overlay.
  `ui/combobox.tsx:124` already hardcodes `z-10001` to escape it — a per-caller plaster on a
  missing scale.

- **Popovers ignore the viewport.** `PopoverContent` is a fixed `w-72` with no `max-w`;
  `CommandList` is a hard `max-h-[300px]` (`ui/command.tsx:88`). Neither consults Radix's
  `--radix-*-available-height` / `-available-width`, so on a 360px viewport with the keyboard up the
  list is boxed off-screen.
- **Dialogs float.** `DialogContent` is `max-w-[min(90vw,600px)] max-h-[90vh]`, centred with
  `top-1/2 left-1/2 -translate-*` — the virtual keyboard shoves it around.
- **Overflow root cause is NOT yet identified.** The containers that should leak
  (`ui/data-table/data-table.tsx:185`, the kosztorys grid) are already `overflow-x-auto`, and the
  shell has the `min-w-0` fix at `(frontend)/layout.tsx:62`. Must be measured in a browser, not
  guessed. `body` has no `overflow-x-hidden` backstop — worth adding, but it MASKS the cause, so
  root-cause first.

### Decisions taken while shaping

- **The mobile↔desktop shell switch moves from `lg` (1280) to `sm` (768).** `globals.css:27`
  already declares `sm` as this app's single mobile→desktop line; the shell disagreeing with it is
  why 768–1280 currently gets neither the sidebar nor a menu. Tablets get the sidebar back.
- **Kosztorys editor is out of scope** beyond not breaking the page.

### Phases (approved 2026-09-16)

1. **Shell** — root-cause + fix the overflow; mobile menu in the top bar (drawer reusing the
   sidebar's link data); one z-index scale as `@theme` tokens, replacing the `z-50`/`z-10000`/
   `z-10001` free-for-all and removing the `combobox.tsx` plaster.
2. **Primitives** — `DialogContent` full-height on mobile; `PopoverContent` / `CommandList`
   collision-aware. Two files, every caller fixed at once.
3. **The two named flows** — adding a transaction (the three top-bar dialogs + expense form) and
   showing transactions (filters + table) working end to end on a phone.
4. **The rest** — scoped after 1–3 land.
