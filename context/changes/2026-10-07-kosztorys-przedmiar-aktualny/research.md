---
date: 2026-10-07T14:15:53+02:00
researcher: Claude (Opus 5.5)
git_commit: e935a89f662bcac9a4d844a517ec06644646026d
branch: staging
repository: wykonczymy
topic: 'Second per-item quantity „Przedmiar aktualny” beside „Przedmiar ofertowy”'
tags: [research, kosztorys, przedmiar, progress, settlement, worker-view, client-view]
status: complete
last_updated: 2026-10-07
last_updated_by: Claude (Opus 5.5)
---

# Research: „Przedmiar aktualny” beside „Przedmiar ofertowy”

## Research Question

Przedmiar is the offer, but the scope keeps moving after the offer (extra works, removed works,
changed quantities). Owner decisions 2026-10-07 (see `change.md`): rename Przedmiar → „Przedmiar
ofertowy”, add an editable per-item „Przedmiar aktualny” that starts as a copy and is never empty;
% wykonania and Pozostało anchor to aktualny; „Wartość netto przedmiar” gets an aktualny twin; the
offer stays on ofertowy. What does the codebase need to change, and what is still undecided?

## Summary

- **One field, many readers.** Przedmiar is `planned_qty numeric NOT NULL DEFAULT 0`
  (`src/migrations/20260708_2_add_kosztorys_sections_items.ts:31`) → `plannedQty`. Every money
  figure on the transactions side (reconciliation, robocizna v2, marża v2, `deriveFinancials`,
  investments listing) reads only the **executed** value — **none reads przedmiar**. The split is
  contained in the kosztorys plane: editor columns, summary panel, investor document, worker
  surfaces, row conditions, history, import.
- **The writer list already exists.** The AI-review columns (`20261007_0_add_ai_review_columns.ts`,
  commit `b6d73462`) threaded three new item fields through every tree writer. Aktualny follows the
  same checklist with one difference: its fallback is **ofertowy**, not `null`/0.
- **No prior plan for a second przedmiar exists** in `context/`, roadmap, PRD or git — today's
  `change.md` is the first written version. No „oferta wysłana” state exists anywhere (only
  investment `status`: Wycena / Planowana / Aktywna / Zakończona / Szablon).
- **The owner's sheet has no updated-scope column** — aktualny is **new work without sheet parity**
  (lessons.md:325). In the legacy dumps (37 canonical sheets, 2716 rows) 507 rows have etap work
  with no Przedmiar and 335 exceed Przedmiar: scope drift is real and today is recorded nowhere.
- **Biggest open questions:** copy timing (does aktualny follow ofertowy until edited by hand), and
  the investor document, which today shows Przedmiar _and_ % wykonania / Pozostało side by side.

## Detailed Findings

### 1. Data model and persistence

- DB column / Payload field / type: `planned_qty` (`20260708_2…:31`),
  `src/collections/kosztorys-items.ts:47` (`required: true, defaultValue: 0`),
  `src/lib/kosztorys/types.ts:49` (`KosztorysItemT.plannedQty`), `ItemPatchT` `:86-104`.
- Tree read: SELECT `src/lib/db/kosztorys-tree.ts:71-76`, mapper `:161` (`num()` turns a missing
  column into 0 silently; `kosztorys-tree-sql-drift.test.ts` catches only mapper-vs-SELECT drift).
- **Migration shape:** `ADD COLUMN <aktualny> numeric` → `UPDATE … SET <aktualny> = planned_qty` →
  `SET NOT NULL`. **No `DEFAULT 0`** — it would hide a missed writer by producing aktualny 0 on a row
  with a przedmiar. Payload `defaultValue` cannot reference a sibling field.
- Precedent: AI fields were made required (`T | null`) on `KosztorysItemT` (`types.ts:71-73`) so `tsc`
  lists every code-built item. Do the same.

### 2. Writers (every path that must set aktualny)

