---
change_id: kosztorys-client-view-reuse
title: Client kosztorys view = admin editor body, read-only, minus a small omit-set
status: implementing
created: 2026-07-20
updated: 2026-07-20
archived_at: null
branch: konradantonik/ex-532-kosztorys-client-view-reuse
worktree: null
---

## Notes

Replace the bespoke client share render with a read-only reuse of the admin `KosztorysEditorBody`. The client view IS the admin view minus a small omit-set, driven by the server-resolved owner-vs-client mode (`payload-token` cookie via `getCurrentUserJwt`), handed once to the client components.

Omit-set:

- Grid columns: `priceMode`, `priceCoeff`, `note`, `actions`
- Footer: recon mismatch scream (`ReconMismatchBadge`)
- Internal links (materiały category, wpłaty) render as plain text, not `<Link>`

Data safety unchanged: `/k/[token]` runs `toClientView`, so subcontractor coeffs/overrides are **absent** from the DTO, not hidden. The public route carries no `payload-token`, so the cookie check and the data query already agree.

Tear out: `ClientKosztorysView`, `ClientKosztorysFooter`, `money-axis-toggle`.

`section-pie` is its **own separate slice** — remove it from the client view here, but do NOT delete/forget the component; it may be reintroduced on its own. Treat its removal as "not part of this reuse", not "gone for good".

Supersedes the S-13 / EX-532 bespoke build.
