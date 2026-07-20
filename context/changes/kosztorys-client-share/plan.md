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
- **Kosztorys data is throwaway until dogfooding merges to main** (AGENTS): the new table needs
  no backfill.
- **`kosztoryses` is NOT kosztorys v2** (corrected 2026-07-20). `src/collections/sheets.ts:13` is the
  v1 Google-Sheet link row: `googleSheetId` is required+unique (`:44-46`) and `investment` is
  nullable (`:61-65`), so a v2 kosztorys with no linked sheet has no row there at all. Kosztorys v2
  has no top-level collection — sections/items/stages/stage-progress all key on `investment`
  (`kosztorys-sections.ts:30`). The share token therefore gets its own table keyed on `investment`.

## Desired End State

The owner opens a kosztorys and finds a permanent „Podgląd dla klienta" link showing exactly what a
client would see — available always, whether or not the kosztorys has ever been shared. Separately,
„Udostępnij klientowi" mints a `/k/<token>` link (copy / rotate / revoke). The client opens the link
with no login and
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

**Migration.** Hand-write the `kosztorys_shares` migration (AGENTS: `migrate:create` emits phantom
drift). Copy the latest `src/migrations/*.ts` structure (`20260718_1_add_kosztorys_stage_to_transactions.ts`
is the current shape reference). Prod migration is owed only when the code ships to `main` — not
during this local build.

## Phase 1: `kosztorys-shares` collection + auth-free read core + client projection

### Overview

The safe data spine: a share token on the kosztorys, an unauthenticated read that resolves it, and
a projection that strips every subcontractor field.

### Changes Required

#### 1. New `kosztorys-shares` collection

**File**: `src/collections/kosztorys-shares.ts` (new) + register in `payload.config.ts`

**Intent**: Home for the share token, keyed on the same entity the v2 data is keyed on. A separate
table (not a column on `kosztoryses`, not on `investments`) because sharing is per-investment
kosztorys state with its own lifecycle: revoke is a row delete, and the shape leaves room for expiry
or multiple links later without touching a core entity.

**Contract**: `slug: 'kosztorys-shares'`; fields `investment` (relationship → `investments`,
required, unique — one live link per kosztorys) and `token` (text, required, unique, admin
`readOnly` — minted by action, never hand-typed). Payload `timestamps` give createdAt/updatedAt.
Access: `isAdminOrOwner` for create/update/delete, `isAdminOrOwnerOrManager` read — the **public read
never goes through Payload access control**, it uses the token-scoped query in #4.
No row for an investment → no public access.

#### 2. Migration for `kosztorys_shares`

**File**: `src/migrations/<timestamp>_kosztorys_shares.ts` (hand-written per AGENTS)

**Intent**: Create the table.

**Contract**: `CREATE TABLE kosztorys_shares` (id, investment_id FK → investments **ON DELETE
CASCADE** — a deleted investment must not leave a live public link, token varchar NOT NULL,
created_at/updated_at), unique index on `token`, unique index on `investment_id`. Match the latest
`src/migrations/*.ts` up/down shape and register it in `src/migrations/index.ts`.

#### 3. Extract the auth-free tree core

**File**: `src/lib/queries/kosztorys.ts`

**Intent**: Split the tree-building body from the `requireAuth` guard so the authed read and the
public read share one projection and can't drift.

**Contract**: New unexported `buildKosztorysTree(investmentId): Promise<KosztorysTreeT>` holding the
current body (the `Promise.all` + mapping). `getKosztorysTree` keeps `requireAuth(MANAGEMENT_ROLES)`
then delegates. Behavior of `getKosztorysTree` is unchanged.

#### 4. Client read paths — one projection, two entrances

**File**: `src/lib/queries/client-kosztorys.ts` (new)

**Intent**: The public read _and_ the owner's always-on preview. The preview must **not** require a
share token to exist (owner, 2026-07-20), so the token lookup cannot sit on the shared path —
otherwise previewing an unshared kosztorys returns null. One projection core, two guarded entrances.

**Contract**:

