# Kosztorys Sync — Header-Driven Single-Table Design

> 2026-05-27. Supersedes the two-table (budowlane | wykończeniowe side-by-side)
> layout in `2026-05-26-kosztorys-template-formula-audit.md`. That wide layout
> baked the expense type into the column _structure_, so every new type meant new
> columns + new code. This replaces it.

## The model: one long table, located by header name

A single tab named **`wydatki inwestycyjne (tylko do odczytu)`** (the constant
`MATERIALY_TAB`), **one row per investment expense**, columns found by
**header text** (not by position):

```
id | data | typ wydatku inwestycyjnego | opis | kwota | kategoria | notatka
```

- **`id`** — the transferId; the reconciler's join key (one row per transaction).
- **`typ wydatku inwestycyjnego`** — the expense category name, copied as-is from
  the app (`Materiały budowlane`, `Materiały wykończeniowe`, `Pozostałe koszty`,
  …). This is the discriminator that used to be encoded in column position.
- The remaining fields are the expense's data; `kategoria` = the optional
  "Kategoria" (otherCategory), `notatka` = invoiceNote.

This is the **long / tidy** format (1NF): the type is a _value_, not a column
group. Adding a new expense type is a new row value — **zero code change**, and
it appears in the sheet automatically.

## How the code finds columns (schema-on-read)

