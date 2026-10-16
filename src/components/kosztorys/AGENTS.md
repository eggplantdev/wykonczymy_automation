# Kosztorys components

Domain rules (the owner's sheet, naming, the register to talk in) live in the root `AGENTS.md`.

**Editor hooks (EX-521).** `editor/use-kosztorys-editor.ts` is the **composition entry** — it wires
sub-hooks together and owns the return shape components read. Each cohesive cluster (stage ops,
settlement settings, view state, …) is one leaf hook under `editor/hooks/`; a new cluster goes there,
not into a second root-level hook.

- **Nothing moves into `KosztorysEditorProvider`** — context value-identity churn is the EX-496 perf
  regression that was reverted once already.
- React-free logic goes one layer out, to `src/lib/kosztorys/`, testable without rendering — the
  cheapest layer wins.
- A hook whose risk is the lifecycle (overlapping async saves, teardown on unmount) gets a
  `renderHook` spec under the `dom` vitest project; `use-kosztorys-settings.test.tsx` is the pattern.
