# Landing intake contract

The one artifact both repos read. `landing_26` sends; `wykonczymy` receives at
`POST /api/webhooks/landing`. The contract is **duplicated, not packaged** (decision, 2026-09-18) —
so this file and the fixture beside it are what keep the two copies from drifting silently.

A byte-identical copy of this file lives in `landing_26`. Change one, change both.

## Endpoint

```
POST https://<wykonczymy>/api/webhooks/landing
Content-Type: application/json
x-landing-signature: sha256=<hex HMAC-SHA256 of the RAW body>
```

The HMAC is computed over the **exact bytes sent**, never over a re-serialised object — a
re-`JSON.stringify` on either side changes key order or spacing and the signature stops matching.
Shared secret: `LANDING_WEBHOOK_SECRET`, the same value in both projects' env.

## Envelope

Strict on what identifies a submission, permissive on the rest: the landing may add a question
without a coordinated deploy here, and an unknown field is ignored rather than rejected.

| Field                                 | Required | Notes                                                                                 |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `submissionId`                        | yes      | uuid, one per submission — this is what makes a replay idempotent                     |
| `submittedAt`                         | no       | ISO 8601                                                                              |
| `locale`, `formId`, `formName`        | no       | recorded as-is                                                                        |
| `name`, `email`, `phone`              | no       | the standard three                                                                    |
| `address`, `scope`, `area`, `message` | no       | the landing's typed answers; `area` is text, because the form invites a range         |
| `rawData`                             | no       | `{ name, values[] }[]` — when omitted, the typed answers above become the answer list |
| `formQuestions`                       | no       | `{ key, label, type? }[]` — key→label for the answers modal                           |
| `assets`                              | no       | `{ url, filename, contentType, size }[]`, at most **15**                              |

Schema and mapping: `src/lib/leads/landing.ts`. Fixture: `src/__tests__/fixtures/landing-submission.ts`.

## Files

The bytes never travel in this request. The visitor uploads straight to the landing's own blob
store, and this handler pulls each file back from its url.

- `url` must be `https:` and its **hostname must equal `LANDING_BLOB_HOST`** exactly. A redirect is
  refused rather than followed — a redirect off the allowlisted host is the bypass the allowlist
  exists to stop.
- Accepted types mirror `media.mimeTypes`: `image/*`, `application/pdf`. Checked on the declared
  `contentType` **and** on the response's.
- Ceiling: **8 MB** per file, enforced on `size`, on `content-length`, and by counting bytes as the
  body streams — the first two are the sender's claims, the third is the fact.

`LANDING_BLOB_HOST` differs between preview and production. Pointing production at the preview
store's host makes every real submission's photos unfetchable.

## Two rules that live on the landing side

1. **The upload token is minted only after the form validates server-side.** Otherwise the store is
   an open file drop.
2. **The blob host must be the one wykonczymy allowlists** for that environment.

## Answers

| Situation                           | Status | What happens                                                               |
| ----------------------------------- | ------ | -------------------------------------------------------------------------- |
| Bad or missing signature            | `403`  | nothing is read                                                            |
| Body is not JSON                    | `400`  | —                                                                          |
| Envelope fails the schema           | `400`  | ops alert (`notifyShapeAlert`)                                             |
| Some files could not be pulled      | `200`  | **the lead is stored** with what resolved; ops alert lists the failed urls |
| Same `submissionId` again           | `200`  | no second lead, no second e-mail, no second download                       |
| The lead itself could not be stored | `500`  | the landing should retry                                                   |

`200` means „stop retrying", so it is the answer to everything except a failure to store the lead.
Losing the enquiry is the outcome the landing's queue exists to prevent; an incomplete photo set is
the lesser failure, and the alert makes it visible. Recovery is real, not theoretical: a failed
file's url stays live in the landing's store until its queue row is deleted, so the alert carries
the url and the file can be attached by hand.
