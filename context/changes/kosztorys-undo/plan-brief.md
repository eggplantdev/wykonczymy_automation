# Plan Brief: Kosztorys Undo / Redo (S-07)

**What:** In-session undo/redo for the kosztorys v2 editor — cell edits, stage-progress, ▲▼ reorder,
and panel edits (rename / VAT / coeff) — via toolbar buttons and Cmd+Z / Cmd+Shift+Z. Client-side
command stack, gone on reload (S-06 owns durable recovery).

**Why a re-integration:** Fully built on the unmerged `feat/kosztorys-undo` branch (30 tests, 14
manual checks passed) but cut from a ~200-commit-stale base; staging's integration surface was
refactored since (EX-515 split `use-kosztorys-editor.ts`). Port the self-contained engine files
verbatim; re-implement the editor wiring against staging's current handlers. Not a merge/rebase.

**Approach:** Command pattern over two in-memory stacks. Commands are captured at existing write
seams and reuse the already-existing inverse server actions (`updateItemFieldAction`,
`swapItemOrderAction`, `setStageProgressAction`, section/VAT/coeff actions) — no new server code, no
schema. `prevById` updated in lockstep on every undo/redo. Burst coalescing (`UNDO_COALESCE_MS`=700ms)
collapses per-keystroke `onChange` bursts into one entry.

**Three phases:**

1. Port engine + coalesce + keyboard files; add `cancel` to `use-debounced-save`; wire shell provider
   - toolbar + keyboard; capture grid-edit + reorder commands.
2. Capture panel-edit commands (rename / VAT / coefficients) via `patchRows`.
3. Gate S-06's idle auto-snapshot interval on the stack `revision` (dirty flag).

**Key decisions:** Scope A (no add/delete/cascade undo, no `uid` map). Cmd+Z layered handoff — native
dsg char-undo wins while a cell is actively edited, our stack wins otherwise. E2E deferred to an
`e2e-backlog` Linear issue; S-07 lands **in-review**, not Done, until authored.

**Risk:** the re-integration itself — `use-kosztorys-editor.ts` drifted heavily, so re-read each
handler's current shape before attaching a capture; the branch diff's line numbers are stale but the
seam names are confirmed intact on staging.

Full plan: `plan.md` · Change: `change.md`
