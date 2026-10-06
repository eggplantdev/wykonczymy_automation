# Plan brief — „Ustaw kolejność” (EX-999)

**What:** harden the uncommitted spike: a dialog that rearranges a whole kosztorys / szablon (~400 prac) with multi-select, block drag across sections and section drag, saved as one write with an auto-version.

**Decisions:**

- **Pending cell saves:** flush every lane (`drainAll`) before writing the layout.
- **Undo:** auto-version only. A save clears Cofnij/Ponów, the same as „Wyczyść” and „Popraw literówki”.
- **Extra scope:** a section colour rail on the list only. No keyboard moves, no search.
- **Tests:** unit + DB + DOM now; the drag E2E goes to an `e2e-backlog` issue.

**Phases:**

1. **Layout write.** Split check from write so the snapshot lands inside the transaction, after the stale check. Add the move-logic unit spec and the DB spec.
2. **`drainAll`** in the save lanes, exposed as `flushPendingSaves` on the editor and awaited by the dialog's save.
3. **Polish.** Section colour, the DOM spec, the e2e-backlog issue, and a manual pass on szablon 165.

**Biggest risk:** the spike's SQL has never run against a database; the Phase 1 DB spec is its first execution.