| Path                                                                                                           | file:line                                                                                                                                                                            | Aktualny value                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single INSERT funnel `insertItems` (positional columns + tuple)                                                | `src/lib/kosztorys/insert-rows.ts:21-42, 130`                                                                                                                                        | from the item; guards: `insert-schema-drift.test.ts`, `serialize-restore-roundtrip.test.ts`                                                                     |
| Callers: `addItemAction`, worker extras, katalog placement, `insertKosztorysTree`, `appendPresetSections`      | `actions/kosztorys.ts:530`, `accept-worker-report.ts:266`, `work-catalogue/place-catalogue-items.ts:39`, `insert-kosztorys-tree.ts:80`, `append-preset-sections.ts:54`               | via funnel                                                                                                                                                      |
| Snapshot tolerant read                                                                                         | `snapshot-format.ts:110-130`, `itemWithColumnDefaults` `:163-188`                                                                                                                    | `?? item.plannedQty ?? 0` — else every old snapshot / szablon restores aktualny = 0. No `SNAPSHOT_SCHEMA_VERSION` bump (additive with fallback; lessons.md:788) |
| Snapshot consumers: restore, `replaceTreeWithSnapshot` (import, „Wyczyść”, save-szablon, reload), history view | `restore-kosztorys.ts:38`, `replace-tree-with-snapshot.ts:46`, `history/snapshot-to-tree.ts:23`                                                                                      | via snapshot read                                                                                                                                               |
| Szablon serializer                                                                                             | `serialize-preset.ts:28-37`                                                                                                                                                          | **0** (zeroed with `plannedQty`)                                                                                                                                |
| Code-built items („Nowa praca”, katalog, worker extra)                                                         | `item-from-fields.ts:38`, `accept-worker-report.ts:392`, `work-catalogue/item-to-catalogue.ts:21`                                                                                    | 0 today — **worker extra is a decision** (see Open Questions)                                                                                                   |
| Sheet import                                                                                                   | `sheet-import/parse-labor-tab.ts:184`, `build-import-plan.ts:218-245` (matched rows spread the sheet item; `note`/AI fields carried from `current` `:234-238`)                       | new rows = sheet Przedmiar; matched rows: carry from `current` or reset — **decision**                                                                          |
| Grid patch                                                                                                     | `item-patch-schema.ts:20` (`z.coerce.number()` → cleared cell = 0, satisfies „never empty”), `ITEM_FIELDS` `v2-rows.ts:6-21`, `updateItemFieldAction` `actions/kosztorys.ts:124-140` | new key in all three                                                                                                                                            |
| AI review rules (client-side, before diff)                                                                     | `review-status.ts:39-65`, called `use-kosztorys-editor.ts:1215`                                                                                                                      | „Zaakceptowana”/„Odrzucona” write `plannedQty`; whether aktualny follows is the copy-timing decision                                                            |
| Seed scripts (~15, `payload.create` with `plannedQty`)                                                         | `src/scripts/seed-kosztorys.ts:121`, `perf-seed-kosztorys.ts:72`, `seed-*.ts`                                                                                                        | NOT NULL without default breaks them → edit each or `beforeChange` fill                                                                                         |

Raw `UPDATE`s that never rebuild the row (layout, measured-qty, texts, catalogue-apply, rabat %)
cannot drop the column. Undo lanes are per field (`save-lanes.ts:17-19`,
`undo-coalesce.ts:12`, `undo-reversal.ts:44-60`) — a new `ItemPatchT` key gets lane, coalescing and
reversal for free. Persisted column-key surfaces that drop unknown ids silently: client view
`hidden_columns`, `sheet_column_mapping`, presets payload, two localStorage keys
(`column-config.ts`, `client-view/settings.ts`; lessons.md:1614).

### 3. Readers — classification

**O** = stays ofertowy · **P** = moves to aktualny · **?** = decision.

Core primitives:

