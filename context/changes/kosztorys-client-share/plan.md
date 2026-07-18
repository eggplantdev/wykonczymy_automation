# Kosztorys Client Share View Implementation Plan

## Overview

Ship a **live, read-only, token-gated client-facing view** of a kosztorys (roadmap S-11,
EX-532). The owner shares a URL; the client reopens it over the life of the job and sees
current per-etap progress. The subcontractor cost view (z narzędziami / bez narzędzi) is
**never** leaked — structurally, by pinning the price view to `'client'` so subcontractor
prices are never computed, not filtered.

Design: `context/changes/kosztorys-client-share/design.md` (shaped, approved).

## Current State Analysis

- **No duplication needed.** The grid is `DynamicDataSheetGrid` (react-datasheet-grid),
  columns come from `buildV2Grid` (`kosztorys-v2-columns.tsx:508`) over the single
  `column-config.ts` map. Both views can share it.
- **No `readOnly` flag exists.** Editability is expressed per-column via `disabled` (actions
  column at `kosztorys-v2-columns.tsx:207`) and by the presence of mutation callbacks in
  `BuildV2ColumnsOptsT` (`kosztorys-v2-column-opts.ts:14-63`, all optional). There is no single
  lock. Minimal fix: add a `readOnly` opt that stamps `disabled` on data columns.
- **`getKosztorysTree` is auth-gated and uncached** (`queries/kosztorys.ts:26-30`,
  `requireAuth(MANAGEMENT_ROLES)`, throws for anon; no `unstable_cache`). A public read needs an
  auth-free, token-scoped, tag-cached path.
- **No `middleware.ts`.** Auth is enforced per-layout (`(frontend)/layout.tsx:45-47`). A new
  no-auth route group is public by construction. `(legal)/layout.tsx` is a ready bare-layout
  template (own `<html>/<body>`, `globals.css`, `robots: noindex`, no auth).
- **Cache tags** in `cache/tags.ts` (`CACHE_TAGS.stageProgress` = `collection:stage-progress`,
  etc.). `setStageProgressAction` fires `updateTag('collection:stage-progress')` via
  `protectedAction`; the Payload hook fires `revalidateTag` on the same string. Tagging the public
  read with those covers both write paths.
- **Sensitive surface** = `costVariant`, `wToolsOverride*`, `ownToolsOverride*`, global/section
  coeffs. Client-safe = `clientPrice` and everything derived at `view: 'client'`. No marża field
  in v2.
- **Kosztorys data is throwaway until dogfooding merges to main** (AGENTS): the new column needs
  no backfill.

## Desired End State

The owner opens a kosztorys, clicks „Udostępnij klientowi", gets a `/k/<token>` link (copy /
rotate / revoke) and a „Podgląd dla klienta" preview. The client opens the link with no login and
sees the offer + live per-etap progress + footer + section pie, on the `clientVisible` columns
only, netto/brutto per the axis. Subcontractor prices are absent from the payload entirely.
Editor edits (stage progress) revalidate the public page.

### Key Discoveries

- `buildV2Grid` / `column-config.ts` are the single column source — reuse, don't duplicate.
- `readOnly` must be threaded through `BuildV2ColumnsOptsT` → `assembleV2Columns` to stamp
  `disabled`; omitting callbacks alone leaves cells focus/edit-capable (`Explore` finding).
- `getKosztorysTree` body is extractable — split the tree-building core from the `requireAuth`
  guard so both the authed and the public read share it (`queries/kosztorys.ts`).
- `(legal)/layout.tsx` is the bare-layout template; no middleware to touch.

## What We're NOT Doing

- Google Sheet export, PDF export (separate later slices).
- Per-kosztorys configuration of the visible field set — one fixed client-safe render.
- Email-the-link on generate (feasible now via the leads `payload.sendEmail` pattern, but a
  fast-follow, not this slice — design "Future").
- Any data-preservation path for the new column (kosztorys data is throwaway pre-dogfooding).

## Implementation Approach

Four phases, back-to-front: the safe data path first (token + auth-free read + projection), then
the reusable read-only render, then the public route, then the owner's share/preview UI. Safety
lives in the projection (`view: 'client'` constant + a DTO with no subcontractor fields), verified
by a test on the payload, never on the DOM.

