---
id: leads-capture-fb-webhook
title: Lead capture — HMAC-verified FB Lead Ads webhook → leads collection + table view
status: implementing
created: 2026-07-06
updated: 2026-07-07
---

# Lead capture — FB Lead Ads → centralized leads store

First buildable increment of the centralized interaction store. Turns the existing
console-logging FB Lead Ads webhook into a resilient capture path: HMAC signature
verification, a source-agnostic `leads` Payload collection (append-only event log),
type-driven field extraction with a Zod safety net, store-then-notify (a mail failure
can never lose a lead), and a frontend leads table with an editable follow-up status.

**Excluded (deliberately deferred):** `clients` collection (direction chosen = option B,
built later), lead-facing auto-reply, Sentry, notification bell + websockets.

Design: `docs/superpowers/specs/2026-07-06-leads-capture-design.md`
Reference: `docs/facebook-leads-setup.md` (webhook/token/backfill/data-shape)
Plan: `context/changes/leads-capture-fb-webhook/plan.md`