| Reader                                                           | file:line                    | Class                                                                                                                    |
| ---------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `rowPlannedNetForView` („Wartość netto przedmiar”, sheet S)      | `calc.ts:256-257`            | O — needs a P twin                                                                                                       |
| `rowDoneFraction` (% wykonania)                                  | `calc.ts:330-332`            | P (doc comment says „of the OFFER”)                                                                                      |
| `rowRemainingForExecutedQty` (Pozostało)                         | `settlement-rows.ts:66-73`   | P — reads `row.plannedQty` internally; give it an explicit quantity param (lessons.md:1581, no default on a money param) |
| `hasStagesOverPlanned` (red %), `isRemainingOverrun`             | `settlement-rows.ts:101-104` | P — against ofertowy every agreed extra would be red forever                                                             |
| `rowPlannedNetPreDiscountForView` (prognoza base)                | `calc.ts:272-273`            | ?                                                                                                                        |
| `calc.ts:25` comment („only reader using przedmiar as quantity”) |                              | becomes false                                                                                                            |

Grid / totals / summary:

- `column-values.ts:61` `plannedNet` O; `:63-65` `remaining`, `donePercent` P; `:76`
  `plannedNetForPlane` P (crew: „what the crew earns doing the whole przedmiar”); `:84-86`
  `remainingForPlane` P. New computed ids must be registered in `byField` or
  `computedColumnValues` throws (`:115`).
- `column-totals.ts:38-83` — `plannedNet` total O (+ new aktualny total), `remaining` excluding
  overrun rows P (overrun judged against aktualny). Quantity columns are never summed (`:26-29`).
- `settlement-aggregates.ts:97-130` `sectionSubtotalsForView` — **one `plannedNet` used for two
  things**: the section's offer figure (O) and the `completionRatio` denominator (P). Split here first.
- Progress counter `use-kosztorys-editor.ts:740-755` → `summary-stages-tab.tsx:46-55` →
  `kosztorys-progress-counter.tsx:17` (doneNet / plannedNet) — P.
- Section share pie `chart-slices.ts:64`, `section-share-pie.tsx:14,21` — ?.
- Margin forecast `margin-forecast.ts:35-37`, `margin-forecast-table.tsx:14-36` — ? (offer promise
  vs. agreed scope).
- `OFFER_VISIBLE_COLUMNS` („Oferta” column filter, `offer-columns.ts:3-10`) — O.

Investor document (podgląd, share link, „Generuj ofertę” PDF — one list,
`client-view/columns.ts:45-60`, defaults `client-view/settings.ts:25-36`):

- Przedmiar column `print/offer-columns.ts:47`, „Wartość netto” `:59`, `print/offer.ts:60`,
  `offer-print-action.tsx:43-46` — O.
- % wykonania / Pozostało on the same document `print/offer-columns.ts:75-80`,
  `client-view/columns.ts:29,33` — P by the owner's rule, **which puts ofertowy and aktualny-based
  progress side by side** (Przedmiar 10, pomiar 12, 100%). See Open Questions.

Worker surfaces — all P (the crew works to the current scope, never sees the offer):
`worker-view/columns.ts:17-45` (plannedQty, plannedNetForPlane, remainingForPlane), `:58`
`PLANNED_COLUMNS` („Ukryj przedmiar…” toggle, `kosztorys-worker-view-dialog.tsx:72,80`),
`worker-view/summary.ts:94`, `print/worker.ts:112,139`, `print/worker-columns.ts:54,62,67`,
„Drukuj do wypełnienia” Postęp `print/worker-form-columns.ts:57-58`, report page
`report-column.tsx:95-96`, report review `worker-report-review.tsx:119`, `line-draft.ts:34`,
`review-lines-table.tsx:234-241, 487-493`.

Row conditions (`row-conditions/registry.ts`):

- `:119,127` „bez przedmiaru” / „z przedmiarem” filters — ? (probably aktualny).
- `:472-478` `work-without-planned-qty` („wykonane bez przedmiaru”) — P; `revealsColumns` → aktualny.
  Domain notes `:469-470` call it „sygnał, że ofertę trzeba uzupełnić” — aktualny is exactly the
  field that answers it.