## Critical Implementation Details

**Structural no-leak.** The client tree read and projection must pin `view: 'client'` as a literal
constant and produce a `ClientKosztorysViewT` DTO that carries no `costVariant`, no coeffs, no
`*Override*` fields. The public page module imports only that DTO type — subcontractor inputs never
enter its module graph. This is the load-bearing invariant; the Phase 1 test asserts it on the
payload.

**Migration.** Hand-write the `shareToken` migration (AGENTS: `migrate:create` emits phantom
drift). Copy the latest `src/migrations/*.ts` structure: add nullable `share_token` column + a
unique index on `kosztoryses`. Prod migration is owed only when the code ships to `main` — not
during this local build.

## Phase 1: Token field + auth-free token-scoped read + client projection

### Overview

The safe data spine: a share token on the kosztorys, an unauthenticated read that resolves it, and
a projection that strips every subcontractor field.

### Changes Required

#### 1. `shareToken` field on the kosztorys collection

**File**: `src/collections/sheets.ts`

**Intent**: Add the revocable share token. Generated/cleared only by OWNER/ADMIN server actions,
not typed in the admin panel.

**Contract**: New field `shareToken` — `type: 'text'`, `unique: true`, not required, admin
`readOnly` (mutated via action, not hand-edited). Nullable → sharing off. `shareToken == null`
means no public access.

#### 2. Migration for `share_token`

**File**: `src/migrations/<timestamp>_kosztorys_share_token.ts` (hand-written)

**Intent**: Add the nullable column + unique index.

**Contract**: `ALTER TABLE kosztoryses ADD COLUMN share_token varchar; CREATE UNIQUE INDEX ... ON kosztoryses (share_token);` (partial `WHERE share_token IS NOT NULL` so multiple NULLs are allowed),
mirroring the `investment_id` partial-unique precedent. Match the latest migration file's up/down
shape.

#### 3. Extract the auth-free tree core

**File**: `src/lib/queries/kosztorys.ts`

**Intent**: Split the tree-building body from the `requireAuth` guard so the authed read and the
public read share one projection and can't drift.

**Contract**: New unexported `buildKosztorysTree(investmentId): Promise<KosztorysTreeT>` holding the
current body (the `Promise.all` + mapping). `getKosztorysTree` keeps `requireAuth(MANAGEMENT_ROLES)`
then delegates. Behavior of `getKosztorysTree` is unchanged.

#### 4. `getClientKosztorysView(token)` — unauthenticated, cached

**File**: `src/lib/queries/client-kosztorys.ts` (new)

**Intent**: The public read. Resolve the kosztorys by `shareToken`, resolve its `investment`, build
the tree via the shared core, project to the client DTO. No `requireAuth`.

**Contract**: `getClientKosztorysView(token: string): Promise<ClientKosztorysViewT | null>` — null on
absent/unknown token or a kosztorys with no linked investment. Wrapped in `unstable_cache` tagged
with `CACHE_TAGS.stageProgress`, `.kosztoryses`, `.kosztorysSections`, `.kosztorysItems`,
`.kosztorysStages` so editor edits revalidate it.

#### 5. `ClientKosztorysViewT` DTO + `toClientView` projection

**File**: `src/lib/kosztorys/to-client-view.ts` (new); type in `src/lib/kosztorys/types.ts`

**Intent**: The projection boundary — compute every money figure at `view: 'client'` and emit only
client-safe fields.