- `buildClientKosztorysView(investmentId: number): Promise<ClientKosztorysViewT | null>` — unexported
  core. Builds the tree via the shared core (#3), projects via `toClientView`. **No auth, no token** —
  it is never exported, so it cannot be called unguarded from outside.
- `getClientKosztorysByToken(token: string): Promise<ClientKosztorysViewT | null>` — **public entrance,
  no `requireAuth`**. Resolves `kosztorys-shares` by `token` → `investment`, then delegates. Null on
  absent/unknown token.
- `getClientKosztorysPreview(investmentId: number): Promise<ClientKosztorysViewT | null>` — **authed
  entrance**, `requireAuth(MANAGEMENT_ROLES)` (self-guarding, matching `getKosztorysTree`'s DAL
  convention at `queries/kosztorys.ts:30`). Works whether or not a share row exists.

Both entrances wrapped in `unstable_cache` tagged with `CACHE_TAGS.stageProgress`, `.kosztorysSections`,
`.kosztorysItems`, `.kosztorysStages` so editor edits revalidate both. Because both entrances return
the _same_ DTO from the _same_ core, the preview is a true leak check — not a lookalike render.

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
- Unknown/absent token → `getClientKosztorysByToken` returns null (covered in same spec)
- Preview entrance needs no share row → `getClientKosztorysPreview` returns the DTO for a
  never-shared investment, and rejects anonymously

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

**Must NOT render the EX-535 reconciliation scream** (the red `TriangleAlert` + „Niezgodność z
transakcjami" tooltip on „Suma prac wykonanych"/„Rabat"). It's an owner-internal check comparing the
kosztorys against the transaction ledger — a client must never see it. **The EX-541 `priceView ===
'client'` gate does NOT protect this surface**: the client view pins `view: 'client'`, so that gate
would leave the scream ON. The client payload therefore carries **no reconciliation at all** — the
footer is built from the DTO totals only, never `KosztorysTotalsPanel`/`KosztorysPodsumowanie` with a
live `reconciliation` prop. Verify on the payload (no recon field), not the DOM.

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

## Phase 3: Always-on client preview (authenticated)

### Overview

The owner's „Podgląd dla klienta" — permanently available from the kosztorys, independent of whether
a share link has ever been generated (owner, 2026-07-20). Deliberately lands **before** any public
route exists, so the leak surface can be inspected while nothing is yet exposed.

### Changes Required

#### 1. Preview route

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/podglad-klienta/page.tsx` (new)

**Intent**: Render the client projection behind normal app auth.

**Contract**: Resolves `params.id` → `getClientKosztorysPreview(investmentId)` → `notFound()` on null,
else `<ClientKosztorysView {...dto} />`. Sits inside `(frontend)`, so it inherits the existing auth
layout — no new guard. Renders the same component the public route will mount in Phase 4.

#### 2. Permanent entry point from the kosztorys

**File**: kosztorys_v2 page header (`src/app/(frontend)/inwestycje/[id]/kosztorys_v2/…`)

**Intent**: A direct, always-present link — not buried behind a share dialog or conditional on a
token existing.

**Contract**: A „Podgląd dla klienta" link in the kosztorys header, rendered unconditionally for
MANAGEMENT_ROLES, pointing at the Phase 3 #1 route. Independent of share state; it must still work
after a link is revoked.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Preview read is auth-gated: anonymous call to `getClientKosztorysPreview` rejects —
  `pnpm exec vitest run src/__tests__/kosztorys/client-kosztorys-read.test.ts`

#### Manual Verification

- The link is present on a kosztorys that has never been shared, and the preview renders.
- No subcontractor column appears in the preview.

---

## Phase 4: Public `(share)` route + owner share controls

### Overview

The unauthenticated page at `/k/[token]`, plus the mint/rotate/revoke controls that feed it.

### Changes Required

#### 1. Bare share layout

**File**: `src/app/(share)/layout.tsx` (new)

**Intent**: A no-auth, no-chrome document for the public view.

**Contract**: Modeled on `(legal)/layout.tsx` — own `<html lang="pl">/<body>`, `globals.css`,
`export const metadata = { robots: { index: false, follow: false } }`, **no** `getCurrentUserJwt`.

#### 2. Public page

**File**: `src/app/(share)/k/[token]/page.tsx` (new)

**Intent**: Resolve the token, render the client view or 404.

**Contract**: `params: Promise<{ token: string }>`; `await getClientKosztorysByToken(token)`; `null →
notFound()`; else render `<ClientKosztorysView {...dto} />`. No auth import.

#### 3. Share-token server actions

**File**: `src/lib/actions/kosztorys.ts` (or a new `share.ts` sibling)

**Intent**: Mint / rotate / revoke the token.

**Contract**: `generateShareLink(investmentId)` and `revokeShareLink(investmentId)` via
`protectedAction` gated to OWNER/ADMIN. Token = `randomBytes(24).toString('base64url')`. Generate =
upsert the `kosztorys-shares` row (rotate is generate over an existing row — the old token dies with
the overwrite). Revoke = delete the row. Revalidate `kosztorysShares`. Return `ActionResultT` with
the token/URL.

#### 4. „Udostępnij klientowi" control

**File**: kosztorys_v2 page header area + a new component under `src/components/kosztorys/`

**Intent**: Generate / copy / rotate / revoke the public link.

**Contract**: A header action showing current share state (shared vs not), copy button, rotate and
revoke. Sits alongside — **not** wrapping — the Phase 3 „Podgląd dla klienta" link, which stays
unconditional and independent of share state.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm exec tsc --noEmit`
- Build compiles the public route: `pnpm build`
- Action test: generate creates a row, rotate replaces the token, revoke deletes it, non-OWNER is
  rejected, unknown token reads null:
  `pnpm exec vitest run src/__tests__/kosztorys/share-token.test.ts`

#### Manual Verification

- Fresh browser (no cookie) opens `/k/<token>` and sees the kosztorys; `/k/bogus` → 404.
- Rotate invalidates the old link (old URL → 404) and issues a new one.
- Revoke kills the link; „Podgląd dla klienta" still works for the owner.
- A stage-progress edit in the editor is reflected on reload of the public URL.
- Preview and the public URL render identically.

---

## Testing Strategy

### Unit Tests

- **Projection safety** (the load-bearing one): `toClientView` output has no `costVariant` /
  coeff / `*Override*` keys and no subcontractor-priced number, on a row where the subcontractor
  price differs from clientPrice. Assert the payload, not the DOM.
- **Read-only columns**: `readOnly` stamps `disabled` on all data columns, actions column dropped.
- **Share-link lifecycle**: generate → row created; rotate → token differs; revoke → row deleted;
  non-OWNER rejected; unknown token → null read.
- **Preview needs no share row**: `getClientKosztorysPreview` returns the DTO for an investment that
  has never been shared, and rejects anonymously.

### E2E (browser-level — owed, deferred)

This slice has a browser-level risk (a public URL that must not leak). Per AGENTS, author the
Playwright spec at the review gate **or** file it into the E2E backlog (Linear label
`e2e-backlog`, project "Wykonczymy"). Target flow: open `/k/<token>` anonymously → subcontractor
columns/values absent in the DOM and network payload; `/k/bogus` → 404; revoke → 404.

## Migration Notes

One new `kosztorys_shares` table, hand-written (AGENTS). No backfill (kosztorys data is throwaway
pre-dogfooding). The FK to `investments` is `ON DELETE CASCADE` so deleting an investment can never
strand a live public link. Prod migration owed only when the code ships to `main`, run by a human
via `pnpm db:migrate:prod`.

## References

- Design: `context/changes/kosztorys-client-share/design.md`
- Roadmap slice: `context/foundation/roadmap.md` → S-11
- Grid/route research: this session (Explore agent), summarized in Current State Analysis
- Reuse precedent: `buildV2Grid` (`kosztorys-v2-columns.tsx:508`), `(legal)/layout.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: kosztorys-shares collection + auth-free read core + projection

#### Automated

- [x] 1.1 Type checking passes (`generate:types` + `tsc --noEmit`) — fe143fbe
- [x] 1.2 Migration applies cleanly (`payload migrate`) — fe143fbe
- [x] 1.3 Projection safety test passes (no subcontractor keys/numbers) — fe143fbe
- [x] 1.4 Unknown/absent token → null read — fe143fbe

### Phase 2: Read-only grid opt + clientVisible filter + render

#### Automated

- [x] 2.1 Type checking passes (`tsc --noEmit`) — 88fcf326
- [x] 2.2 Lint passes (`pnpm lint`) — 88fcf326
- [x] 2.3 Read-only columns test passes (all disabled, no actions column) — 88fcf326

### Phase 3: Always-on client preview (authenticated)

#### Automated

- [x] 3.1 Type checking passes (`tsc --noEmit`) — 218383c4
- [x] 3.2 Lint passes (`pnpm lint`) — 218383c4
- [x] 3.3 Preview read is auth-gated (anonymous call rejects) — 218383c4

### Phase 4: Public (share) route + owner share controls

#### Automated

- [x] 4.1 Type checking passes (`tsc --noEmit`) — ec12f15f
- [x] 4.2 Build compiles the public route (`pnpm build`) — ec12f15f
- [x] 4.3 Share-link lifecycle + access test passes — ec12f15f
