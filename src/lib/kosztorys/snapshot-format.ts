import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  StageProgressT,
} from '@/lib/kosztorys/types'

// Bump only on a non-additive payload change (a renamed/dropped field). An ADDITIVE field usually
// needs no bump, because the restore path defaults what a stored payload omits — but it defaults
// exactly what StoredSnapshotPayloadT below marks optional, and nothing more. A new column that is
// NOT NULL *without* a default (`kosztorys_sections.name`, `kosztorys_stages.ordinal` are the two
// today) has no meaningful fallback, so adding one IS a breaking change for every stored payload,
// additive or not. See restore-kosztorys.ts for the tolerant deserialization contract.
//
// A field DROPPED without ever having been read is exempt: the restore mapper picks keys it knows,
// so the stale key in an old payload is inert and the snapshot still restores whole (precedent:
// 20260724_1).
//
// A BUMP IS NOT DONE UNTIL THE EXISTING ROWS ARE DEALT WITH. Three exits, pick one:
//   - don't bump — additive, or a key the mapper never reads (five column drops have taken this
//     exit with no failure);
//   - migrate the stored payloads — presets: a hand-curated library, so deleting it destroys real
//     work UNLESS the owner declares the library disposable and re-saves it by hand (EX-766 did);
//   - delete the stored rows — snapshots: ambient history, cheap to re-accumulate.
// Forbidden: bump and leave. Bumping is asymmetric — the list queries (snapshots.ts, presets.ts)
// don't assert, so every stranded version and preset keeps being offered in the UI and throws the
// Polish error below only once clicked. Honouring the rule buys the invariant that EVERY row in
// kosztorys_snapshots is readable by the current code, which is in turn why listSnapshots carries no
// schema_version filter: an unreadable row is not history to be filtered out of a list, it is a row
// that should not exist.
export const SNAPSHOT_SCHEMA_VERSION = 1 as const

// Gate a stored payload at read time. Because the version bumps ONLY on a non-additive change, any
// mismatch (an old row written before that change, or a future row from newer code) means the
// tolerant mapper would seed wrong/missing columns — so reject loudly instead of silently applying.
// Never bumped yet, so this rejects nothing today; it's the guard that arms on the first bump.
export function assertReadableSchemaVersion(version: number, kind: 'preset' | 'snapshot'): void {
  if (version === SNAPSHOT_SCHEMA_VERSION) return
  const label = kind === 'preset' ? 'szablonu' : 'wersji'
  throw new Error(
    `Nie można wczytać ${label}: zapisano w formacie ${version}, aplikacja obsługuje ${SNAPSHOT_SCHEMA_VERSION}.`,
  )
}

// The investment editor-settings that shape computed prices — captured so a restore is faithful
// (restore rewrites them). Kept off the tree because they live on `investments`. The global discount
// is deliberately NOT captured: restoring a version must not reset the live amount discount.
export type SnapshotSettingsT = {
  wToolsCoeff: number
  ownToolsCoeff: number
  vatRate: number
}

// One serialized kosztorys, flat (no nested items) so restore can rebuild the FK graph by remapping
// ids. Column-parity with the four tree tables + the three investment fields. `id`/`sectionId`/
// `itemId`/`stageId` are the OLD ids — restore mints new ones and remaps children.
export type SnapshotPayloadT = {
  schemaVersion: number
  sections: KosztorysSectionT[]
  items: KosztorysItemT[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  settings: SnapshotSettingsT
}

// A kosztorys with nothing in it — the shape „wyczyść kosztorys" writes and the shape a szablon is
// born with. `settings` is the caller's, because those two disagree about it and only about it: a new
// szablon carries the defaults, a cleared kosztorys takes its coefficients from the investment and
// passes zeros it never reads. Written out twice, the four empty arrays were four chances to forget
// one and hand a partial payload to a reader that types them as required.
export function emptySnapshotPayload(settings: SnapshotSettingsT): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [],
    items: [],
    stages: [],
    progress: [],
    settings,
  }
}

// What a STORED payload may actually look like, as opposed to what today's serializer writes. A row
// captured before a column existed simply has no key there, so every field the restore path defaults
// is optional HERE — which is what makes each `??` on that path load-bearing to tsc. Under the strict
// type those fallbacks compile as dead branches, and this repo gates dead-code removal on a green
// typecheck: the next cleanup pass would be told it may delete the exact guards that stop a 23502.
// The optional set is therefore not decoration — it is the list of columns the restore path has to
// fill for itself, and it must grow whenever one is added. What a member fills with is the column's
// own answer to „nothing was stored": 0 for a NOT NULL DEFAULT 0 column, and NULL for the two
// subcontractor stawki, which EX-766 made nullable — `?? 0` there would stop being a fallback for a
// missing key and become a silent rewrite of „auto" into 0 zł on every restored praca.
type TolerantT<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type StoredSnapshotPayloadT = {
  schemaVersion: number
  sections: TolerantT<KosztorysSectionT, 'displayOrder'>[]
  items: TolerantT<
    KosztorysItemT,
    | 'displayOrder'
    | 'plannedQty'
    | 'discountValue'
    | 'clientPrice'
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'wToolsOverrideCoeff'
    | 'ownToolsOverrideCoeff'
  >[]
  stages: KosztorysStageT[]
  progress: TolerantT<StageProgressT, 'qtyDone'>[]
  settings?: Partial<SnapshotSettingsT>
}

// An absent key is NOT the same as a stored null: the `sql` tag emits NOTHING for `undefined`, so the
// tuple loses a placeholder and the INSERT dies on a syntax error — and where the column is NOT NULL DEFAULT 0, binding an explicit NULL
// would not draw the default either (23502). With a year of retention that stops being theoretical.
// The tolerance is declared in the TYPE (StoredSnapshotPayloadT above marks exactly these fields
// optional) so tsc rejects a future edit that drops a fallback, and the return type is the strict
// KosztorysItemT — meaning the compiler, not this comment, is what guarantees every field got filled.
//
// It lives at the payload readers (insertKosztorysTree, appendPresetSections) and
// not at the bind in insert-rows.ts, because those primitives are also called by appendCatalogueItems,
// which builds its rows in code (`asItem`) where a missing value is a caller bug to surface, not absorb.
//
// `displayOrder` takes the row's INDEX rather than 0: it is the natural key remapNewIds joins
// RETURNING on, so a constant would tie it batch-wide, drop the remap to positional, and restore the
// tree flattened to one position. `kosztorys_sections.name` and `kosztorys_stages.ordinal` are NOT
// NULL *without* a default and are deliberately left alone — see the bump rule above.
export function itemWithColumnDefaults(
  item: StoredSnapshotPayloadT['items'][number],
  index: number,
): KosztorysItemT {
  return {
    ...item,
    displayOrder: item.displayOrder ?? index,
    plannedQty: item.plannedQty ?? 0,
    discountValue: item.discountValue ?? 0,
    clientPrice: item.clientPrice ?? 0,
    wToolsOverrideValue: item.wToolsOverrideValue ?? null,
    ownToolsOverrideValue: item.ownToolsOverrideValue ?? null,
    // A snapshot taken before EX-865 knows neither key, and reading them as „auto" is the truth:
    // it was written when no mnożnik existed. `?? 0` would invent a stawka of zero złotych.
    wToolsOverrideCoeff: item.wToolsOverrideCoeff ?? null,
    ownToolsOverrideCoeff: item.ownToolsOverrideCoeff ?? null,
  }
}
