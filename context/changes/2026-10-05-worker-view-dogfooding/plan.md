# Worker view dogfooding — Implementation Plan

## Overview

Close out the dogfooding pass over the single worker view (EX-966). The visual changes (notes 2 and
4–7 in `change.md`) already sit uncommitted in the tree. Three things remain:

1. Move the worker link to `/z/<inwestycja>/<pracownik>/<token>` (note 1).
2. Bring the specs back to green and cover the new behaviour.
3. Bring the docs and the manual checks in line with what the page now does.

## Current State Analysis

- The worker link is built in one place: `workerReportShareUrl(origin, name, token)`
  (`src/lib/kosztorys/worker-view/name-slug.ts:31`). It returns `/zgloszenie-prac/<worker-slug>/<token>`.
- It has two callers, and both already read the editor context:
  - `editor/actions/worker-actions.tsx:115` — the copy-on-click in „Pracownicy”;
  - `editor/dialogs/share/kosztorys-worker-share-dialog.tsx:38` — the „Link do zgłoszeń” dialog.
- `KosztorysEditorContextT` already carries `investmentName` (`use-kosztorys-editor-context.tsx:16`),
  so no new data has to be threaded in.
- The page lives in `src/app/(share)/zgloszenie-prac/[name]/[token]/page.tsx`:
  - only the token resolves the page; the name segment is decoration;
  - it calls `notFound()` on an unknown token;
  - it exports `viewport = REPORT_VIEWPORT`.
- `src/proxy.ts` whitelists `/zgloszenie-prac/` as a session-free share prefix. The send Server
  Action POSTs to the same URL, so the whitelist also covers sending (see `proxy.test.ts`).
- No route under `src/app/**` claims `/z`, so there is no collision.
- Running the worker-view specs gives 10 red tests:
  - `worker-summary.test.tsx` (8): the helpers query the old grid DOM (`div.grid` / `div.contents`),
    but the rozliczenie is now `<table>`s.
  - `worker-report-form.test.tsx` (2): „opens and closes his own balance from the report bar” and
    „the preview has no „Wyślij”…”. Both describe the „Podsumowanie” panel that was removed.
- `context/foundation/manual-checks.md` § EX-966 has two stale boxes: the 390px „Podsumowanie”
  panel, and the desktop box that mentions „Wszystkie kolumny”.
- `context/reference/kosztorys-editor-domain-notes.md` still describes the old URL (~l.377) and the
  „Podsumowanie” button (~l.431).

## Desired End State

- „Link do zgłoszeń” copies and shows `https://…/z/<inwestycja-slug>/<pracownik-slug>/<token>`.
- That link opens the report page without a session, and „Wyślij” works from it.
- `/zgloszenie-prac/…` returns 404. This is the owner's decision: links already in workers' hands
  stop working, and the owner resends them.
- The owner's „Podgląd pracownika” (`/podglad-pracownika/…`) is unchanged.
- All worker-view specs are green, and new DOM specs pin:
  - the mode switch;
  - qty surviving a mode switch;
  - the „Tylko zgłaszane przeze mnie (N)” and „Wyślij (N)” counters.
- Domain notes and manual checks describe the footer modes and the new URL.

### Key Discoveries:

- The slug helper is worker-named but generic. Reusing it for the investment name means renaming
  it to a neutral name (`nameSlug`) and dropping the worker wording from its doc comment. It has
  three call sites in total.
- The `-` fallback for an empty slug already exists for the worker segment. The investment segment
  gets the same fallback, so the URL never has an empty segment.
- The two `usePathname` mocks in DOM specs (`/zgloszenie-prac/jan/token`) are cosmetic. Update them
  anyway so a grep for the old prefix comes back empty.

## What We're NOT Doing

- No redirect from `/zgloszenie-prac/…`, no compatibility shim, no token migration. Tokens are
  unchanged; only the path shape moves.
- The owner's „Podgląd pracownika” URL is not touched.
- No change to the investor link `/k/<token>`.
- No running of the E2E suite. `e2e/share-unknown-token.spec.ts` gets its path edited only.
- No uk/ru rewording of „Tylko zgłaszane przeze mnie”. It is open with the owner; the current
  „Лише заявлені” / „Только заявленные” stay.

## Implementation Approach

The route move is mechanical: the page goes one directory deeper and ignores both decorative
segments. The builder's signature gains the investment name, which makes the compiler find every
caller. The specs follow the UI that already exists; they don't drive any new UI.

## Critical Implementation Details

- **Proxy and send.** The send is a Server Action POST to the page's own path. If that path is not
  whitelisted, the proxy bounces the POST to login and the send fails silently. Change the prefix
  and its `proxy.test.ts` case together.
- **Prefix collision.** Match `'/z/'`, with the trailing slash. Without it, any future `/z…` route
  becomes public.

