---
change_id: investment-review-request
title: Google review request email for a completed investment
status: implementing
created: 2026-10-02
updated: 2026-10-02
archived_at: null
branch: investment-review-request
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/investment-review-request
---

## Notes

Linear: EX-973. Prośba o opinię Google dla zakończonej inwestycji. Decisions (owner, 2026-10-02):

1. On a status change to „Zakończona" in `investment-form`, the existing confirm dialog also asks
   whether to send the review request.
2. „Poproś o opinię" button on the investments listing and on the investment page — only for status
   `completed`.
3. Sends a branded email (`renderBrandedEmail`, from `LEADS_REPLY_FROM`, like `sendAutoReply`) to
   `investment.email` with the Google review link (constant in code):
   `https://search.google.com/local/writereview?placeid=ChIJdwKTEzbNHkcRZA6UBMGUMdc`
   (place „Wykończymy.com.pl", Terespolska 2, Warszawa — found via Maps search, owner to confirm).
4. No client email → the dialog asks for it and saves it to `investment.email`. This is the common
   path: 62 of 80 completed investments in the 2026-10-02 local dump have no email.
5. Tracking = a boolean flag only („sent"), replacing the leftover `review` textarea („Opinia").
   It was already used by hand as that flag: `tak` meant "we asked for a review". Migration:
   `tak` → true, everything else (`nie`, `niee`, `11 listopada`, empty) → false. Resend allowed.
   Deploy order cuts both ways: the new code needs the boolean (additive → migrate before push),
   the old code still SELECTs `review` (drop → after the deploy). Split into two migrations.
6. Who can send: ADMIN / OWNER / MANAGER.
7. Email copy: agent drafts in Polish, owner iterates.
