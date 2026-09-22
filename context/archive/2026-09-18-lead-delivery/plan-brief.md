# Plan Brief: Lead Delivery — wykonczymy side

**Change:** `lead-delivery` · **Plan:** `plan.md` · **Shared identity:** `change.md` (mirrored in `landing_26`)
**Date:** 2026-09-21 · **Phases:** 6

## The ask in one paragraph

The `landing_26` contact form has no sink — `submitContactForm` validates and returns `{ ok: true }`.
This change builds the receiving half: an HMAC-authenticated JSON webhook that lands a submission in
`leads` **with its photos** — fetched server-side from the URLs the landing sends — and the file
relation `investments` has never had, so a manager can
promote a lead into an investment that carries the visitor's images. No bytes are copied at
promotion — both rows point at the same files.

## Why assets come first

`investments` accepts no images today. Promotion has nothing to attach to until it does, and the
assets half ships value on its own (any investment can be given photos and PDFs). So: Phases 1–3
assets, 4–5 intake, 6 promotion.

## Key Decisions

| #   | Decision                                                                           | Rationale                                                                                                                                                                                     | Source                                                     |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Files live in **`media`**, with a new `kind` field                                 | The whole upload pipeline is already generic; a second collection forks the orphan counter, which has **already** silently missed a relation (`equipment-events`)                             | **Plan — reverses change.md 2026-09-18**                   |
| 2   | One `MEDIA_RELATIONS` registry drives both the delete guard and the orphan counter | The hand-maintained list is the thing that broke; one list cannot be half-updated                                                                                                             | Plan                                                       |
| 3   | `makePreventDelete` on `media`                                                     | `media_rels` is `ON DELETE cascade` — deleting a lead would strip a live investment's PDF                                                                                                     | change.md                                                  |
| 4   | **Client uploads direct to Blob; the wire is signed JSON carrying URLs**           | The Vercel request-body cap is 4.5 MB on _every_ function — no push design can carry the files. Bytes bypass functions on the way in and are _pulled_ on the way out, and pulls aren't capped | **Plan — reverses change.md's "multipart from the start"** |
| 5   | 15 assets × 8 MB, enforced by Blob in `onBeforeGenerateToken`                      | A storage-layer limit refuses the upload before it exists, which beats checking bytes that already arrived                                                                                    | Plan                                                       |
| 5b  | **Host allowlist + bounded download** on every fetched URL                         | Resolving foreign URLs makes the webhook a request forwarder; HMAC proves _who sent_ the URL, not that it's safe                                                                              | Plan                                                       |
| 5c  | The upload token is minted **only after the form validates server-side**           | A public marketing form has no user to authenticate, so form validity is the gate — a bot must pass the schema before it can touch storage                                                    | User, 2026-09-21                                           |
| 6   | `area` stays **text**                                                              | The label invites a range („30–60 m²"), which no numeric column holds                                                                                                                         | change.md Open → resolved                                  |
| 7   | `landing_form` as a third `source` value                                           | Keeps the cutover measurable while WordPress still runs, and keeps uuid `externalId`s out of WPForms' numeric space                                                                           | change.md                                                  |
| 8   | Partial file failure → store the lead, alert ops, answer **200**                   | Losing the enquiry is the outcome the landing's queue exists to prevent; an incomplete photo set is the lesser failure, made visible by the alert                                             | User round 4                                               |
| 9   | Promotion is **by hand**, via a prefilled create dialog                            | `investments` is heavy and deliberately hard to delete; auto-creation fills it with spam                                                                                                      | change.md + user round 3/4                                 |
| 10  | Provenance: `leads.investment` relation + auto `contactStatus: contacted`          | The lead stays as the record of where the investment came from                                                                                                                                | User round 4                                               |
| 11  | Assets UI on detail page, edit dialog **and** create dialog                        | Create is the standard path — the promotion flow rides it                                                                                                                                     | User round 3                                               |
| 12  | Wire schema duplicated in both repos, pinned by a shared fixture                   | Only a ~7-field envelope has to agree; a shared package means two version bumps per field                                                                                                     | change.md                                                  |

## The decision this plan reverses

`change.md` records, 2026-09-18: _"one upload collection serves both sides … Not `media` — that is
the invoice library under the 'Finanse' admin group."_ Overturned. The objection was admin-panel
labelling; the evidence against it is structural (shared pipeline top to bottom, one shared orphan
counter that has already forgotten a relation). Labelling is answered by a `kind` field, which is
cheaper than a collection. Per `change.md`'s own rule, the rewrite lands in **both** repos before
Phase 1 code.

## The number that reshaped this plan

**The Vercel request-body cap is 4.5 MB, not 100 MB.** Verified 2026-09-20 against the live
`vercel.com/docs/functions/limitations` (`last_updated: 2026-08-24`, 413
`FUNCTION_PAYLOAD_TOO_LARGE`). It binds Server Actions, Route Handlers and middleware alike — a
route handler escapes only Next's own 1 MB `serverActions.bodySizeLimit`, never the platform cap.
`next.config.ts:12-15` already said so and was right.

The first draft of Phase 5 pushed 15 × 8 MB through a multipart POST. That was ~13× over a hard
limit at every hop. Phase 5 is now the client-direct-to-Blob topology above.

**Why it matters more than it sounds:** PDFs skip compression (`processUploadFile` line one), so a
4 MB ceiling rejects exactly the multi-page scans and designer decks that change.md calls the
substance of an enquiry — while photos, which compress to ~128 KB, would never have noticed. EX-457
already proved this internally: a 47 MB JPEG and a 45 MB HEIC both passed the 4 MB guard; only PDFs
ever trip it.

## Two things that will break if missed

1. **SSRF.** The webhook fetches URLs another service supplies. Allowlist `URL.hostname` by exact
   match, require `https:`, and refuse redirects — a redirect off the allowlisted host is the bypass.
2. **`onUploadCompleted` never fires on localhost.** Blob can't call back into a dev machine. Don't
   build anything in dev that depends on it.

## Scope boundaries

Not doing: a second upload collection · automatic promotion · any `landing_26` code (its blob
store, token route and forward are its own half) · backfilling existing `website_form` leads ·
`kind` at intake · a retention policy for lead photos · a private Blob store.

## Migration posture

Three hand-written migrations, all **additive** — so all three are applied to prod **before** the
deploy that reads them. A human runs `pnpm db:migrate:prod`. `LANDING_WEBHOOK_SECRET` and `LANDING_BLOB_HOST` must
exist in Vercel before Phase 5 ships, or boot fails — and the host differs per environment.
