# Investment Notatki formatting — Implementation Plan

## Overview

Render a small markdown subset in the investment's „Notatki” — `## ` headings, `- ` bullet lists and
`**bold**` — so the AI kosztorys notes appendix reads as sections with emphasis instead of one wall
of text. The owner keeps editing the raw text in the same textarea; nothing about saving changes.

## Current State Analysis

- `src/components/investments/investment-notes.tsx:102` is the **only** place a note is displayed:
  `<div className="whitespace-pre-line">{investment.notes || '—'}</div>`. The edit dialog and the
  investment form only edit it.
- Notes are written by people (management) and by the AI kosztorys flow, which appends an appendix
  through the app (`context/changes/2026-10-01-ai-kosztorys-generation-tests/`, `investment-notes-appendix.txt`
  per case). Today the appendix fakes structure with `=== … ===` banners and `Do ustalenia z klientem:`
  lines; on the page it is a grey block (owner screenshot, 2026-10-12).
- No markdown library in `package.json`, and none is needed for three constructs.

## Desired End State

A note containing `## Do ustalenia z klientem`, `- **podłogi**: …` lines and `**117 186,83 zł**`
shows a heading, a bulleted list and bold text. A note without any of those syntaxes renders exactly
as before (line breaks kept, dash for empty). The textarea still shows the raw text.

### Key Discoveries:

- One render site → no shared component needed beyond the notes body.
- AGENTS.md: React-free logic goes to `src/lib/` where a node spec can test it; `src/lib/investments/`
  already holds investment-domain helpers.
- Notes can carry a pasted client mail (below `———— mail klienta ————`), so a client line that
  happens to start with `- ` becomes a list item — harmless; that is what the line meant anyway.

## What We're NOT Doing

- No markdown library, no HTML passthrough, no links, italics, numbered lists, tables or nested lists.
- No preview inside the textarea / no rich editor.
- No change to how notes are saved or to the edit dialog / investment form.
- Rewriting the 10 AI appendices (#198–#207) is **not code** — it happens through the app after this
  ships to production, and the template goes into the AI kosztorys change's Fast path then.

## Implementation Approach

A pure parser turns the note into blocks (`heading` / `list` / `paragraph`), each holding inline
segments (`text` / `bold`). A small renderer in the notes component maps blocks to elements. No
`dangerouslySetInnerHTML` — React escapes every text segment, so a note can never inject markup.

## Phase 1: Parser and renderer

### Changes Required:

#### 1. Note parser

**File**: `src/lib/investments/note-markdown.ts`

**Intent**: Split a note into blocks line by line and split each block's text into plain/bold runs.

**Contract**: `parseNoteMarkdown(note: string): NoteBlockT[]`, where
`NoteBlockT = { kind: 'heading'; content: InlineT[] } | { kind: 'list'; items: InlineT[][] } | { kind: 'paragraph'; lines: InlineT[][] }`
and `InlineT = { text: string; isBold: boolean }`. Rules:
- a line starting with `## ` (or `# `) → heading;
- consecutive lines starting with `- ` → one list;
- other consecutive non-empty lines → one paragraph, line breaks preserved;
- an empty line ends the current block;
- `**x**` → bold run; an unmatched `**` stays literal text.
Types colocate in the same file only if `types.ts` would be a one-off — follow the folder's precedent.

#### 2. Render the blocks

**File**: `src/components/investments/investment-notes.tsx`

**Intent**: Replace the plain-text div with a `NoteBody` that renders the parsed blocks: heading as a
semibold line with top spacing (the „clear boundary” between sections; the first one has none), list
as a disc list, paragraph lines joined with `<br>`, bold as `<strong>`. Empty note keeps `—`.

**Contract**: display branch only; the textarea, `save()` and the `updateInvestmentAction` payload
are untouched.

### Success Criteria:

#### Automated Verification:

- Parser spec passes: `pnpm exec vitest run src/__tests__/lib/investments/note-markdown.test.ts`
  (heading, list grouping, paragraph line breaks, bold, unmatched `**` literal, plain note unchanged)
- Notes component spec passes: `pnpm exec vitest run src/__tests__/components/investments/investment-notes.test.tsx`
  (existing cases still green + a formatted note renders a heading, a list item and `<strong>`)

#### Manual Verification:

- Investment page → „Edytuj notatkę”, type a note with `## Do ustalenia`, two `- ` lines, one with
  `**podłogi**` → Zapisz: heading, bullets and bold show; „Edytuj notatkę” again shows the raw text.
- An investment with an old plain note (no `##`, `-`, `**`) looks as before, line breaks included.

---

## Testing Strategy

- Node spec for the parser — the cheapest layer that sees every rule.
- One DOM case in the existing component spec — proves the blocks reach the page.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`

## References

- Owner-facing source of the notes: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md` (Fast path)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Parser and renderer

#### Automated

- [ ] 1.1 Parser spec passes
- [ ] 1.2 Notes component spec passes