- `:29` `isEmptyOnBothAxes` → `client-empty` (`:365-376`, hides rows on the investor doc) — ?; safe
  rule: ofertowy = aktualny = 0 and no work.
- `:483-500` AI filters (do sprawdzenia, bez powodu) and `review-status.ts` — O (AI draft is a draft
  of the offer).

SQL readers: `investment-trash.ts:15` (`KOSZTORYS_USED`, gates trash purge) and
`catalogue-usage.ts:18` (katalog „Użyta”) — safe reading is ofertowy **or** aktualny.

Import / compare / history:

- `build-sheet-comparison.ts:154`, `footer-totals.ts:83`, `sheet-compare-dialog.tsx:129,329,339`,
  `sheet-import-dialog.tsx:409` — compare sheet S456 to the app's value — ?.
- History diffs only `plannedQty` (`history/diff-versions.ts:31,138-147`, `change-rows.ts:37,43`,
  `history-grid.ts:26`, `history/types.ts:20`) — aktualny changes are exactly the scope changes worth
  showing; add it.

Not affected: Google Sheets sync (app writes only the three transfer tabs,
`google/sheet-configs.ts:33,56,64`, never column N), `subcontractor-price-guard.ts`,
`formula-health.ts`, `SETTLEMENT_TOTAL_COLUMNS` (`settlement-columns.ts:8` — gates on etap entries).

### 4. Editor columns and wiring

- Przedmiar column: `kosztorys-v2-columns.tsx:178-187` — `decimalColumn('plannedQty', …,
numericFieldPolicy('plannedQty', formatQty))` (`cell-edit.ts:131-146`). Aktualny = same factory on
  a new field, inserted after `...przedmiar` in the assembly (`:398-417`); its value twin goes inside
  `plannedValue` (`:350-354`, `resolvedColumn('plannedNet' | 'plannedGross' | 'plannedNetForPlane')`).
- Registries (`src/lib/kosztorys/columns/column-config.ts`): `COLUMN_LABELS :19-54`,
  `TRANSLATED_LABEL_KEYS :58-65` (if the worker sees it), `PRZEDMIAR_ANCHORED_COLUMNS :128-131`
  (add aktualny brutto twin or it leaks into crew views), `CREW_PLANE_ONLY_COLUMNS :138`,
  `COLUMN_MONEY_AXIS :145-159` (**must tag** new value columns — untagged shows on both axes),
  `COLUMN_LAYER :166-172`, `DEFAULT_HIDDEN_COLUMNS :236-244`. `column-selection.ts` reads the sets —
  no code change.
- Closed lists via `closedColumnList` (`column-selection.ts:74-86`): investor, worker, „Oferta”,
  „Przegląd AI”, szablon workbench (`workshop-columns.ts:36-46`, no Przedmiar — aktualny makes no sense
  in a szablon).
- Column order: base ranks shift for unranked columns after an insert
  (`assembleBaseRanks`, `column-selection.ts:215`; domain notes `:347-353`). Colours keyed by id —
  no wiring.
- No bulk set/zero/percent on Przedmiar exists (`2026-09-23-kosztorys-bulk-actions` is research only).

### 5. Labels — rename scope

- Core: `pl.grid.plannedQty: 'Przedmiar'` `src/lib/i18n/dictionaries/pl.ts:260`; uk `:250`
  „Плановий обсяг”, ru `:250` „Плановый объём”.
- Strings mentioning przedmiar: `pl.ts:236,253,263-264,281,288,291,295` (+ uk/ru twins).
- Header tips `header-tips.ts:15` (REMAINING), `:17` (PLANNED), `:20`, `:30`, `:36` (donePercent
  „względem przedmiaru / ile procent oferty”) — P tips must name aktualny.