On every sync the code reads the sheet, scans the top rows for the **header row**
(the first row containing all seven fields), and builds a `field → column` map by
**normalized keyword-contains** matching (trim + lowercase; e.g. "typ wydatku
inwestycyjnego" matches the `typ` keyword, "Kwota " matches `kwota`). Rows are
located by matching the transferId in the `id` column.

So column order, extra columns, and a summary block can all change without
touching code — the sync reflects on the live sheet each run. See
`src/lib/google/sheets.ts` (`resolveHeaders`, `appendMaterialRow`,
`readMaterialyTransferIds`). The app writes **only** the seven mapped cells via
`values.batchUpdate`; it never touches summary/other columns.

## ⚠️ The one thing that IS enforced: header names must stay recognizable

Header-driven trades _position_-coupling for _name_-coupling. The keywords must
survive in each header: **id, data, typ, opis, kwota, kategoria, notatka.**
Normalization absorbs trailing spaces and casing, and keyword-contains tolerates
extra words ("typ wydatku inwestycyjnego" is fine). But renaming a header beyond
its keyword — or a typo like "kwora" for "kwota" — breaks the lookup. The code
**fails loud**: it logs `materiały: header row not found …` and skips the write
rather than writing to the wrong column.

**Action:** put a visible warning in the sheet (e.g. a note on the header row or a
cell: "Nie zmieniaj nazw nagłówków — psuje to synchronizację z aplikacją").
Renaming headers is the one operation that silently (well, loudly in the log)
disables the sync.

## "Best of both worlds": no template enforcement

Because the app cares about **only the materiały tab** — and only its seven named
columns — we do **not** need to own or enforce a kosztorys template:

- A new investment can start from **any** existing sheet, or the team's real
  working kosztorys, or a blank file.
- The only requirement: it has a `materiały ` tab whose header row names the seven
  fields. The owner can lay out everything else (summary, other tabs, formatting)
  however they like.
- "We enforce only what needs enforcing" — the seven field headers — and leave the
  rest of the document free.

This also makes a **future two-way sync** more tractable: the materiały tab is a
clean, normalized, id-keyed table, so reading human edits back (and reconciling
them against the app) is a well-defined problem rather than parsing an arbitrary
layout. Not built yet — noted as a direction.

## Layout: data block + side summary

```
      A    B    C        D     E      F          G          H        I                   J                    K
row1: id   data typ...   opis  kwota  kategoria  notatka    RAZEM    Materiały budowlane Mat. wykończeniowe   Pozostałe koszty
row2: <expense>                                             =SUM     =SUMIF              =SUMIF               =SUMIF
row3: <expense>
```

- **Data block `A1:G`** — header row 1, expenses from row 2 down. A clean,
  contiguous table so Data → Create filter / sort-by-date works.
- **Summary immediately to the right, starting at column H** (no gap — RAZEM
  sits right after `notatka`; `SUMMARY_START_COL = 7`): a small 2-row table —
  type labels in row 1, each total **directly under** its label in row 2.
  `RAZEM = SUM(kwota)` and `=SUMIF(C2:C; <labelCell>; E2:E)` per type. A 4th
  type → one more column (or a dynamic `QUERY`).

Written **once** by `setupMaterialyTab`; the row-sync never touches the summary.

**Filter trade-off (intentional):** the totals are in **row 2**, the first data
row. A basic filter hides whole rows, so a date-filter that excludes row 2 also
_visually_ hides the totals (the values stay correct — SUMIF ignores hidden
rows). Putting labels+totals in row 1 only, or on a separate tab, would be
fully filter-proof; row-2 was the owner's explicit layout choice.

## Per-type color (readability)

Each expense type is branded with one color, used **identically** in two places so
they visibly match:

- **Whole data row** — tinted via a per-type **conditional-format rule**
  (`=$C2=$<labelCell>`), so the color auto-applies to every row the sync appends
  later (the sync stays data-only, never writes formatting).
- **Summary swatch** — that type's label + total cell get the **same** tint, bold.

Colors come from a name-keyed map in `sheets.ts` (`TYPE_COLORS`), **not** a DB
column — deliberately, to avoid a migration. A type not in the map falls back to
gray (`FALLBACK_COLOR`); it still appears, just uncolored until a hex is added
(one-line edit). Trade-off: this re-introduces a small "new type → code touch"
for color only (the row/summary still work with the gray fallback with zero code
change). Header row is frozen, dark, bold-white; `kwota` and totals use a Polish
currency number format; totals are bold.

## Setup: attaching the expenses tab (approach A)

On a **personal Google account the service account cannot create a new file**
(no Drive quota → `403`). It _can_ add a tab to an existing sheet. So the app
provisions by **attaching** the `wydatki inwestycyjne (tylko do odczytu)` tab to a
sheet the owner has linked, rather than creating a file. (True new-file creation
needs Workspace + a Shared Drive — that's R1 below.)

- `setupMaterialyTab(spreadsheetId, expenseTypes)` in `src/lib/google/sheets.ts`
  — adds the expenses tab if missing (tab name = `MATERIALY_TAB`), then writes the
  header row (`A1:G1`) and the side summary (labels in row 1 from column H, totals
  beneath in row 2) plus all formatting. **Re-running clears the whole tab**
  (`clear(A1:Z1000)`) — deliberately destructive of data rows: the owner re-syncs
  afterward, and the resync re-appends every row with the _current_ category
  names. That resync is what **heals a renamed type** — stale `typ` strings can't
  linger to break the per-type SUMIF totals or the row coloring. The app builds
  the tab; the owner builds nothing.
  ⚠️ The tab is matched by exact title, so **renaming `MATERIALY_TAB` strands any
  sheet already provisioned under the old name** (setup creates a fresh empty tab;
  sync duplicates rows into it). During testing this is a non-issue — existing
  sheets are disposable, so just rename the tab by hand or re-provision. A real
  rename migration is only needed once there is production data to preserve.
  The tab is also written **read-only**: `setupMaterialyTab` adds a Sheets
  **protected range** over the whole tab with editors restricted to the service
  account (description "Tylko do odczytu — synchronizowane z aplikacją"), dropping
  any prior protection on re-run. The service account writes through it; team
  collaborators get a read-only tab. Caveat: a protected range **cannot lock out
  the file owner** (Google auto-adds the owner as an editor) — full lockout needs
  the service-account-owned / Shared-Drive setup (R1). The "(tylko do odczytu)" in
  the tab _name_ is the human-facing signal; the protected range is the teeth.
- `setupKosztorysSheetAction(investmentId)` in `src/lib/actions/investments.ts`
  — reads the investment's `googleSheetId` and the live expense-category names,
  then calls the above.

### Kosztorys-page toolbar (two buttons, two intents)

- **"Zresetuj zakładkę materiały"** → confirmation dialog (it's destructive: a
  full tab clear + re-write). The dialog spells out what happens — headers,
  per-type summary, colors, read-only lock; existing rows are re-created by the
  follow-up sync. Calls `setupKosztorysSheetAction`.
- **"Synchronizuj wydatki inwestycyjne"** → `previewMaterialSync`, then a dialog
  that explains the **append-only** nature ("dodane zostaną nowe wydatki…, nic nie
  jest usuwane ani nadpisywane") and lists the rows to add, confirmed with "Dodaj
  do arkusza". Non-destructive, so it shows a preview rather than a warning.
- If the tab is missing, the sync surfaces a friendly message
  (`Arkusz nie ma karty „…". Kliknij „Zresetuj zakładkę materiały"…`) instead of
  Google's raw "Unable to parse range".

### Implementation notes (gotchas worth keeping)

- **Polish-locale formula separator.** Sheets in `pl_PL` locale use `;` as the
  function argument separator, not `,`. `=SUMIF(C6:C, A2, E6:E)` returns
  `#ERROR!`; it must be `=SUMIF(C6:C; A2; E6:E)`. Any formula the app writes must
  use `;`. (The sync writes only data, not formulas, so only `setupMaterialyTab`
  is affected today.)
- **SUMIF references the label cell, not a string literal.** Each per-type total
  is `=SUMIF(C2:C; <labelCell>1; E2:E)` where the label cell (I1/J1/K1…) holds
  the type name.
  This solves two things: (1) **maintainability** — the type name lives in one
  place (the visible label), edit it once; (2) **correct matching** — the SUMIF
  criterion is the _exact same value_ shown as the label, so a hidden literal
  can't drift from the displayed name.

## Final product requirements (target state — not yet built)

> Captured 2026-05-27 mid-build. These define the finished product; the current
> code only implements the materiały-tab sync above. Listed here so the half-built
> state stays honest and the remaining scope is explicit.

### R1 — Google Drive-backed template management (hard requirement)

A fully connected, functional Drive integration so template handling lives in the
app, not in manual sheet-copying.

- **Browse/select templates** — users pick from a library of existing kosztorys
  templates surfaced in the app.
- **Create template + set default** — users can save a new template and mark one
  as the _default_, used automatically when creating an investment.
- **Per-investment choice** — at investment creation, the user chooses the default
  template _or_ any other; the app then **copies it and appends a `materiały ` tab**
  to the copy. The appended tab carries the seven named headers the sync needs.

**Decided:** the app (service account) **owns** the files — clean permissions,
no dependence on a human's Drive, every sync authenticates as the service account
against files it owns. The owner gets a shared link per investment.

> ### ⚠️ FLAG — a service account has no usable Drive quota of its own
>
> Since Google's 2022 change, files a service account creates in its _own_ My
> Drive count against a tiny quota it **cannot expand or buy** → "storage quota
> exceeded" once enough investments accumulate. So "service-account-owned" needs a
> real home. The one fact that decides it: **Workspace vs. consumer Google
> account** — Shared Drives and impersonation exist only on Workspace.
>
> 1. **Shared Drive (Workspace).** Files live in a Shared Drive; storage counts
>    against the _org's_ pooled quota, not the SA. SA is added as a member. The
>    team sees the files natively. → **the chosen path.**
> 2. **Domain-wide delegation / impersonation (Workspace).** SA impersonates a
>    Workspace user; files owned by that user. More power than we need.
> 3. **SA's own My Drive (consumer).** Quota wall — demo/PoC only, not the product.
> 4. **Human owns, SA is editor (consumer fallback).** Reintroduces dependence on
>    a person's Drive; escape hatch only.
>
> **Resolution (phased, decided 2026-05-27):** R1 needs Workspace + a Shared
> Drive (option 1) — that's the eventual target. But we **start _without_
> connecting Workspace**, continuing the current personal-account setup (option 4
> / the "attach a materiały tab to an owner-linked sheet" PoC). We ship and
> validate the _sync_ on a personal account first, then adopt Workspace + Shared
> Drive when we actually take on R1 (app-owned templates + automated file
> creation). Rationale: the sync — the valuable part — works on a personal
> account today; Workspace is only required for the ownership/provisioning half,
> so we defer that cost until R1 is real.

Open questions (not blocking capture):

- "Default" scoped per-company/global, or per-user?
- Copy semantics: copy the whole file then append the tab, vs. a blank file + tab?
- What if a chosen template _already_ has a `materiały ` tab — skip, replace, or fail?

## Cancellation: append-only reversing entries (built)

A cancelled expense is **never erased**. When `cancelTransferAction` creates the
CANCELLATION audit transaction, it fires `syncSingleTransferToSheet` with that
cancellation's **own id**; the sync resolves the original expense and appends a
new row with the **negative** amount, the original's `typ`, and
`opis = "Anulowanie #<originalId>"`. The original `+` row stays; the `−` row
nets it out, so `SUM`/`SUMIF` totals self-correct and the full audit trail is
preserved on the sheet.

Consequences of going append-only (all done):

- **`deleteMaterialRowByTransferId` is gone** — the app never mutates or deletes
  an existing row, only appends. No row-shifting, no risk to the summary.
- **No `intent` on `syncSingleTransferToSheet`** — it's append-only; an
  `INVESTMENT_EXPENSE` appends `+`, a `CANCELLATION` appends `−`, anything else
  is ignored.
- **Reconciler is append-only too** — `previewMaterialSync` returns just
  `toAppend` (app rows missing from the sheet). `toDelete` and the `orphans`
  category are removed: nothing is deleted, and a sheet row the app doesn't
  recognise is the owner's own data, left untouched. `loadAppMaterialRows`
  expects both the expense (`+`) and its cancellation (`−`) rows, so a synced
  ledger and the DB agree. The reconcile button is **"Synchronizuj wydatki inwestycyjne"**.

> The reconciler's `loadAppMaterialRows` does a two-step query — investment
> expenses, then the CANCELLATION rows pointing at them — because a CANCELLATION
> transaction carries no `investment` field, only `cancelledTransaction`.
