# Investment Notatki formatting — Plan Brief

> Full plan: `context/changes/2026-10-12-investment-notes-markdown/plan.md`

## What & Why

The AI kosztorys flow tells the owner what it assumed and what to ask the client through the
investment's Notatki. Rendered as plain text it is a wall the owner can't scan (owner screenshot,
2026-10-12). Render `## ` headings, `- ` lists and `**bold**` so the appendix reads as sections.

## Starting Point

One display site: `investment-notes.tsx` prints the note in a `whitespace-pre-line` div. No markdown
library in the repo.

## Desired End State

Headings, bullets and bold show on the investment page; a plain note looks as before; the textarea
still edits raw text.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Library | Hand-rolled parser, no dependency | Three constructs; a library brings HTML/links we don't want |
| Safety | Blocks → React elements, no `dangerouslySetInnerHTML` | A note can never inject markup |
| Where logic lives | `src/lib/investments/note-markdown.ts` | React-free, node-testable (AGENTS.md) |
| Editing | Raw textarea unchanged | Owner already edits this way; no rich editor |

## Scope

**In:** parser, renderer, specs. **Out:** links, italics, numbered/nested lists, preview, rewriting
the 10 AI appendices (done through the app after deploy).

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Parser and renderer | Formatted Notatki | A client mail pasted into notes gains bullets on `- ` lines — acceptable |

**Estimated effort:** one short session.
