---
change_id: worker-report-scan
title: A photo of a worker's filled-in paper becomes a zgłoszenie prac via AI (EX-949)
status: preparing
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: null
worktree: null
---

## Notes

worker-report-scan — EX-949: skan wypełnionej kartki pracownika (zdjęcie) → szkic zgłoszenia prac przez AI

Linear: **EX-949** under umbrella **EX-946** — slice 3 of the arc in
`context/archive/2026-09-30-worker-work-reports/change.md` § The arc. Blocked by **EX-992** (AI
translations, in progress); **EX-988** (PDF in the worker's language) is done.

### Decided with the owner (2026-10-05)

1. **Quantities, not hours.** The paper carries ilość per pozycja in its own j.m. — the same figure a
   zgłoszenie already records (owner ruling #1 of the arc). No hours model.
2. **Management only — two entry points, one action.** Only a kierownik scans a paper; the worker
   keeps reporting through his link as today (narrowed by the owner after research, 2026-10-05). A
   zgłoszenie is keyed by worker × investment (the etap is picked at acceptance), so both entry points
   feed the same scan → zgłoszenie path and differ only in what the context already knows:

   | Entry point                                  | Known up front | User picks              |
   | -------------------------------------------- | -------------- | ----------------------- |
   | „Zgłoszenia prac" listing — the primary home | —              | worker → investment     |
   | Kosztorys editor → Pracownicy menu           | investment     | worker (assigned to it) |

   **Not** from the worker's link `/z/…`, his own page, or the „Pracownicy" listing.

3. **No QR code.** Its only job was identifying worker + etap from the paper, and every entry point
   knows that before the photo arrives. The header's worker and investment name (already printed
   today) are for people, not the AI: the read does not check them against the kierownik's choice —
   the worker × investment he picked is the whole identification (owner, 2026-10-05).
4. **Each printed row carries the pozycja's stable number plus a check digit — the number alone
   identifies it.** An ordinal shifts when a pozycja is added, removed or moved, and the database id
   is reminted by restore, sheet import, „Wczytaj szablon" and „Wyczyść" (one wipe-and-reinsert). So
   every pozycja gets its own **stable number** (amended with the owner, 2026-10-05):
   - a new column on `kosztorys_items`, filled from its own sequence by default; existing pozycje
     start at number = id;
   - restore writes it back from the snapshot; sheet import carries it to the matching pozycja by the
     key that already carries notes and translations, and mints a new one otherwise;
   - „Wczytaj szablon", „Wyczyść" and copying a pozycja mint new numbers — that is new work.

   Printed small and grey with a **check digit** („35812-7"), so a misread digit is caught instead of
   landing on a neighbouring pozycja. Resolution is the number only:
   - valid check digit and a live pozycja in this rozpiska → assigned;
   - otherwise → „do przypisania ręcznie" (acceptance already refuses such a line until the kierownik
     re-points it or moves it to „spoza rozpiski", `accept-worker-report.ts`).

   **No text comparison** — neither opis nor j.m. is checked against the pozycja: the printout is in
   the worker's language, and a j.m. changed mid-execution is rare enough to leave to the kierownik.
   One unresolvable line never refuses the whole zgłoszenie. An unnumbered line becomes a „praca
   spoza rozpiski". Rejected: keeping 1, 2, 3 plus a stored snapshot of every print; the raw id
   checked by folded opis + j.m. in every language.

5. **The photo is stored with the zgłoszenie** and shown beside the lines in the verification dialog —
   the kierownik checks figures against the source.
6. **A scan goes straight to verification.** The kierownik is the reviewer — a draft step would make
   him check twice. The zgłoszenie is created `pending` with the lines read, and he lands in its
   verification dialog.

7. **Only our printout.** A notebook page or a worker's own list is out of scope — the scan relies on
   the printed numbers. Works from outside the rozpiska are handwritten on the same paper (the
   PDF needs blank rows for them) and become „prace spoza rozpiski", as from the link.
8. **Several photos per zgłoszenie — one AI request per photo.** A 150-pozycja rozpiska prints on
   ~5–6 sheets plus one of blank rows. Each photo is read separately (one body under Vercel's 4.5 MB
   cap; a failed page retries alone) and the rows are joined into one zgłoszenie. Each row carries
   its own number, so page order is irrelevant. A pozycja appears once per print, so the same number
   read on two pages means a page photographed twice or two different prints — flag it for the
   kierownik, never sum it. Cap: 12 photos per scan.
9. **A scanned zgłoszenie stays off the worker's link.** His history on `/z/…` lists only what he
   sent himself; one filed by a kierownik from paper does not appear there. Today that history lists
   every report for the worker × investment pair (`listWorkerReports`), so a report has to record
   that it came from a scan, and the `/z/` query filters on it.
10. **One printout = one zgłoszenie.** A filled paper is handed in and the worker gets a new printout
    for the next period, so every number on it is work done since the last paper — the same meaning
    as „Zgłaszam" on the link. A paper is never re-photographed with numbers added over time.
11. **An unclear number goes in as the AI's best guess, flagged „niepewny odczyt"** — the kierownik
    corrects the ilość beside the photo.
12. **A praca spoza rozpiski's j.m. must be one from the kosztorys's list.** If the handwritten one
    fits none, the line comes in without a j.m., flagged; the kierownik assigns a katalog praca
    (which brings its j.m.) or rejects the line.
13. **A separate „Drukuj do wypełnienia" item** in the Pracownicy menu prints the form: id, opis,
    j.m., an empty „Wykonano" column and blank rows for prace spoza rozpiski — no money, no etapy.
    The existing „Drukuj PDF" stays as it is.
14. **Every page prints „Strona X/Y"** and the AI reads it with the rows. A page that was never
    photographed would otherwise be invisible — its pozycje simply arrive unreported — so
    verification warns „brak strony 4 z 6" (owner, 2026-10-05).

### Reuse

- The receipt reader (`src/lib/ai/openrouter.ts`, `generateObject` over OpenRouter, image + PDF,
  timeout + model fallback, `MAX_RECEIPT_PAGES`) is the vision path — EX-949 adds a schema + prompt,
  not AI infrastructure.
- Translating Ukrainian free text from the scan: already wired — every sent report runs
  `after(translateReportExtras)` (`src/lib/ai/translate.ts`, EX-992), so the read returns extras
  verbatim. The arc's "only in-app AI" line predates ai-translations and is stale.
