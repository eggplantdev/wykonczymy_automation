---
change_id: worker-work-reports
title: Workers report executed quantities in their etapy; a manager verifies and accepts them
status: implemented
created: 2026-09-30
updated: 2026-09-30
archived_at: null
branch: staging # shared working tree — switching HEAD would redirect parallel agents' commits
worktree: null
---

## Notes

worker-work-reports — pracownik zgłasza wykonane ilości w swoich etapach z imiennego linku (telefon/komputer), manager weryfikuje checkboxami i akceptacja dodaje do etapu; slice 1 z 3 (2: tłumaczenia UA, 3: kartka→AI)

Linear: **EX-947** (slice 1) under umbrella **EX-946**; slices 2–3 = **EX-948**, **EX-949**.

This is the „część 2" that EX-875 deferred (`kosztorys-editor-domain-notes.md` § Widok pracownika):
the named `/p/⟨nazwisko⟩/[token]` link already identifies the worker and scopes him to the etapy he
is assigned to, precisely so this change does not have to rewrite it.

### The feature, owner's words (2026-09-30)

The worker gets the rozpiska with the works already chosen and an empty etap to fill. He types the
quantities he did, and may add a work from outside the rozpiska (only opis, j.m. and ilość — rates
are filled in by the manager at verification). He then presses „zweryfikuj"; the manager gets
notified, opens a table with checkboxes, ticks the works he accepts and they land straight in the
rozpiska; works from outside the rozpiska come as a separate list he adds by hand. The manager can
always come back to a verification dialog — each report is kept as a frozen snapshot, listed from
an options menu, grouped by date and worker. A report is small: usually a dozen-odd works.

### Decided with the owner (2026-09-30)

1. **Quantities, not hours.** The worker enters ilość in the pozycja's own j.m. — the same figure an
   etap column holds. No hours model.
2. **A worker may report into the same etap more than once, so acceptance ADDS** to the etap's
   quantity, never overwrites it. The same holds for two workers sharing an etap (EX-943).
3. **The manager may correct a quantity before accepting.** The report keeps both the reported and
   the accepted figure.
4. **Notification = an in-app badge only** (a new stream beside leads / fleet / equipment). No mail.
5. **Phone + desktop first; AI reading of paper sheets comes last** (slice 3).
6. **„Arkusz" = the in-app rozpiska.** Investments still on a Google Sheet are out of scope.
7. **Phone support is required** for the worker surface — a deliberate exception to AGENTS.md's
   narrow phone scope (EX-785). Record it there when this ships.

8. **A UI spike comes first, before the real implementation** — first the worker form (phone +
   desktop), then the manager's verification dialog. Only after the owner has seen both do we plan
   and build this slice for real. Translations / dictionaries (slice 2) wait until after that.

9. **One report per etap.** A worker on several etapy picks the etap first.
10. **A form row is „Opis prac", j.m. and the quantity input — nothing else.** No Przedmiar, no
    „Pozostało", no rates: the worker only states what he did.
11. **The draft saves itself as he types** — no „Zapisz szkic" button.
12. **The form is its own surface, not part of the worker link or PDF.** Those two show the worker
    his scope (przedmiar, what he will earn) and settle him; the form only collects quantities.
    It gets its own route and its own link, and reuses nothing of the worker view's rendering.
13. **Token auth is enough — no hardening.** Nothing a worker sends reaches the rozpiska without a
    manager ticking it, so the worst case is bot spam in the reports list. Not worth defending
    against up front. The server still checks that a pozycja belongs to the reported etap, for
    correctness only.

### Shape agreed so far (to be grounded by research)

- **The worker never writes to the rozpiska.** He writes only a report; only what the manager ticks
  reaches the etap. The public link becomes a write surface, and this is what keeps it safe: the
  worst a leaked link can do is file a junk report.
- **The frozen snapshot is the report itself** — immutable once sent, with opis + j.m. copied onto
  each line, so a later rename or delete of the pozycja does not rewrite history. It does not use
  the kosztorys snapshots (S-06).
- A report line is either a pozycja of the rozpiska + ilość, or a new work (opis, j.m., ilość, no
  rates). Unticked lines stay recorded as rejected.
- History lives in the „Pracownicy" menu as „Zgłoszenia prac", grouped by date and worker.

### The arc (three slices, this folder is slice 1)