## Phase 1: The `/z/` worker link

### Overview

Move the page, switch the proxy prefix, and build the new URL with the investment name.

### Changes Required:

#### 1. Route

**Files**:

- `src/app/(share)/z/[investment]/[name]/[token]/page.tsx` (new, moved)
- `src/app/(share)/zgloszenie-prac/` (deleted)

**Intent**: Move the page unchanged, apart from its params type. `[investment]` and `[name]` are
read by nothing.

**Contract**: `params: Promise<{ investment: string; name: string; token: string }>`. The token is
the only thing that resolves the page. `generateMetadata`, `viewport` and `notFound()` behave as
before.

#### 2. Proxy

**File**: `src/proxy.ts`

**Intent**: Swap the `/zgloszenie-prac/` share prefix for `/z/`.

**Contract**: `isSharePage = pathname.startsWith('/k/') || pathname.startsWith('/z/')`. Update the
comment above it if it names the old path.

#### 3. Link builder

**File**: `src/lib/kosztorys/worker-view/name-slug.ts`

**Intent**: Rename `workerNameSlug` to `nameSlug` (generic, with a neutral doc comment). The
builder takes the investment name.

**Contract**: `workerReportShareUrl(origin, investmentName, workerName, token)` →
`${origin}/z/${nameSlug(investmentName) || '-'}/${nameSlug(workerName) || '-'}/${token}`.
`workerPreviewSegment` uses `nameSlug`.

#### 4. Callers

**Files**:

- `src/components/kosztorys/editor/actions/worker-actions.tsx`
- `src/components/kosztorys/editor/dialogs/share/kosztorys-worker-share-dialog.tsx`

**Intent**: Pass `investmentName` from `useKosztorysEditorContext()`.

#### 5. Specs and E2E paths

**Files**:

- `src/__tests__/proxy.test.ts`
- `src/__tests__/lib/kosztorys/worker-view/name-slug.test.ts`
- `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`
- `src/__tests__/components/kosztorys/worker-report/worker-report-form.test.tsx`
- `src/__tests__/components/kosztorys/editor/kosztorys-editor-body-report-language.test.tsx`
- `e2e/share-unknown-token.spec.ts`

**Intent**:

- **proxy.test.ts**: reaching `/z/Inwestycja/Nikolajewicz/abc-DEF_123` needs no session;
  `/zgloszenie-prac/…` does (the old prefix is gone).
- **name-slug.test.ts**:
  - the builder produces the four-segment URL;
  - an empty investment name falls back to `-`;
  - rename `workerNameSlug` → `nameSlug`.
- **kosztorys-workers-menu.test.tsx**: expect `/z/<investment-slug>/Anna-Nowak/tok-anna`.
- **worker-report-form.test.tsx** and **kosztorys-editor-body-report-language.test.tsx**: update the
  two `usePathname` mocks.
- **share-unknown-token.spec.ts**: the E2E path becomes `/z/-/Nikt/revoked-token-…`.

### Success Criteria:

#### Automated Verification:

- Phase specs pass: `pnpm exec vitest run src/__tests__/proxy.test.ts src/__tests__/lib/kosztorys/worker-view/name-slug.test.ts src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu.test.tsx`
- No source reference to the old path is left: `grep -rn "zgloszenie-prac/" src e2e` returns nothing

#### Manual Verification:

- „Pracownicy” → „Link do zgłoszeń” copies `…/z/<inwestycja>/<pracownik>/<token>`, and the dialog shows the same URL.
- In a private window (no session), the copied link opens the report page, and „Wyślij” sends an
  entry. „Zgłoszenia prac” then shows it.
- The old `/zgloszenie-prac/<pracownik>/<token>` returns the „link nieaktywny” 404 page.
- An investment or worker whose name has only special characters gives a `-` segment, not an empty one.

**Implementation Note**: Commit and continue. Manual checks are collected at the end.

---

## Phase 2: DOM specs for the dogfooding UI

### Overview

Fix the 10 red tests and pin the new behaviour in jsdom.

### Changes Required:

#### 1. Rozliczenie as tables

**File**: `src/__tests__/components/kosztorys/summary/blocks/worker-summary.test.tsx` (mirror the
source path; locate the existing spec)

**Intent**: Rewrite the cell-lookup helpers to read `table` / `tr` / `td`. The assertions (figures
per row) stay the same, because the content didn't change; only the markup did.

#### 2. Report form

**File**: `src/__tests__/components/kosztorys/worker-report/worker-report-form.test.tsx`

**Intent**:

- **Replace** the two stale tests:
  - **(a)** clicking „Inwestycja” in the footer shows „Twoje rozliczenie” and hides the „Zgłaszam”
    column and „Wyślij”. Clicking „Zgłaszam pracę” brings them back.
  - **(b)** the preview („Podgląd pracownika”) has no „Wyślij” in either mode and leaves the szkic
    alone.
