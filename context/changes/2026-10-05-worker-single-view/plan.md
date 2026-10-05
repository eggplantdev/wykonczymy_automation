# One worker view — „Zgłoszenie prac" absorbs `/p` Implementation Plan

## Overview

Make the report link (`/zgloszenie-prac/<name>/<token>`) the worker's only view. It gets the existing
„Podsumowanie" button and panel showing `WorkerSummary`. „Podgląd pracownika" renders the same view
read-only. The `/p` link and all its plumbing go: the route, the `rozpiska` link kind, the
`kosztorys-worker-shares` collection, and the second menu item per worker. Decisions are in
`change.md` („Decided with the owner"); Linear EX-966.

## Current State Analysis

- Both worker screens already render through `KosztorysEditorBody`. The report view with
  „Wszystkie kolumny" on is `/p`'s grid plus „Czeka"/„Zgłaszam". What it lacks is the summary panel
  and its toggle.
- The report page already loads the worker's figures. `getWorkerReportPage` →
  `getWorkerKosztorysByReportShare` → `withWorkerSettings` (`src/lib/queries/worker-kosztorys.ts:161`)
  returns `document.worker.summary`, and `report-grid.tsx` already passes `worker={document.worker}`.
  No new data or cache tags are needed.
- The panel is gated off in report mode:
  `worker && !report && subtotals.length > 0` (`kosztorys-editor-body.tsx:685`). The toggle
  (`KosztorysTotalsPanelToggle`) is mounted only by `PreviewHeaderActions`, which the report header
  does not render.
- In report mode the page scrolls instead of the grid (`pageScroll`, `kosztorys-editor-body.tsx:251`).
  The overlay's container (`relative flex min-h-0 flex-1`, line 540) is then as tall as the whole
  rozpiska, so `TotalsPanelOverlay`'s `absolute bottom-0 … h-full` spans the full page height, and
  the toggle in the header scrolls away with the page.
- „Podgląd pracownika" (`(share)/podglad-pracownika/[worker]/[id]/page.tsx`) renders
  `WorkerKosztorysPage`. That component is shared with `/p`, has no report mode and no
  `TranslationsProvider`, and is keyed by session (`getWorkerKosztorysPreview`), not by a token.
- The report form needs a token in two places: `SendBar` → `sendWorkerReportAction(token, …)`, and
  `useReportDraft` → localStorage `worker-report-draft:${investmentId}:${workerId}`.
  `TranslationsProvider` stores the language under `worker-report-lang:${workerId}`.
- The `/p` plumbing:
  - the route, plus the `/p/` entry in the `src/proxy.ts:17` allowlist;
  - `getWorkerKosztorysByToken` (`worker-kosztorys.ts:136`);
  - the `rozpiska` side of `worker-share-link-endpoint.ts`, `lib/actions/kosztorys-worker-share.ts`,
    `lib/kosztorys/share-token.ts` (the `ShareRowT` member, `workerShare()`, `WORKER_LINK_SHARES`),
    `workerShareUrl` (`name-slug.ts`) and `WorkerLinkKindT` (`worker-view/types.ts`);
  - `worker-actions.tsx` (`LINK_URL`, `holdersByKind`, `SHARE_MENU_LABEL`, icons), the share
    dialog's `LINK_KINDS`, and the menu's `(['rozpiska','report'] as const).map`
    (`kosztorys-workers-menu.tsx:67-92`);
  - `src/collections/kosztorys-worker-shares.ts` and its registration (`payload.config.ts:25,100`).

## Desired End State

- **The worker's report link.**
  - Shows a „Podsumowanie" button in its control bar.
  - The button opens the same panel `/p` had, with `WorkerSummary`, scoped to the visible viewport
    with the toggle reachable.
  - It works at 390px and on desktop, with the compact and the all-columns grid alike.
- **„Podgląd pracownika".**
  - Opens that same view behind the session: same header, grid, Podsumowanie and sent list.
  - Sending is off and nothing is written to the worker's draft key.
  - It works for a worker who has no report link.
- **The „Pracownicy" menu** offers one link per worker, „Link do zgłoszeń", next to Podgląd and the
  PDF.
- **`/p/<name>/<token>`** 404s. No code path names `kosztorys-worker-shares` or a `rozpiska` link
  kind. The `kosztorys_worker_shares` table stays in the DB until the parked DROP ships.

### Key Discoveries:

- `report-grid.tsx` passes `worker={document.worker}` already, so the summary data is in hand
  client-side.
- `TotalsPanelOverlay` and `KosztorysTotalsPanelToggle` share open state through
  `useTotalsPanelOpen(hasRows)`. Mounting both is the whole wiring; they bind to the same key.
- `withWorkerSettings` is the one builder behind the report share, Podgląd and `/p`. The privacy
  boundary („only his etapy") lives there, not in `/p`, which is why
  `worker-kosztorys-token.test.ts:96,105` move rather than die.
- `'rozpiska'` is also a `ReportLineKindT` (worker-report types and schemas, `send-bar.tsx`, the DB
  check constraint). That one is unrelated and stays.
- `context/foundation/lessons.md` (the DROP lesson) says to park a table DROP in a tracked issue and
  ship it after the deploy that stops reading it is live. AGENTS.md puts a destructive migration
  push-first, migrated by a human.

## What We're NOT Doing

- Translating `WorkerSummary` and the „Podsumowanie" label. Translations come after the shape
  (`change.md`). Both stay Polish for now on a translated page.
- Changing how the panel behaves: its default-open rule, its localStorage key, and its content stay
  as they are today.
- The worker PDF, which EX-949 rebuilds.
- A redirect from `/p`. The owner doesn't care about links already sent.
- Dropping the `kosztorys_worker_shares` table. That is parked in a Linear issue; see Migration Notes.
- An „Opcje" button.

## Implementation Approach

Three phases, each shippable on its own and each leaving the app working:

1. Add the panel to the report view.
2. Point Podgląd at the report view.
3. Delete `/p` and the `rozpiska` link kind, which nothing reaches once phase 2 is in.

## Critical Implementation Details

**Panel in page-scroll mode.** Reuse `TotalsPanelOverlay` and the toggle as they are. Only their
anchoring changes in report mode. The page-height container would make an `absolute h-full` panel
cover the whole rozpiska, including the portaled footer, with the toggle scrolled off. In report
mode the panel must therefore be pinned to the viewport, below a control bar that stays reachable
(e.g. the report's control bar becomes sticky and the panel is `fixed` under it). Owner editor and
investor preview anchoring is untouched; the change is gated on `report`.

**Preview must not touch the worker's state.** The owner opening Podgląd on a shared device must not
read or write `worker-report-draft:*`. The draft runs in memory only in preview, and the send
action is unreachable from the UI. `TranslationsProvider`'s `worker-report-lang:*` choice is
harmless to share and stays.

## Phase 1: Podsumowanie in the report view

### Overview

The report page shows the worker's summary through the existing panel and toggle.

### Changes Required:

#### 1. Lift the report-mode gate

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: Mount the worker's `TotalsPanelOverlay` + `WorkerSummary` in report mode too, anchored to
the viewport when `pageScroll` is on.

**Contract**: The condition at :685 drops `!report`. The overlay's anchoring is chosen by `pageScroll`,
either via a prop on `TotalsPanelOverlay` (e.g. `anchor: 'container' | 'viewport'`) or a wrapper,
whichever the implementer finds cleaner. Default behaviour for the other call sites is unchanged.

#### 2. Toggle in the report control bar

**File**: `src/components/kosztorys/worker-report/report-grid.tsx` (and `report-bar.tsx` if it needs a slot)

**Intent**: Mount `KosztorysTotalsPanelToggle hasRows` in the report's control bar beside the two
switches, so the panel is reachable. Keep the bar reachable while the panel is open (sticky in
report mode).

**Contract**: `ReportBar` gains an actions slot or the toggle goes into `chips`. `hasRows` matches
the overlay's (`subtotals.length > 0`), so both bind to the same key. The toggle is disabled on an
empty rozpiska, as in the client view.

#### 3. Fit at 390px

**File**: same as above

**Intent**: The button, the two switches and the search fit at 390px without horizontal page
scroll. `WorkerSummary` scrolls inside the panel.

**Contract**: No new breakpoints. `sm:` is the only mobile→desktop break (AGENTS.md).

### Success Criteria:

#### Automated Verification:

- A DOM spec renders the report-mode body with a worker and asserts the „Podsumowanie" button is
  present, and that clicking it shows the `WorkerSummary` content:
  `pnpm exec vitest run src/__tests__/components/kosztorys/editor/kosztorys-editor-body-report-summary.test.tsx`
- Existing panel/summary specs still pass:
  `pnpm exec vitest run src/__tests__/components/kosztorys/summary src/__tests__/components/kosztorys/editor/kosztorys-editor-body-report-language.test.tsx`

#### Manual Verification:

- On the worker's report link at 390px:
  - „Podsumowanie" opens and closes the worker's balance over the form;
  - the button stays reachable while the panel is open;
  - there is no horizontal page scroll.
- On desktop, with „Wszystkie kolumny" both on and off:
  - the panel covers the viewport, not the whole page;
  - the „Wyślij" footer is reachable once the panel is closed.
- The amounts in the panel match the worker's figures the owner sees for that investment.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do not
pause for per-phase manual confirmation.

---

## Phase 2: „Podgląd pracownika" renders the report view

### Overview

Podgląd shows exactly what the worker sees, read-only, keyed by session instead of token.

### Changes Required:

#### 1. Session-keyed page read

**File**: `src/lib/queries/worker-report-page.ts`

**Intent**: Extract the "ready" assembly into a shared builder, then add a management-only read
`getWorkerReportPreview(investmentId, workerId)`. It assembles the same shape from ids, needs no
share row, and skips `reportShareRefusal`, so the owner can preview a closed or link-less worker.

**Contract**: The builder fetches `withWorkerSettings`, `pendingQtyByItem`, `listWorkerReports` and
`getSectionTranslations`, and returns `WorkerReportPageT`. A `blocked` document still maps to its
notice. The preview read `requireAuth(MANAGEMENT_ROLES)`s like `getWorkerKosztorysPreview`, with
language `DEFAULT_LANGUAGE`.

#### 2. Preview mode on the form

**Files**: `worker-report-form.tsx`, `report-grid.tsx`, `send-bar.tsx`, `use-report-draft.ts`

**Intent**: The form takes either a token (the live link) or preview mode. In preview the send
button is not rendered and the draft is in-memory only.

**Contract**: The form props carry `token: string | null` (or a discriminated `mode`). With no token,
`SendBar` is not mounted. `useReportDraft` accepts a null key, meaning no localStorage read or write.
„Dodaj inne prace" stays usable in memory so the owner sees the worker's whole surface.

#### 3. Point the route at it

**File**: `src/app/(share)/podglad-pracownika/[worker]/[id]/page.tsx`

**Intent**: Render `TranslationsProvider` + `WorkerReportForm` (or `ReportNotice`) from the
preview read, mirroring the report page.

**Contract**: Same route, same guard via `requireInvestmentOr404`. `WorkerKosztorysPage` loses this
consumer; `/p` is its last, and phase 3 deletes both.

### Success Criteria:

#### Automated Verification:

- A DOM spec on `WorkerReportForm` in preview mode asserts no „Wyślij" button and no
  `localStorage.setItem` for a `worker-report-draft:` key after typing a quantity:
  `pnpm exec vitest run src/__tests__/components/kosztorys/worker-report/worker-report-form-preview.test.tsx`
- `use-report-draft` keeps its contract with a key and gains a null-key case:
  `pnpm exec vitest run src/__tests__/components/kosztorys/worker-report/use-report-draft.test.tsx`

#### Manual Verification:

- „Podgląd pracownika" from the editor's „Pracownicy" menu shows the worker's report view, with the
  header, grid, Podsumowanie and sent reports. There is no „Wyślij".
- Typing a quantity in Podgląd, then opening the worker's real link in the same browser, shows no
  leftover draft.
- Podgląd works for a worker who has never had a report link generated.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Remove `/p` and the `rozpiska` link kind

### Overview

Delete everything only `/p` used. The menu offers one link per worker.

### Changes Required:

#### 1. Route and page

**Files**:

- delete `src/app/(share)/p/[name]/[token]/page.tsx`;
- delete `src/components/kosztorys/worker-view/worker-kosztorys-page.tsx`;
- `src/proxy.ts`: remove the `/p/` allowlist entry.

**Intent**: `/p/*` is no longer public and resolves to the not-found page.

#### 2. Token plumbing

**Files**:

- `src/lib/queries/worker-kosztorys.ts`: delete `getWorkerKosztorysByToken`;
- `src/lib/queries/worker-share-link-endpoint.ts`;
- `src/lib/actions/kosztorys-worker-share.ts`;
- `src/lib/kosztorys/share-token.ts`;
- `src/lib/kosztorys/worker-view/name-slug.ts`: delete `workerShareUrl`;
- `src/lib/kosztorys/worker-view/types.ts`: delete `WorkerLinkKindT`;
- `src/lib/kosztorys/worker-view/assigned-workers.ts`: update the comment.

**Intent**: Drop the kind parameter. Worker link actions, holders and token reads speak only of the
report share.

**Contract**:

- `generateWorkerLinkAction` / `revokeWorkerLinkAction` / ensure take no kind.
- Holders return one id set.
- The `kosztorys-worker-shares` `ShareRowT` member and `WORKER_LINK_SHARES` go.
- The generic share-token helpers and `ShareLinkPanel` stay.

#### 3. Editor UI

**Files**: `kosztorys-workers-menu.tsx`, `worker-actions.tsx`, `kosztorys-worker-share-dialog.tsx`

**Intent**: One „Link do zgłoszeń" item per worker. The dialog keeps the report copy only.

**Contract**: `LINK_KINDS` collapses to the report entry, and `target.kind` disappears from the
share target.

#### 4. Collection

**Files**: delete `src/collections/kosztorys-worker-shares.ts`; `src/payload.config.ts:25,100`;
`src/collections/worker-report-shares.ts:5` (comment); then run `pnpm generate:types`.

**Intent**: Payload stops knowing the collection. The table stays until the parked DROP.

#### 5. Tests

**Files**:

- `src/__tests__/lib/queries/worker-kosztorys-token.test.ts`: port the two privacy cases (:96, :105)
  onto `getWorkerKosztorysByReportShare` in a report-share spec, then delete the `/p`-specific cases
  and the file;
- `src/__tests__/lib/actions/worker-share-token.test.ts`: retarget onto the report share; no other
  spec covers that action;
- `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`: one
  link item, no `/p` URLs;
- `src/__tests__/proxy.test.ts`: `/p/` is no longer public.

**Intent**: Nothing is lost that guarded the shared builder or the link action.

#### 6. Docs and comments

**Files**:

- `context/reference/kosztorys-editor-domain-notes.md` (the `/p` and two-link passages);
- `context/foundation/manual-checks.md` (checks that drive `/p`);
- comments that point at `/p`: the zgloszenie-prac page :21, the podglad-pracownika page, the print
  endpoint :7 and `summary.ts:121`.

**Intent**: No living doc describes `/p` as current. The archived history stays as is.

### Success Criteria:

#### Automated Verification:

- `rg -n "kosztorys-worker-shares|workerShareUrl|WorkerLinkKindT|getWorkerKosztorysByToken" src`
  returns nothing outside `src/migrations`.
- Ported and updated specs pass:
  `pnpm exec vitest run src/__tests__/lib/actions/worker-share-token.test.ts src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx src/__tests__/proxy.test.ts`
- The ported privacy cases pass against the 5435 test DB:
  `pnpm exec vitest run src/__tests__/lib/queries/worker-kosztorys-report-share.test.ts`

#### Manual Verification:

- The „Pracownicy" menu shows, per worker, Podgląd, „Link do zgłoszeń" and the PDF, and nothing else.
- An old `/p/<name>/<token>` URL shows the not-found page.
- Generating and revoking „Link do zgłoszeń" from the dialog still works.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Testing Strategy

### Unit / DOM Tests:

- Report-mode body: the Podsumowanie toggle is present, and the panel shows the worker summary.
- Preview-mode form: no send button, and no draft persistence.
- `useReportDraft` with a null key.
- The workers menu: one link per worker.

### Integration Tests:

- Worker privacy (his etapy only; other crews' execution counts toward „Pozostało"), ported onto the
  report-share read.
- The worker link action (generate / revoke / ensure) on the report share.

### E2E:

The report page is a browser-level surface. Author an E2E at the review gate (the Podsumowanie panel
at 390px, plus Podgląd with no send), or defer it to an `e2e-backlog` issue.

## Migration Notes

There is no migration in this change. The `kosztorys_worker_shares` table, its indexes and
`payload_locked_documents_rels.kosztorys_worker_shares_id` stay in the DB, unread.

At implementation, park the DROP in a Linear issue under „Wykonczymy":

- it is written as a hand-made migration modelled on the `down()` of
  `20260720_0_add_kosztorys_shares.ts`;
- it ships only after the deploy that stops reading the table is live;
- a human applies it with `pnpm db:migrate:prod`.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- Full unit + integration suite only when the user asks; touched specs are listed per phase.

## References

- `change.md`, „Decided with the owner (2026-10-05)"
- Linear EX-966 (umbrella EX-946; precedes EX-949)
- Report page: `src/app/(share)/zgloszenie-prac/[name]/[token]/page.tsx`
- Panel: `src/components/kosztorys/summary/totals-panel-overlay.tsx`,
  `kosztorys-totals-panel-toggle.tsx`
- Gate: `src/components/kosztorys/editor/kosztorys-editor-body.tsx:685`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Podsumowanie in the report view

#### Automated

- [x] 1.1 Report-mode body spec: Podsumowanie toggle opens WorkerSummary
- [x] 1.2 Existing panel/summary specs still pass

### Phase 2: „Podgląd pracownika" renders the report view

#### Automated

- [ ] 2.1 Preview-mode form spec: no send button, no draft persistence
- [ ] 2.2 use-report-draft spec covers the null key

### Phase 3: Remove /p and the rozpiska link kind

#### Automated

- [ ] 3.1 No reference to the removed symbols outside migrations
- [ ] 3.2 Updated action, menu and proxy specs pass
- [ ] 3.3 Ported privacy cases pass on the report-share read
