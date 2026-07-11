---
change_id: receipt-scan-line-items
title: Scan receipts into investment-expense line items via LLM vision
status: in review
created: 2026-07-11
updated: 2026-07-11
archived_at: null
branch: receipt-scan-line-items
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-receipt-scan
linear: EX-443
---

## Notes

Batch-drop N receipts into the investment-expense dialog; each image is read by an
LLM (vision) into one editable line-item row, the same image attached as that row's
invoice. User reviews inline, saves via the existing path. **1 receipt = 1 line item.**

Design shaped 2026-07-11 (settled forks):

- **Fan-out:** one parallel extraction call per image (1 image → 1 row). Partial
  failures isolated; rows stream in as they resolve. NOT one multi-image call.
- **Image reuse:** the scanned receipt doubles as that row's invoice media ref —
  one upload to Payload media, two uses (extraction + attachment).
- **Category fields:** pass the live `referenceData.expenseCategories` names into the
  prompt; model returns a name; code maps name→id with **exact-match-or-blank**
  (hallucinated category can never reach the form). `category` ("other") is out of
  scope — only `expenseCategory` is required for `INVESTMENT_EXPENSE`.
- **Extractable fields:** `description`, `amount`, `invoiceNote`, `expenseCategoryName`.
- **Provider:** OpenRouter (reuse the pattern from the ai_devs + eggplant-notes repos —
  `OPENROUTER_API_KEY`, model as a `"provider/model"` string). Realized via **Vercel
  AI SDK `generateObject` + a Zod schema** (native structured output; matches this
  repo's Zod/server-action conventions), NOT the raw plain-JS `openai`-SDK config from
  the course. Model isolated to one constant → cheapest-that-works is a one-line swap;
  start ~`openai/gpt-4o-mini` and tune manually.

New pieces (all small):

- `src/lib/ai/openrouter.ts` — provider client + `extractReceipt()` helper + model const.
- `receiptExtractionSchema` (Zod), colocated with the extract feature.
- `extractReceiptAction` in `src/lib/actions` — `protectedAction()` / `requireAuth()` /
  `perfStart()` / `ActionResultT`. **No mutation, no cache revalidation** (pure read).
- Batch-scan UI in `LineItemsField` (pushValue loop over resolved results).

Env: add `OPENROUTER_API_KEY` (required, no default) + optional
`OPENROUTER_HTTP_REFERER` / `OPENROUTER_APP_NAME` to `src/lib/env/schema.ts` +
`server.ts`, read via `serverEnv`.

Deps: hand-edit `package.json` (arm64 lightningcss rule) — add `ai`,
`@openrouter/ai-sdk-provider`, then `pnpm install --force`.

Scope: **add-flow only** (new expense dialog), not the edit-transfer form.

Not a kosztorys-arc slice — different domain (investment expenses / transfers), so it
lives as a standalone change folder + Linear issue, NOT a renumbered `S-NN` row in the
kosztorys roadmap.

Reference lessons: ai_devs S01E04 (multimodality / `input_image`) + S01E01 (structured
output). See `context/reference/` if a durable note gets extracted later.
