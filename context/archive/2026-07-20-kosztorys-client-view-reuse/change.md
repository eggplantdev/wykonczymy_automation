---
change_id: kosztorys-client-view-reuse
title: Client kosztorys view = admin editor body, read-only, minus a small omit-set
status: archived
created: 2026-07-20
updated: 2026-07-24
archived_at: 2026-07-24T13:46:37Z
branch: konradantonik/ex-532-kosztorys-client-view-reuse
worktree: null
---

## Notes

Replace the bespoke client share render with a read-only reuse of the admin `KosztorysEditorBody`. The client view IS the admin view minus a small omit-set, driven by a page-declared `clientView` boolean (the `/k/[token]` route and the owner preview both know they are client-facing) — no cookie read at render.

Omit-set:

- Grid columns: `priceMode`, `priceCoeff`, `note`, `actions`
- Footer: recon mismatch scream (`ReconMismatchBadge`)
- Internal links (materiały category, wpłaty) render as plain text, not `<Link>`

Data-leak posture (owner decision, 2026-07-20): the field-by-field `toClientView` projection is **retired**, not preserved. The owner accepted that the client payload may carry the full tree (subcontractor coeffs included); the view is safe _enough_ by rendering `view:'client'` + `readOnly` + hidden chrome, not by stripping the payload.

Tear out: `ClientKosztorysView`, `ClientKosztorysFooter`, `toClientView`/`toGridRows` + their types. `MoneyAxisToggle` is **kept** — reused for the slim client header.

`section-pie` is its **own separate slice** — remove it from the client view here, but do NOT delete/forget the component; it may be reintroduced on its own. Treat its removal as "not part of this reuse", not "gone for good".

Supersedes the S-13 / EX-532 bespoke build.
