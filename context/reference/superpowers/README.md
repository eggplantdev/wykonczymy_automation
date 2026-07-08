# Superpowers design & plan archive

Historical `/10x` design specs and implementation plans — kept for the **rationale** behind
decisions, not as current truth. For what the code does _now_, read the code and the living docs
(`context/foundation/lessons.md`, the reviewed references under `context/reference/`).

**Verify before quoting.** These predate later changes and some claims have drifted. Confirm any
statement against current code before repeating it in a living doc (see the Doc-lifecycle rule in
`AGENTS.md`). Their durable nuggets have already been extracted into the living docs above.

## Layout

- `archive/` — shipped changes. Once a change ships and its rationale is extracted into a living
  doc, its spec + plan move here per the Doc-lifecycle rule.

The pre-POC in-app-editor design draft (2026-05-28) was **deleted** 2026-07-08: its decisions were
superseded by the POC's decision register (`context/changes/kosztorys-poc-in-app/change.md` on
branch `poc-kosztorys-in-app`), and its one unique nugget — the "bridge with no shore" rationale
for retiring the sheet mirror at cutover — was extracted to `context/reference/kosztorys-sync.md`.
