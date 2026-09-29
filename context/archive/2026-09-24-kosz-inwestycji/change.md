---
change_id: kosz-inwestycji
title: Investment trash — reversible deletion of an investment by the owner
status: archived
created: 2026-09-24
updated: 2026-09-28
archived_at: 2026-09-28T14:36:13Z
branch: kosz-inwestycji
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/kosz-inwestycji
---

## Notes

Review record: the 2026-09-28 staging QA pass (manual checks 9/9; ledger deleted 2026-09-29, git history).

Before this change an investment could not be deleted from the app — only from the unused `/admin`,
and hard: the cascade wiped the kosztorys, versions, investor link and photo attachments with no
warning. The only gate was "no live transactions" (`preventDeleteWithTransactions`).

## Decisions from the discussion (2026-09-24)

- **Owner and admin only.** A manager neither deletes nor restores.
  _Superseded 2026-09-29: the manager has full parity — trash, restore, delete forever, `/kosz`
  (`context/archive/2026-09-29-kosz-inwestycji-manager/`)._
- **Intermediate state: a trash with restore.** „Usuń" on the listing moves to the trash;
  „Przywróć" returns the investment as it was before deletion; only „Usuń na zawsze" deletes.
- **Transactions always block.** An investment with a live (non-cancelled) transaction can be
  neither trashed nor deleted.
- **Never a template** (an investment with status `szablon`).
- **Automatic purge after 30 days — but it never deletes a kosztorys.** An investment with a used
  kosztorys stays in the trash until the owner deletes it by hand, typing the investment's name; the
  dialog names what is lost: the kosztorys (items + versions as one line), photos, the investor link.
- **"Has a kosztorys" (2026-09-28) = the kosztorys was actually used: at least one item has a
  przedmiar or a pomiar ≠ 0** (pomiar is the stage sum). Not counted: bare items (a template seeds
  ~310 empty ones when an investment is created), bare versions (created automatically), a manual
  price or discount without a quantity. An investment with only a template seed purges after 30 days
  like an empty one.
- **Typing the name only for a used kosztorys (2026-09-28).** Without one, „Usuń na zawsze" is a
  plain confirmation — such an investment would vanish on its own after 30 days anyway.
- **Files stay (2026-09-28).** „Usuń na zawsze" and the purge do not delete photos/floor plans from
  Blob — they stay as orphans for `kosz-plikow` to clean up (with its own 7-day window). This change
  does nothing irreversible to files.
- **The trash is one shared `/kosz` page (2026-09-28)** — for now with a single „Inwestycje" section;
  other kinds (registers, employees…) arrive later as separate sections, each with its own mechanism
  (column, hiding, gates, cascades) in its own change. No generic "kind in the trash" abstraction
  here. Entry: a „Kosz" sidebar item (last, below „Pracownicy"), visible to owner and admin only — a
  new, third link group beside "everyone" / "managers" (superseded 2026-09-29: it is the last
  „managers" link and the third group is gone, `context/archive/2026-09-29-kosz-inwestycji-manager/`). Row: name, deletion date, „usunie się samo
  za N dni" or „kosztorys w użyciu — tylko ręcznie", actions Przywróć / Usuń na zawsze. The
  investments listing is untouched.
- **Versions in the trash thin out as usual (2026-09-28)** — `gcSnapshots` unchanged. The kosztorys
  (items, quantities) stays intact the whole time; only older version history goes, as for a live
  investment. Versions are not part of the "actually used" test, so thinning never changes whether
  an investment purges itself.
- **The „Usuń na zawsze" dialog does not list the Google sheet or the lead (2026-09-28).** The
  cascade unlinks them anyway (the sheet is left without an investment, the lead returns to
  promotion) — the owner deliberately doesn't need them in the dialog.
- **While trashed:** the `/k/<token>` link stops working (back on restore), the kosztorys is
  read-only, and the investment disappears from the listing, pickers and totals.