**Contract**: `ClientKosztorysViewT` carries section/item description, plannedQty, unit, clientPrice,
per-etap progress + stage labels, computed net/gross/planned/remaining/stageValue figures, footer
totals (reuse `summary-economics.ts`), and `vatRate` — and **no** `costVariant`, coeffs, or
`*Override*` fields. `toClientView(tree)` calls the `calc.ts` / `v2-rows.ts` functions with the
literal `'client'`.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm generate:types && pnpm exec tsc --noEmit`
- Migration applies cleanly against local docker DB: `pnpm payload migrate`
- Projection safety test passes: the `toClientView` output contains no subcontractor keys and no
  subcontractor-priced number: `pnpm exec vitest run src/__tests__/kosztorys/to-client-view.test.ts`
- Unknown/absent token → `getClientKosztorysView` returns null (covered in same spec)

#### Manual Verification

- A row whose w_tools/own_tools price differs from clientPrice projects only the clientPrice figure.

---

## Phase 2: Read-only grid opt + `clientVisible` column filter + client render

### Overview

Make the shared grid lockable and mount it with the client-safe column set.

### Changes Required

#### 1. `readOnly` opt → disabled data cells

**File**: `src/components/kosztorys/kosztorys-v2-column-opts.ts`, `kosztorys-v2-columns.tsx`

**Intent**: A single flag that makes the reused grid genuinely non-editable.

**Contract**: Add `readOnly?: boolean` to `BuildV2ColumnsOptsT`. In `assembleV2Columns`, when
`readOnly`, stamp `disabled: true` on data columns and drop the actions column. Editor path
(`use-kosztorys-editor.ts`) leaves it unset → unchanged.

#### 2. `clientVisible` on the column config

**File**: `src/lib/kosztorys/column-config.ts` (+ the selector in `kosztorys-v2-columns.tsx`)

**Intent**: Declare, in the one shared place a column is defined, whether the client may see it.
Adding a future column forces a one-line client-safe decision there.

**Contract**: A `CLIENT_VISIBLE_COLUMNS` set (or a `clientVisible` flag on each entry) covering the
design's client-safe field set (description, Przedmiar, j.m., Cena j.m., Wartość przedmiaru,
Netto/Brutto, etapy ilość + wartości + %, Pomiar, Pozostało, note). Subcontractor columns
(`priceMode`, `priceCoeff`) excluded. `selectV2Columns` filters to it when a `clientVisible` flag
is passed.

#### 3. `ClientKosztorysTable` + footer + pie

**File**: `src/components/kosztorys/client/client-kosztorys-view.tsx` (new)

**Intent**: The read-only presentational component — mounts `DynamicDataSheetGrid` with
`readOnly`, `clientVisible` columns, `view: 'client'` data, no editor/mutation imports.

**Contract**: Props = `ClientKosztorysViewT`. Reuses `buildV2Grid` (readOnly), the footer
(Podsumowanie-style block from the DTO totals), and the existing section pie. `onChange` no-op.
Imports only `ClientKosztorysViewT` — never the tree type or `calc.ts` subcontractor fns.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Read-only opt test: columns built with `readOnly` are all `disabled`, actions column absent:
  `pnpm exec vitest run src/__tests__/kosztorys/v2-columns-readonly.test.ts`

#### Manual Verification

- The client grid renders, scrolls at 1000 rows, and no cell enters edit mode on click.
- Netto/brutto axis toggle behaves; subcontractor columns are absent from the picker.

---

## Phase 3: Public `(share)` route

### Overview

The unauthenticated page at `/k/[token]`.

### Changes Required

#### 1. Bare share layout

**File**: `src/app/(share)/layout.tsx` (new)

**Intent**: A no-auth, no-chrome document for the public view.

**Contract**: Modeled on `(legal)/layout.tsx` — own `<html lang="pl">/<body>`, `globals.css`,
`export const metadata = { robots: { index: false, follow: false } }`, **no** `getCurrentUserJwt`.

#### 2. Public page

**File**: `src/app/(share)/k/[token]/page.tsx` (new)

**Intent**: Resolve the token, render the client view or 404.

**Contract**: `params: Promise<{ token: string }>`; `await getClientKosztorysView(token)`; `null →
notFound()`; else render `<ClientKosztorysView {...dto} />`. No auth import.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm exec tsc --noEmit`
- Build compiles the route: `pnpm build`

#### Manual Verification

- Fresh browser (no cookie) opens `/k/<token>` and sees the kosztorys; `/k/bogus` → 404.
- After clearing the token, the same URL → 404.
- A stage-progress edit in the editor is reflected on reload of the public URL.

---

## Phase 4: Owner share action + preview

### Overview

The owner's controls on the kosztorys_v2 page.

### Changes Required

