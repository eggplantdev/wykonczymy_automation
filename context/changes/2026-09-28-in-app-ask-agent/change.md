---
change_id: in-app-ask-agent
title: In-app read-only „Zapytaj o tę stronę" agent with source-code and data tools
status: new
created: 2026-09-28
updated: 2026-09-28
archived_at: null
branch: null
worktree: null
---

## Notes

in-app read-only "Zapytaj o tę stronę" agent with access to the deployed source code + curated data tools; parked

**Parked (2026-09-28)** — shaped in conversation, not scheduled. Linear: EX-892.

### Problem

Non-technical users (owner, managers) can't ask "here is a link, this figure looks wrong — what is
happening?". Today only the developer can answer, by pointing Claude Code at the repo + DB.

### Direction chosen

An agent inside the app (AI SDK 7 + the existing OpenRouter provider, `src/lib/ai/openrouter.ts`),
opened from a page with the page path/ids and the question attached.

- **Data tools are curated, not raw SQL.** Thin wrappers over `src/lib/queries` / `src/lib/db`, so
  the agent's figures equal the screen's by construction. A raw-SQL agent re-derives marża / bilans /
  robocizna and disagrees with the UI (VAT planes, RABAT/LOSS, cancellations, v1/v2).
- **Code tools over the deployed source.** Bundle `src/**`, `context/**`, `AGENTS.md` into the route
  via `outputFileTracingIncludes` (~2 200 files / ~18 MB); expose `searchCode` / `readFile` /
  `listFiles`. The agent reads exactly the build that produced the numbers, on a read-only
  filesystem, with no shell and no env. Exclude row-bearing files (`src/scripts/data`,
  `src/__tests__/fixtures`).
- **Glossary + `investment-financials-and-discount.md` in the system prompt.**
- **OWNER/MANAGER only** at first; role gating is free because the route runs behind `requireAuth()`.
- **Log every question + context**; a „to wygląda na błąd" verdict can become a Linear issue with the
  page, question and files read attached.

### Safety — the boundary is the credential, not the prompt

- Nothing that sends data outward (no web fetch, email, Sheets write) — DB free text and Facebook
  leads are external input, so prompt injection must have no exfil path; worst case stays a wrong
  answer.
- If a free-form SQL tool is ever added: a dedicated Neon role created by a human — `SELECT` only,
  `default_transaction_read_only = on`, `statement_timeout`, ideally on a read replica — with
  `users` (Payload `hash`/`salt`/reset tokens) and `payload_preferences` revoked.

### Rejected / fallback options

- **Claude Code / Cowork per coworker** — permission `deny` rules are not a security boundary; a
  local checkout carries `.env` (Neon prod URL, prod Blob token) and `dumps/` (real client data).
  Per-seat cost, no role scoping, raw SQL. Acceptable only as a one-week experiment for the owner on
  a fresh cloud clone holding nothing but a read-only DB URL.
- **Vercel Sandbox running a full agent (e.g. Claude Agent SDK)** — real shell, isolated, but
  per-question clone/boot latency, more moving parts, wants an Anthropic key rather than OpenRouter.
  Revisit only if grep/read tools prove too weak.

### Open question

Answers straight to the user, or also route a „bug" verdict to Linear for triage?