1. **This change** — reports + verification, Polish, phone/desktop via the existing worker link.
2. **Ukrainian translations** — a translation table keyed by work-catalogue item × language (the
   rozpiska pozycja resolves to its catalogue item by opis + j.m., as „Porównaj z katalogiem" does);
   language set on the worker; a small UI-string dictionary. **Translations are authored by Claude
   as a data import (export → translate → import script), not by an in-app AI call**; a manual
   „Tłumaczenie (UA)" field + a „bez tłumaczenia" problem filter cover new catalogue items.
   Identity never goes through the translated text — a report line points at the pozycja itself.
3. **Paper → AI** — the worker PDF gains a row number per line and a QR (worker + etap) and an empty
   column; a scan becomes a draft report through the same verification dialog. The only in-app AI
   in the arc; the same read translates new works written in Ukrainian.

### Spike 1 — worker form (2026-09-30)

`/zgloszenie-prac/⟨nazwisko-id⟩/⟨inwestycja⟩` — a session-guarded route standing in for the future
token link, on real rozpiska data. It includes an etap picker (when there is more than one etap),
search, a „Wszystkie / Wpisane" filter, and rows of Opis prac + ilość + j.m. (the Sekcja column is desktop-only — on a phone the row colour carries it). „Prace spoza rozpiski"
opens a dialog with opis, j.m. (a select: the canonical units plus the rozpiska's commonest ones — no free text, owner 2026-09-30) and ilość. A sticky
footer shows the count and „Wyślij do weryfikacji". The draft is kept in localStorage (the real one
goes server-side) and sending is a no-op toast. Files:
`src/components/kosztorys/worker-report/`, `src/lib/kosztorys/worker-report/`.

**Owner feedback on spike 1 (2026-09-30):**

- Section colours are the rozpiska's own (band + rail, same palette and tints as the grid).
- Header lines are „Inwestycja: …" / „Pracownik: …", under the Wykończymy logo, as on every public page.
- **„Wszystkie" = every pozycja of this investment's rozpiska, including those bez przedmiaru**
  (owner, 2026-09-30 — corrects an earlier reading that pulled in a szablon's works). „Z przedmiarem"
  gave way to two chips: „Z przedmiarem lub zgłoszone” (default — przedmiar, or work already in his
  etapy, waiting for the kierownik, or typed now) and „Wszystkie”. A strict „Z przedmiarem” chip was
  tried and dropped the same day: it hid pozycje bez przedmiaru he is actually doing.
  No szablon is involved anywhere in the report flow.

### Spike 2 — manager verification dialog (2026-09-30)

„Pracownicy" → „Zgłoszenia prac" (count of pending shown in the menu). The list is grouped „Wg daty"
or „Wg pracownika", with a status per report: Do sprawdzenia / Przyjęte (n z m) / Odrzucone. A report
opens as two tables:

- „Z rozpiski": tick + editable accepted quantity + „W etapie" teraz → po + „Pomiar / Przedmiar",
  flagged „Przekroczono przedmiar".
- „Spoza rozpiski" (the worker's dopisane prace): + Do sekcji + Cena j.m. (required once ticked);
  on acceptance each becomes a new pozycja bez przedmiaru.

Footer: „Odrzuć zgłoszenie", „Przyjmij n pozycji". A decided report reopens read-only.

The worker form's „Wyślij" now stores the report (localStorage `worker-reports-spike`), so the whole
flow walks on one computer. An investment with no reports gets one sample on first open. Nothing is
written to the rozpiska. Files: `src/components/kosztorys/editor/dialogs/worker-reports/`,
`spike-report-store.ts`.

**Owner feedback on spike 2 (2026-09-30):**

- Pending reports get their own toolbar button „Zgłoszenia prac (n)”, beside „Problemy”, shown only
  while something awaits checking. The „Pracownicy” menu keeps the full history.
- „Zaznacz wszystkie” is needed, and sections must read clearly.
- **Both surfaces use the shared `DataTable` with sorting — no hand-rolled tables.** The form and the
  review share the Sekcja / Opis prac columns (`worker-report/report-columns.tsx`). Every row carries
  its section colour on the left rail and on the rule under it.
- The form is wider on desktop (`max-w-6xl`).
- **A dopisana praca can be swapped for a katalog wpis** (owner: „manager widzi, że to już coś
  z katalogu, i może od razu podmienić”). Each „Spoza rozpiski” line shows up to three katalog
  matches by opis (the „Porównaj z katalogiem” engine) plus a katalog search. A swap takes the
  katalog's opis, j.m. and cena into the new pozycja, keeps the worker's text visible, warns when
  the j.m. differs, and can be undone. The owner flagged this surface as still unfinished.
- The form shows one figure per pozycja, „Zgłoszono / przedmiar”, not the rozpiska's full column
  set. „Zgłoszono” is Σ over his own etapy plus reports waiting for the kierownik plus what he is
  typing now, so a repeat report reads as „Przekroczono przedmiar o …” before it is sent. Everything else
  (etapy one by one, other crews, Pozostało) stays in his rozpiska, linked as „Moja rozpiska” in the
  header. The per-etap „Wcześniej” / „Pozostało” columns were built and dropped the same day.
- The dialog's global „Zaznacz wszystkie” was dropped: each table's header checkbox already does it.

### Spike: second layout — report typed into the rozpiska grid (2026-09-30)

`?widok=rozpiska` on the report link (switch „Lista / Rozpiska” in the header; both share the draft).
The worker's preview grid with one etap column editable and framed (`report-stage-column.ts`,
`.kosztorys-report-stage` in globals.css). He types the **etap total**; the draft stores only the
increase over what is booked, so send and review are unchanged — a total below the booked figure
leaves a negative and blocks the send. „Tylko opis i etap” leaves Opis prac + the etap (etap pinned
at 140px). No footer (owner): „Prace spoza rozpiski (n)” opens a dialog of inline rows, „Wyślij do
weryfikacji” sits in the stage bar. A half-filled extra row blocks the send; an untouched one is skipped.

## Spike: the etap choice moves to the kierownik (2026-09-30)

Owner ruling: the worker no longer picks an etap. He sees his existing etapy read-only and reports
into one extra column, „Zgłaszam” — how much he did since his last report, not an etap total. The
kierownik decides where it goes at verification: „Dodaj do” = a new etap, the latest one (default)
or any other. So a report carries no etap; its destination (`target`) is set on acceptance, with the
etap's label copied. The draft is one per worker instead of one per etap, and the list variant
follows the same semantics. „Szkic zapisuje się sam” is gone from both variants.

Grid mechanics: „Zgłaszam” rides the stage-qty field plumbing under stage id 0, which no etap can
hold, so the diff reports it like an etap edit while every Σ etapów — which iterates the real etapy
— never counts it into Pomiar (`editor/grid/report-column.ts`).

## Spike: rozpiska only (2026-09-30)

Owner ruling: the worker reports only in his rozpiska. The list variant (with its `?widok=` switch
and the „Moja rozpiska” link) is gone — the grid already shows Przedmiar and his etapy next to the
„Zgłaszam” column, so a second surface had nothing left to add.

## Spike closed (2026-09-30)

The owner has accepted the spike as done; the fixes below are carried into the real plan.

**Final shape of the report page.** The page scrolls, not the grid. The column headers stick to
the top.

- **„Ograniczona rozpiska”** fits the screen and cuts anything past its edge. The cut uses
  `overflow-x: clip`, not `auto`, because a scroller would un-stick the header.
- **„Wszystkie kolumny”** is wider than a phone, so the page scrolls sideways.
- **dsg only draws the columns inside its own box.** So the full report's box gets its column width
  up front: `gridMinWidth`, from `src/lib/kosztorys/grid-min-width.ts`.
- **Don't use `max-content` for that box.** dsg answers a box that fits with `width: 100%`. The two
  then resize each other in a loop, and the grid blinks.
- **Figures he can only read are grey**, so „Zgłaszam” is the one dark number.

**Owed to the real implementation (owner, 2026-09-30):**

- **„Ograniczona rozpiska”, 768px and up** (the `sm` break):
  - bring back the row number, i.e. the Lp gutter;
  - add j.m. next to Opis prac.

  A phone keeps only Opis prac + „Zgłaszam”.

- **Consider pulling the report out of the shared editor body** (owner). Today about a dozen
  `report` branches sit in `kosztorys-editor-body.tsx` and `use-kosztorys-editor.ts`. They are
  inert when `report` is absent, but each is one more special case in an already oversized module.
  One option is a report component that assembles the grid from shared parts.

### Decided with the owner after the spike (2026-09-30)

14. **A pending report whose rozpiska was replaced** (version restore, import, „Wczytaj szablon”,
    „Wyczyść kosztorys”) keeps its copied opis + j.m.; each line that lost its pozycja comes to the
    kierownik as „do przypisania ręcznie”. He picks a pozycja, with a suggestion by opis + j.m., or
    treats it as a praca spoza rozpiski. No stable ids.
15. **Where a kierownik learns of a report:** a „Zgłoszenia prac” entry in the main nav, with a
    count, listing pending reports across all investments. An entry opens that investment's
    rozpiska with the report open. The toolbar button inside the rozpiska stays.
16. **Where a report may be added:** a new etap, or an etap the reporting worker is assigned to.
    Never another crew's etap, which would put his work into their payout.
17. **„Nowy etap” at acceptance** takes the next etap number and is assigned to the reporting
    worker at a 100% share. Two workers accepted the same day get one new etap each.
18. **Two links stay separate.** His rozpiska link carries the summary and settlement; the report
    link only collects quantities. This confirms #12; the spike's grid reuse is a rendering choice,
    not a merged surface.
19. **A sent report is final:** the worker can neither withdraw nor correct it. A correction is a
    new report, and the kierownik rejects the wrong one. The worker sees each report's status:
    czeka / przyjęte / odrzucone.
20. **A kierownik may still accept a report** after the worker was unassigned from his etapy or his
    link was revoked, because the work was done.

### Decided with the owner — persistence and access (2026-09-30)

21. **Who may report = who may hold his rozpiska link.** No etap, an etap without rozliczenie, or
    mixed rozliczenia show the same notice instead of the form; the kierownik sorts it out first. The
    report link is minted under the same refusal as the rozpiska link, so a worker with no etap never
    holds one; a link that outlives an unassignment shows the notice. „Nowy etap” at acceptance
    therefore always goes to a worker who already has an etap on this investment.
22. **Zgłaszanie on a zakończona inwestycja is blocked** (confirms the #20 recommendation). The
    investment lock gate refuses the send; reports sent before the close can still be decided.
23. **The szkic stays in the browser** (`localStorage`, keyed by investment + worker). Only sent
    reports go to the database. Losing an unsent szkic to a phone swap is accepted — a report is a
    dozen-odd lines typed in one sitting. Moving it server-side later is a self-contained change.
24. **A szkic line whose pozycja vanished** (version restore, import, „Wczytaj szablon”, „Wyczyść
    kosztorys”) is dropped when the page loads, with a notice „N pozycji ze szkicu zniknęło z
    rozpiski”. Sent reports keep #14's „do przypisania ręcznie”.
25. **Acceptance happens inside the rozpiska.** The accepting window patches its own etap figures and
    drops its undo history for those cells; any other open window reloads rather than overwrite the
    accepted amount.
26. **A decision can be changed** (supersedes „a decided report reopens read-only” from spike 2).
    An accepted line stays ticked and editable: a changed ilość moves the etap by the difference, an
    untick takes it back out. A rejected report — and a line left unticked — can still be accepted.
27. **While a line stays accepted, the rest goes into the same etap.** If that etap was deleted or
    the worker is no longer in it, adding is refused until those lines are unticked — no migration
    of the old figures to a new etap.
28. **Report screens count „prace”**, not „pozycje”.
29. **The all-reports list is paginated and filtered like the other listings** — EX-955.

### Persistence and access — grounded (2026-09-30)

- **Two raw tables, no Payload collection** (precedent: `kosztorys_stage_workers`, `kosztorys_snapshots`):
  `worker_reports` (investment, worker, status pending/accepted/rejected, sent_at, decided_at/by,
  target etap FK `ON DELETE SET NULL` + copied ordinal and label) and `worker_report_lines` (item FK
  `ON DELETE SET NULL` + copied opis / j.m. / sekcja, kind rozpiska|extra, reported qty, accepted qty
  — NULL on a decided report = rejected line, created-item and katalog FKs for extras). Index every
  FK into the tree: a 1000-item restore otherwise scans the lines table once per deleted item.
- **Report tables stay out of every tree writer** — the restore wipe, `insertKosztorysTree`, the
  snapshot format, szablon apply, the insert-schema-drift spec. They outlive a restore. Lesson 253
  gets updated: the report lines are the first outside referrer of an item id.
- **Deleting a worker** is refused while a report names him (a probe beside `countStageMemberships`).
- **The report link is its own collection, `worker-report-shares`**, mirroring
  `kosztorys-worker-shares` (no `kind` column — the token alone decides the view) and reusing
  `share-token.ts`. Reports key on investment + worker, never on the link row, so revoke/rotate never
  touches them.
- **`tokenAction`** beside `protectedAction`: uncached token lookup → investment lock gate → worker
  still active with a ready scope → every pozycja belongs to this investment. The kierownik's side
  stays on `investmentAction` and does not re-check the worker (#20). `src/proxy.ts` must allowlist
  the report route, or its Server Action is redirected to login.
- **Nav „Zgłoszenia prac”** counts pending reports (a queue, not an unread cursor). Path
  `/zgloszenia-prac` (owner, 2026-09-30); it would zero the leads badge because `unread-badge.tsx`
  matches a bare prefix, so the badge match takes the same `${href}/` boundary as `isActiveLink`. Deep link `…/kosztorys_v2?zgloszenie=<id>`, no precedent in the app; the dialog
  toggle moves into `KosztorysActionsProvider` so toolbar button, menu and deep link share it.
- **Report reads are uncached.** Acceptance expires `stageProgress` (+ `kosztorysStages` /
  `kosztorysItems` when it creates them), which also refreshes the worker's rozpiska link. Rejecting expires only the investment's entity tag — nothing cached reads a report; the expiry
  is what re-renders the shell's nav badge.