- **Add**:
  - **(c)** a qty typed in „Zgłaszam” is still in the input after „Inwestycja” → „Zgłaszam pracę”;
  - **(d)** „Tylko zgłaszane przeze mnie (N)” and „Wyślij (N)” count live as qtys are typed and
    cleared, and a complete „Nowa praca” adds to „Wyślij (N)” only;
  - **(e)** „Wszystkie prace (+N)” shows the count of rows the owner's hide removes, and no counter
    when that count is 0.
- Assert what renders, not hook state.

### Success Criteria:

#### Automated Verification:

- Phase specs pass: `pnpm exec vitest run src/__tests__/components/kosztorys/summary src/__tests__/components/kosztorys/worker-report`
- No skipped or `.only` tests in the touched files

#### Manual Verification:

- (none beyond Phase 3; this phase is tests only)

**Implementation Note**: Commit and continue.

---

## Phase 3: Docs and manual checks

### Overview

Make the living docs and the registry describe the shipped page.

### Changes Required:

#### 1. Domain notes

**File**: `context/reference/kosztorys-editor-domain-notes.md`

**Intent**:

- Replace the URL with `/z/<inwestycja>/<pracownik>/<token>`, and say that `/zgloszenie-prac/…`
  links stopped working with no redirect (owner, 2026-10-05).
- Replace the „przycisk Podsumowanie” description with the footer switch: „Zgłaszam pracę” and
  „Inwestycja”, what each mode shows, the counters, and qty surviving a mode switch.

#### 2. Manual checks

**File**: `context/foundation/manual-checks.md`

**Intent**:

- Rewrite the two stale EX-966 boxes (the 390px „Podsumowanie” panel, „Wszystkie kolumny”) to the
  footer-mode behaviour.
- Add a `## 2026-10-05 — worker-view-dogfooding` section from this plan's Manual Verification
  bullets, plus:
  - the footer at 390px stays at the bottom while scrolling, and both buttons are the same width;
  - in „Inwestycja” at 390px the page doesn't zoom out, and the header and footer stay pinned when
    the table scrolls sideways;
  - the rozliczenie under the table reads like the PDF footer: no grid lines, right-aligned,
    „Pozostało do wypłaty” in bold;
  - there is no „Zgłoszenie wykonanych prac” title in the header.
- The file holds other agents' hunks. Edit only these sections.

#### 3. change.md

**File**: `context/changes/2026-10-05-worker-view-dogfooding/change.md`

**Intent**: Note 1 records the owner's decision: old links stop working, there is no redirect, and
the owner resends links.

### Success Criteria:

#### Automated Verification:

- `grep -n "zgloszenie-prac/" context/reference/kosztorys-editor-domain-notes.md` returns only the „przestały działać” mention

#### Manual Verification:

- (the registry section written here is the manual verification)

---

## Testing Strategy

### Unit Tests:

- `name-slug`: the four-segment URL, the `-` fallback for both segments, and diacritics (ł, ó) in the
  investment name.
- `proxy`: the `/z/` prefix is public, and the old prefix no longer is.

### Integration Tests:

- None. The DOM specs cover client behaviour. The route move has no DB surface beyond the token
  lookup, which is unchanged.

### Manual Testing Steps:

1. Copy a worker link from „Pracownicy”, open it in a private window, report a qty, and send it.
2. Open the old `/zgloszenie-prac/…` URL and expect a 404.
3. At 390px, switch modes and confirm qty survives, the footer stays, and the buttons are equal.

## Migration Notes

- No schema change.
- Deploy note: on release to production, every worker link already handed out returns 404. The
  owner resends the links from „Pracownicy” → „Link do zgłoszeń”; the token stays the same, so the
  new URL reuses it.

## Whole-tree Gate

- Type checking passes: `pnpm exec tsc --noEmit -p .`
- Lint passes on touched files: `pnpm exec eslint <touched files>`
- Worker-view related specs pass (no full suite unless asked)

## References

- `change.md` notes 1–7 (owner's dogfooding list)
- EX-966 commits: `a1bc56a6`, `ab573bda` (the `/p` removal is the no-redirect precedent)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: The `/z/` worker link

#### Automated

- [x] 1.1 Phase specs pass (proxy, name-slug, workers-menu) — 247f6e48
- [x] 1.2 No source reference to `zgloszenie-prac/` left in src/e2e — 247f6e48

### Phase 2: DOM specs for the dogfooding UI

#### Automated

- [x] 2.1 Phase specs pass (summary, worker-report) — a9fafa0d
- [x] 2.2 No skipped or `.only` tests in touched files — a9fafa0d

### Phase 3: Docs and manual checks

#### Automated

- [x] 3.1 Domain notes mention `zgloszenie-prac/` only as the retired path — f51b3ea8