#### 1. Share-token server actions

**File**: `src/lib/actions/kosztorys.ts` (or a new `share.ts` sibling)

**Intent**: Mint / rotate / revoke the token.

**Contract**: `generateShareToken(kosztorysId)` and `revokeShareToken(kosztorysId)` via
`protectedAction` gated to OWNER/ADMIN. Token = `randomBytes(24).toString('base64url')`. Rotate =
generate over an existing token. Revoke = set `null`. Revalidate `kosztoryses`. Return
`ActionResultT` with the token/URL.

#### 2. „Udostępnij klientowi" control + „Podgląd dla klienta"

**File**: kosztorys_v2 page header area (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/…` +
a new component under `src/components/kosztorys/`)

**Intent**: Generate/copy/rotate/revoke the link; open the authenticated preview.

**Contract**: A header action showing current share state, copy button, rotate + revoke, and a
„Podgląd dla klienta" link to an authenticated route rendering the _same_ `ClientKosztorysView`
from the same projection (the owner's leak check). Preview reuses `getClientKosztorysView` logic
behind auth (or a thin authed wrapper resolving by kosztorys id).

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm exec tsc --noEmit`
- Action test: generate sets a token, revoke clears it, non-OWNER is rejected:
  `pnpm exec vitest run src/__tests__/kosztorys/share-token.test.ts`

#### Manual Verification

- Owner generates a link, copies it, opens it in a private window — client view loads.
- Rotate invalidates the old link (old URL → 404) and issues a new one.
- Revoke kills the link; „Podgląd dla klienta" still works for the owner.
- Preview and the public URL render identically.

---

## Testing Strategy

### Unit Tests

- **Projection safety** (the load-bearing one): `toClientView` output has no `costVariant` /
  coeff / `*Override*` keys and no subcontractor-priced number, on a row where the subcontractor
  price differs from clientPrice. Assert the payload, not the DOM.
- **Read-only columns**: `readOnly` stamps `disabled` on all data columns, actions column dropped.
- **Token lifecycle**: generate → token set; rotate → differs; revoke → null; non-OWNER rejected;
  unknown token → null read.

### E2E (browser-level — owed, deferred)

This slice has a browser-level risk (a public URL that must not leak). Per AGENTS, author the
Playwright spec at the review gate **or** file it into the E2E backlog (Linear label
`e2e-backlog`, project "Wykonczymy"). Target flow: open `/k/<token>` anonymously → subcontractor
columns/values absent in the DOM and network payload; `/k/bogus` → 404; revoke → 404.

## Migration Notes

One nullable unique column on `kosztoryses`, hand-written (AGENTS). No backfill (kosztorys data is
throwaway pre-dogfooding). Prod migration owed only when the code ships to `main`, run by a human
via `pnpm db:migrate:prod`.

## References

- Design: `context/changes/kosztorys-client-share/design.md`
- Roadmap slice: `context/foundation/roadmap.md` → S-11
- Grid/route research: this session (Explore agent), summarized in Current State Analysis
- Reuse precedent: `buildV2Grid` (`kosztorys-v2-columns.tsx:508`), `(legal)/layout.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Token field + auth-free read + projection

#### Automated

- [ ] 1.1 Type checking passes (`generate:types` + `tsc --noEmit`)
- [ ] 1.2 Migration applies cleanly (`payload migrate`)
- [ ] 1.3 Projection safety test passes (no subcontractor keys/numbers)
- [ ] 1.4 Unknown/absent token → null read

### Phase 2: Read-only grid opt + clientVisible filter + render

#### Automated

- [ ] 2.1 Type checking passes (`tsc --noEmit`)
- [ ] 2.2 Lint passes (`pnpm lint`)
- [ ] 2.3 Read-only columns test passes (all disabled, no actions column)

### Phase 3: Public (share) route

#### Automated

- [ ] 3.1 Type checking passes (`tsc --noEmit`)
- [ ] 3.2 Build compiles the route (`pnpm build`)

### Phase 4: Owner share action + preview

#### Automated

- [ ] 4.1 Type checking passes (`tsc --noEmit`)
- [ ] 4.2 Token lifecycle + access test passes