- PDF: `print/columns.ts:36-43` hardcoded `label: 'Przedmiar'`.
- History `change-rows.ts:37,43`; plus `view-settings-fields.tsx:68`, `divergence-cell.tsx:29`,
  `add-sections-from-preset-dialog.tsx:108`, `section-share-pie.tsx:14`,
  `margin-forecast-table.tsx:14-16,36`, `lib/constants/trash.ts:7`, `filter-groups.ts:15`,
  `problem-groups.ts:25`, `row-conditions/registry.ts:115-127,159,167,366,473-478`.
- **Keep** `sheet-import/columns.ts:24,69` (`exactly('przedmiar')` matches the owner's sheet header).

### 6. Tests that go tautological

If fixture helpers (`src/__tests__/helpers/kosztorys-tree.ts`,
`src/__tests__/lib/kosztorys/row-conditions/fixtures.ts`, `row()` in `kosztorys-v2-rows.test.ts`)
default aktualny to a copy of `plannedQty`, every test below stays green whichever field the code
reads. Fixtures need ofertowy ≠ aktualny, each rewritten red-first (lessons.md:360):

`kosztorys-calc.test.ts:222-261`, `kosztorys-v2-rows.test.ts:267-290, 296-325, 353, 380-410,
418-452`, `columns/column-values.test.ts:42,65`, `columns/column-totals.test.ts:92-161`,
`remaining-overrun-tone.test.ts:46+`, `print/worker-form.test.ts:134-138`, `print/offer.test.ts`,
`print/worker.test.ts`, `planned-net-for-plane-columns.test.ts`,
`row-conditions/registry.test.ts:26-29,127-143`, `subcontractor-due-by-plane.test.ts`,
`margin-forecast.test.ts:33-69` (if forecast moves), `column-value-parity.test.ts`. No E2E asserts
przedmiar-based progress.

## Code References

- `src/lib/kosztorys/calc.ts:256-273, 330-333` — przedmiar value, prognoza base, % wykonania
- `src/lib/kosztorys/settlement-rows.ts:66-73, 101-104` — Pozostało, overrun signals
- `src/lib/kosztorys/settlement-aggregates.ts:97-130` — section offer + completionRatio (dual use)
- `src/lib/kosztorys/columns/column-config.ts` — every column registry
- `src/lib/kosztorys/columns/column-values.ts:61-115`, `column-totals.ts:38-83`
- `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:178-187, 337-417`
- `src/lib/kosztorys/insert-rows.ts:21-42,130`, `snapshot-format.ts:110-188`, `serialize-preset.ts:28-37`
- `src/lib/kosztorys/review-status.ts:39-65` — AI status writes przedmiar
- `src/lib/kosztorys/client-view/columns.ts:16-60`, `worker-view/columns.ts:17-58`
- `src/lib/kosztorys/sheet-import/build-import-plan.ts:218-245`, `parse-labor-tab.ts:184`
- `src/lib/kosztorys/accept-worker-report.ts:266, 392`

## Architecture Insights

- **Naming.** Ofertowy vs aktualny are two concepts on the **same plane**, so the
  `FromKosztorys`/`FromTransactions` plane suffix does not apply (AGENTS.md). Keep a shared base so
  the pair reads as one family: `plannedQty` stays the ofertowy field (renaming 168 files buys
  nothing); the new field e.g. `currentPlannedQty` / `current_planned_qty`, value twin
  `currentPlannedNet`. Add a glossary row (`context/domain/02-glossary.md`, EX-548) — the
  glossary's drift cell for `przedmiar` (says „—” while code uses `plannedQty`) is already wrong.
- **One figure, two jobs** is the recurring shape: `sectionSubtotalsForView.plannedNet` and the
  investor document both use one przedmiar for „what was offered” and „what is the progress
  denominator”. The change is splitting those jobs, not just adding a column.
- **Fallback is ofertowy, not null.** Everywhere the AI precedent wrote `?? null` or `0`, aktualny
  needs `?? plannedQty` — except the szablon serializer, where both are 0.
- Money figures on the transactions plane are untouched; the FR-015 firewall holds.

## Historical Context (from prior changes)

- `context/reference/kosztorys-editor-domain-notes.md:607-622` — EX-494: two inputs (Przedmiar,
  etapy), Pomiar = Σ etapów, Wartość netto przedmiar (S) vs Wartość netto (T), Pozostało = S − T.
- `domain-notes.md:106-108`, P9 `:1677` — Pozostało deliberately anchors to S (the offer); it is
  „kontrola postępu robót”, not billing. This change moves that anchor.
- `domain-notes.md:469-470` — accepted extra work becomes a row without przedmiar, flagged „wykonane
  bez przedmiaru” as „ofertę trzeba uzupełnić” — the current workaround aktualny replaces.
- `domain-notes.md:633-646` — overrun stays visible (red %, negative Pozostało), no escape hatch.
- `domain-notes.md:1765-1768` P13 — „klient widzi ilość z przedmiaru czy z pomiaru?” still listed
  open; the 2026-10-07 „oferta to oferta” ruling bears on it.
- `domain-notes.md:1237-1240, 399-416` — subcontractor views: przedmiar has no variant; worker view
  has „Wartość przedmiaru netto — ⟨rozliczenie⟩” and „Ukryj przedmiar…” toggle.
- `context/changes/2026-10-06-kosztorys-ai-knowledge-loop/` — AI przedmiar: the only existing second
  quantity column; „Przedmiar is the manager's — and the offer. Nothing is frozen or copied.” A
  freeze action was proposed and rejected (`research.md:323-326`). Writer checklist
  `research.md:126-155`, `plan.md:279-292`.
- `context/changes/2026-10-06-offer-hides-remaining/` (status `new`) — moves Pozostało into the
  „hidden until first etap entry” set on the investor document. Touches the same column →
  **sequence** with this change (lessons.md:341).
- EX-495 (on hold, `calc.ts:253`) — „rabat in the offer” value; applies to both przedmiar values.

## Related Research

- `context/changes/2026-10-06-kosztorys-ai-knowledge-loop/research.md` — tree-writer inventory
- `context/changes/2026-09-23-kosztorys-bulk-actions/research.md`

## Open Questions

1. **Copy timing.** (A) aktualny follows ofertowy until edited by hand, then independent; (B) one
   copy at an explicit „oferta wysłana” moment (no such state exists today). Also decides whether
   AI „Zaakceptowana”/„Odrzucona” (`review-status.ts`) write aktualny. Recommended: A.
2. **Investor document.** It shows Przedmiar (ofertowy) next to % wykonania / Pozostało (aktualny).
   Keep it pure offer, show aktualny once etap entries exist, or both? Interacts with
   `offer-hides-remaining`.
3. **Worker surfaces** — recommended all on aktualny (link, PDF, „Drukuj do wypełnienia” Postęp,
   report page, report review). Confirm.
4. **Extra work accepted from a worker report** — ofertowy 0, aktualny = reported quantity?
5. **Prognoza marży and the section pie** — ofertowy (what the offer promised) or aktualny?
6. **Sheet import** — sheet N fills ofertowy; on re-import of matched rows carry aktualny from the app
   or reset it to N? Sheet comparison (S456) against which value?
7. **Filters „bez przedmiaru” / „z przedmiarem”, trash purge, katalog „Użyta”** — proposed: filters
   on aktualny; usage checks on ofertowy OR aktualny.
8. **Rabat** — the aktualny value uses the same per-row rabat rule as ofertowy (EX-495 still open).

## Owner rulings on the open questions (2026-10-07)

1. A — aktualny follows ofertowy until edited by hand (AI statuses included).
2. Investor document: pure offer before the first etap entry; after it, both przedmiary, with
   Pozostało / % wykonania from aktualny. Same trigger as `offer-hides-remaining` — fold or sequence.
3. Worker surfaces: aktualny.
4. Worker-report extra: ofertowy 0, aktualny = reported quantity.
5. Prognoza marży: ofertowy.
6. Sheet import: one przedmiar in the sheet → copied into both. Re-import: sheet refreshes ofertowy, a hand-edited aktualny survives.
